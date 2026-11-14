import "./local-services";
import "./webworld.css";
import { getDemoEvent } from "../shared/demo";
import { syncResultSchema, type SyncResult } from "../shared/schema";

type Snapshot = {
  state: string;
  gx: number;
  gz: number;
  y: number;
  speed: number;
  walking: boolean;
  flying: boolean;
  points: number;
  banked: number;
  caught: number;
  distance: number | null;
  bearing: number;
  robots: number;
  drones: number;
  atmosphere: string;
};
type Engine = {
  locations: Record<string, { gx: number; gz: number; name: string }>;
  getSnapshot(): Snapshot;
  subscribe(callback: (state: Snapshot) => void): () => void;
  applyScenario(scenario: SyncResult["scenario"]): void;
  setTarget(location: string | null): void;
  projectTarget(): { x: number; y: number; visible: boolean } | null;
  projectSpeaker(): {
    x: number;
    y: number;
    visible: boolean;
    text?: string;
  } | null;
  collect(): void;
  finish(): void;
};
declare global {
  interface Window {
    __webworldEngine: Engine;
    __webworld: { getMission: () => unknown };
  }
}

const panel = document.createElement("div");
panel.id = "webworld";
panel.innerHTML = `
  <header class="ww-brand"><strong>WEBWORLD</strong><small>HELSINKI</small></header>
  <aside class="ww-feed" aria-label="World director">
    <div class="ww-feed-top"><span class="ww-signal"></span><span>CITY SIGNAL</span><select id="ww-mode" aria-label="News mode"><option value="demo">Demo</option><option value="live">Live news</option></select></div>
    <p id="ww-headline">A new signal is waiting.</p>
    <div class="ww-source"><a id="ww-source-link" target="_blank" rel="noopener noreferrer"></a><time id="ww-time"></time></div>
    <button id="ww-sync" type="button">↻ &nbsp; SYNC REALITY</button>
    <p id="ww-status" role="status">Simulated news · playable offline</p>
    <button id="ww-collapse" type="button" aria-expanded="true">Hide signal</button>
  </aside>
  <section class="ww-mission" aria-label="Current mission">
    <div class="ww-mission-kicker"><span>ACTIVE DELIVERY</span><span id="ww-progress"></span></div>
    <h2 id="ww-title"></h2><p id="ww-objective"></p>
    <div class="ww-task"><span id="ww-task-icon">◇</span><div><strong id="ww-step"></strong><small id="ww-distance"></small></div></div>
    <div class="ww-steps" id="ww-steps"></div>
    <div class="ww-dialogue"><strong id="ww-speaker"></strong><span id="ww-dialogue"></span></div>
  </section>
  <button id="ww-interact" type="button" hidden><kbd>R</kbd><span></span></button>
  <div id="ww-world-target" aria-hidden="true"><span>◇</span><small></small></div>
  <div id="ww-npc-bubble" hidden></div>
  <div class="ww-mobile-controls"><button id="ww-walk" type="button">Walk / Ride</button><button id="ww-leap" type="button">Jump · ×3 fly</button></div>
`;
document.body.append(panel);
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let engine: Engine;
let active: SyncResult;
let stepIndex = 0;
let packets = 0;
let completed = false;
let demoIndex = 0;
let syncing = false;
let lastState: Snapshot;
let lastGameState = "title";
let collapsed = false;
let stepCooldown = 0;
let missionSerial = 0;
const syncButton = el<HTMLButtonElement>("ww-sync");
const mode = el<HTMLSelectElement>("ww-mode");

function activate(result: SyncResult) {
  active = syncResultSchema.parse(result);
  stepIndex = 0;
  packets = 0;
  completed = false;
  missionSerial++;
  engine.applyScenario(active.scenario);
  engine.setTarget(active.scenario.mission.steps[0].location);
  el("ww-title").textContent = active.scenario.mission.title;
  el("ww-objective").textContent = active.scenario.mission.description;
  el("ww-headline").textContent = active.news.headline;
  const source = el<HTMLAnchorElement>("ww-source-link");
  source.textContent = active.news.sourceName;
  if (active.news.sourceUrl) source.href = active.news.sourceUrl;
  else source.removeAttribute("href");
  const time = new Date(active.news.retrievedAt);
  el("ww-time").textContent = time.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  el("ww-time").title = `Retrieved ${time.toISOString()}`;
  const line = active.scenario.dialogue[0];
  el("ww-speaker").textContent = line.speaker;
  el("ww-dialogue").textContent = line.text;
  el("ww-status").textContent =
    active.news.mode === "demo"
      ? "Simulated news · fictional mission"
      : "Live source · fictional mission";
  renderSteps();
}
function renderSteps() {
  const steps = active.scenario.mission.steps;
  el("ww-progress").textContent = completed
    ? "COMPLETE"
    : `${stepIndex + 1} / ${steps.length}`;
  el("ww-steps").replaceChildren(
    ...steps.map((step, index) => {
      const span = document.createElement("span");
      span.className =
        index < stepIndex ? "done" : index === stepIndex ? "current" : "";
      span.title = step.label;
      return span;
    }),
  );
  el("ww-step").textContent = completed
    ? "+500 compute delivered"
    : steps[stepIndex].label;
  el("ww-task-icon").textContent = completed ? "✓" : "◇";
  panel.classList.toggle("mission-complete", completed);
}
function completeStep() {
  if (
    !active ||
    completed ||
    lastState?.state !== "ride" ||
    (lastState.distance ?? Infinity) > 6 ||
    performance.now() < stepCooldown
  )
    return;
  const step = active.scenario.mission.steps[stepIndex];
  if (step.action === "deliver" && packets === 0) return;
  if (step.action === "collect") {
    packets++;
    engine.collect();
  }
  stepIndex++;
  stepCooldown = performance.now() + 600;
  if (stepIndex === active.scenario.mission.steps.length) {
    completed = true;
    engine.finish();
    el("ww-objective").textContent =
      "The network is back online. Sync reality for your next mission.";
    el("ww-speaker").textContent = "Dispatch";
    el("ww-dialogue").textContent =
      "Delivery confirmed. Keep riding — the internet never stands still.";
  } else engine.setTarget(active.scenario.mission.steps[stepIndex].location);
  renderSteps();
}
async function syncReality() {
  if (syncing) return;
  syncing = true;
  syncButton.disabled = true;
  mode.disabled = true;
  syncButton.textContent = "CONNECTING…";
  el("ww-status").textContent =
    mode.value === "live"
      ? "Retrieving news and directing the city…"
      : "Receiving the next simulated signal…";
  try {
    if (mode.value === "demo") activate(getDemoEvent(demoIndex++));
    else {
      const response = await fetch("/api/sync", {
        method: "POST",
        signal: AbortSignal.timeout(35_000),
      });
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "The signal could not be retrieved.");
      const parsed = syncResultSchema.safeParse(data);
      if (!parsed.success)
        throw new Error(
          "The director returned an unsupported mission. Your current delivery is still active.",
        );
      activate(parsed.data);
    }
  } catch (error) {
    el("ww-status").textContent =
      error instanceof Error
        ? error.message
        : "The signal could not be retrieved.";
  } finally {
    syncing = false;
    syncButton.disabled = false;
    mode.disabled = false;
    syncButton.textContent = "↻  SYNC REALITY";
  }
}
function update(snapshot: Snapshot) {
  lastState = snapshot;
  const playing = snapshot.state === "ride";
  panel.classList.toggle("playing", playing);
  panel.classList.toggle("theater", el("hud").classList.contains("theater"));
  if (playing && lastGameState !== "ride" && active)
    engine.setTarget(
      completed ? null : active.scenario.mission.steps[stepIndex].location,
    );
  lastGameState = snapshot.state;
  if (!active) return;
  const distance = snapshot.distance;
  el("ww-distance").textContent = completed
    ? "Network restored"
    : `${Math.round(distance ?? 0)} m · ${packets} packet${packets === 1 ? "" : "s"} secured`;
  if (!completed) {
    el("ww-task-icon").textContent = "↑";
    el("ww-task-icon").style.transform =
      `rotate(${(snapshot.bearing * 180) / Math.PI}deg)`;
  } else el("ww-task-icon").style.transform = "";
  const near = playing && !completed && distance !== null && distance <= 6;
  const button = el<HTMLButtonElement>("ww-interact");
  button.hidden = !near;
  if (near) {
    const step = active.scenario.mission.steps[stepIndex];
    button.querySelector("span")!.textContent = step.label;
    if (step.action === "collect" || step.action === "deliver") completeStep();
  }
  const projected = engine.projectTarget();
  const marker = el("ww-world-target");
  marker.hidden = !playing || !projected?.visible || completed;
  if (projected?.visible) {
    marker.style.left = `${projected.x * 100}%`;
    marker.style.top = `${projected.y * 100}%`;
    marker.querySelector("small")!.textContent =
      `${Math.round(distance ?? 0)} m`;
  }
  const speaker = engine.projectSpeaker();
  const bubble = el("ww-npc-bubble");
  bubble.hidden = !playing || !speaker?.visible || completed;
  if (speaker?.visible) {
    bubble.textContent = speaker.text ?? active.scenario.dialogue[0].text;
    bubble.style.left = `${speaker.x * 100}%`;
    bubble.style.top = `${speaker.y * 100}%`;
  }
}
syncButton.addEventListener("click", () => void syncReality());
el("ww-interact").addEventListener("click", completeStep);
window.addEventListener("keydown", (event) => {
  if (
    event.code === "KeyR" &&
    !event.repeat &&
    !(event.target instanceof HTMLInputElement)
  )
    completeStep();
});
el("ww-collapse").addEventListener("click", () => {
  collapsed = !collapsed;
  panel.classList.toggle("feed-collapsed", collapsed);
  el("ww-collapse").textContent = collapsed ? "Show signal" : "Hide signal";
  el("ww-collapse").setAttribute("aria-expanded", String(!collapsed));
});
el("ww-walk").addEventListener("click", () =>
  el<HTMLButtonElement>("btn-walk").click(),
);
el("ww-leap").addEventListener("pointerdown", () =>
  window.dispatchEvent(
    new KeyboardEvent("keydown", { code: "Space", bubbles: true }),
  ),
);
for (const event of ["pointerup", "pointercancel", "pointerleave"])
  el("ww-leap").addEventListener(event, () =>
    window.dispatchEvent(
      new KeyboardEvent("keyup", { code: "Space", bubbles: true }),
    ),
  );

window.addEventListener("webworld-ready", () => {
  engine = window.__webworldEngine;
  const initial = getDemoEvent(2);
  initial.scenario.mission = {
    title: "The Compute Run",
    description:
      "The city is running low. Pick up two compute packets and deliver them across Rautatientori.",
    objective: "Collect two packets and deliver them to the square terminal.",
    steps: [
      {
        location: "depot",
        label: "Collect the freight packet",
        action: "collect",
      },
      {
        location: "plaza",
        label: "Collect the plaza packet",
        action: "collect",
      },
      {
        location: "compute",
        label: "Deliver to the square terminal",
        action: "deliver",
      },
    ],
  };
  initial.scenario.dialogue = [
    {
      speaker: "Dispatch",
      text: "Your scooter is charged. Follow the cyan marker and bring that compute home.",
    },
  ];
  activate(initial);
  engine.subscribe(update);
  window.__webworld = {
    getMission: () => ({
      stepIndex,
      packets,
      completed,
      missionSerial,
      title: active.scenario.mission.title,
      news: active.news,
    }),
  };
  void fetch("/api/status")
    .then((response) => response.json())
    .then((status) => {
      if (!status.liveAvailable)
        el("ww-status").textContent = "Demo ready · Live needs server API keys";
    })
    .catch(() => {
      el("ww-status").textContent = "Demo ready · Live service unavailable";
    });
});
const gameScript = document.createElement("script");
gameScript.type = "module";
gameScript.src = "/engine/game.js";
gameScript.addEventListener("error", () => {
  el("fatal").textContent =
    "WEBWORLD could not load the game engine. Reload to try again.";
  el("fatal").classList.remove("hidden");
});
document.head.append(gameScript);
