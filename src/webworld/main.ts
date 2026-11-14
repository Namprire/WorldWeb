import "./local-services";
import "./webworld.css";
import "./oil-paint.css";
import "./discovery.css";
import {
  companiesSchema,
  filterCompanies,
  activeJobs,
  type Company,
} from "../shared/startups";
type Snapshot = {
  state: string;
  environment: "aurora" | "autumn";
  gx: number;
  gz: number;
  y: number;
  speed: number;
  walking: boolean;
  flying: boolean;
  mapOpen: boolean;
};
type Engine = {
  setEnvironment(mode: "aurora" | "autumn"): boolean;
  getSnapshot(): Snapshot;
  subscribe(fn: (s: Snapshot) => void): () => void;
  configureCompanies(c: Company[]): void;
  setMatches(ids: string[]): void;
  setSourceChanges(ids: string[]): void;
  selectCompany(id: string | null): void;
  setUIFocus(v: boolean): void;
  setMap(v: boolean): void;
  projectCompany(id: string): { x: number; y: number; visible: boolean } | null;
  setExhibitMedia(items: unknown[]): void;
};
declare global {
  interface Window {
    __webworldEngine: Engine;
    __webworld: { getDiscovery: () => unknown };
  }
}
const panel = document.createElement("div");
panel.id = "webworld";
panel.innerHTML = `
<header class="discovery-brand"><b>WEBWORLD</b><span id="discovery-season">HELSINKI / AUTUMN WOOD</span></header>
<nav class="discovery-tools" aria-label="Explore Helsinki"><button id="discover-toggle">Find a company <kbd>/</kbd></button><button id="map-toggle" aria-pressed="false">City view <kbd>V</kbd></button></nav>
<div class="environment-picker environment-in-game" role="group" aria-label="Painting environment">
<button type="button" data-environment="aurora" aria-pressed="false" disabled>Northern lights</button>
<button type="button" data-environment="autumn" aria-pressed="true" disabled>Autumn wood</button>
</div>
<section id="discovery-search" class="discovery-pane" aria-label="Find companies" hidden>
<div class="pane-top"><span>THE COLLECTION</span><button id="search-close" aria-label="Close search">×</button></div>
<input id="company-query" aria-label="Search companies" placeholder="Company, sector or job…" autocomplete="off">
<div class="discovery-filters"><select id="company-sector" aria-label="Sector"><option value="">All sectors</option></select><label><input id="company-hiring" type="checkbox"> Hiring</label></div>
<p id="result-count"></p><div id="company-results"></div>
<button id="source-refresh">Check sources</button><p id="source-status" role="status">Reviewed collection · 14 Nov 2026</p>
</section>
<section id="company-card" class="discovery-pane" role="dialog" aria-modal="false" aria-labelledby="company-name" hidden>
<div class="pane-top"><span id="company-category"></span><button id="card-close" aria-label="Close company profile">×</button></div>
<div id="company-art" aria-hidden="true"><i></i><i></i><i></i><span>AN IDEA IN MOTION</span></div>
<h2 id="company-name"></h2><p id="company-description"></p><p id="company-office" class="discovery-caption" hidden></p><p id="company-placement" class="discovery-caption"></p>
<dl id="company-facts"></dl><div id="company-jobs"></div><div class="company-links"><a id="company-website" target="_blank" rel="noopener noreferrer">Visit company ↗</a><button id="company-pin">Find in city</button></div>
<p class="discovery-caption"><a id="company-source" target="_blank" rel="noopener noreferrer">Company source ↗</a> · <span id="company-reviewed"></span></p><p id="company-source-state" class="discovery-caption"></p>
</section>
<div id="discovery-pins" aria-label="Company map markers"></div>
<div id="discovery-clusters" aria-label="Grouped map markers"></div>
<section id="map-cluster" class="discovery-pane" aria-label="Companies in this area" hidden>
<div class="pane-top"><span id="map-cluster-title"></span><button id="cluster-close" aria-label="Close company group">×</button></div>
<div id="map-cluster-companies"></div>
</section>
<button id="discover-nearby" hidden></button>
<div class="discovery-location"><span>RAUTATIENTORI</span><strong>The city is full of ideas.</strong><small id="discovery-count">Ride up to a glowing exhibit to discover one.</small></div>
<div id="discovery-navigation" hidden></div>
<div id="map-note" hidden><strong>Helsinki startup map</strong><span><i class="office-key"></i> Verified office <i class="exhibit-key"></i> In-game exhibit</span></div>
`;
document.body.append(panel);
const environmentButtons = document.querySelectorAll<HTMLButtonElement>("button[data-environment]");
function syncEnvironment(mode: Snapshot["environment"]) {
  for (const button of environmentButtons) {
    button.disabled = false;
    button.setAttribute("aria-pressed", String(button.dataset.environment === mode));
  }
  document.getElementById("discovery-season")!.textContent =
    mode === "autumn" ? "HELSINKI / AUTUMN WOOD" : "HELSINKI / NORTHERN LIGHTS";
}
for (const button of environmentButtons) {
  button.onclick = () => {
    const mode = button.dataset.environment as Snapshot["environment"];
    if (engine?.setEnvironment(mode)) syncEnvironment(mode);
    button.blur();
  };
  // Space/Enter select a painting without also starting a ride or a jump.
  button.addEventListener("keydown", event => event.stopPropagation());
}
const el = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
let engine: Engine,
  companies: Company[] = [],
  filtered: Company[] = [],
  selected: Company | undefined,
  nearest: Company | undefined,
  mapOpen = false;
let discoveries = new Set<string>();
try {
  const saved = JSON.parse(
    localStorage.getItem("webworld-discoveries-v1") || "[]",
  );
  if (Array.isArray(saved))
    discoveries = new Set(saved.filter((x) => typeof x === "string"));
} catch {}
let observations: Record<string, { checkedAt: string; changed: boolean }> = {};
const search = el("discovery-search"),
  card = el("company-card"),
  clusterCard = el("map-cluster"),
  query = el<HTMLInputElement>("company-query");
const clusterButtons = new Map<string, HTMLButtonElement>();
function focusGame() {
  engine?.setUIFocus(mapOpen || !card.hidden || !search.hidden);
  window.dispatchEvent(new Event("blur"));
}
function toggleSearch(open: boolean) {
  search.hidden = !open;
  if (open) {
    card.hidden = true;
    clusterCard.hidden = true;
    query.focus();
  } else query.blur();
  focusGame();
}
function setMap(open: boolean) {
  mapOpen = open;
  if (!open) clusterCard.hidden = true;
  engine?.setMap(open);
  el("map-toggle").setAttribute("aria-pressed", String(open));
  el("map-note").hidden = !open;
  panel.classList.toggle("city-view", open);
  focusGame();
}
function companyButton(company: Company, subtitle: string) {
  const button = document.createElement("button");
  button.className = "company-result";
  button.style.setProperty("--company", company.color);
  const name = document.createElement("strong");
  name.textContent = company.name;
  const detail = document.createElement("span");
  detail.textContent = subtitle;
  button.append(name, detail);
  button.onclick = () => openCompany(company);
  return button;
}
function updateFilters() {
  clusterCard.hidden = true;
  filtered = filterCompanies(
    companies,
    query.value,
    el<HTMLSelectElement>("company-sector").value,
    el<HTMLInputElement>("company-hiring").checked,
  );
  engine?.setMatches(filtered.map((c) => c.id));
  el("result-count").textContent =
    `${filtered.length} ${filtered.length === 1 ? "company" : "companies"}`;
  el("company-results").replaceChildren(
    ...filtered.map((c) =>
      companyButton(c, c.sector + (activeJobs(c).length ? " · Hiring" : "")),
    ),
  );
  if (!filtered.length)
    el("company-results").textContent =
      "No verified matches. Try another sector or clear the hiring filter.";
}
function openCompany(c: Company) {
  selected = c;
  search.hidden = true;
  clusterCard.hidden = true;
  card.hidden = false;
  engine.selectCompany(c.id);
  card.style.setProperty("--company", c.color);
  el("company-name").textContent = c.name;
  el("company-category").textContent = c.sector.toUpperCase();
  el("company-description").textContent = c.description;
  el("company-placement").textContent = c.placement.label;
  const office = el("company-office");
  office.replaceChildren();
  office.hidden = !c.office;
  if (c.office) {
    const source = document.createElement("a");
    source.href = c.office.sourceUrl;
    source.target = "_blank";
    source.rel = "noopener noreferrer";
    source.textContent = `${c.office.address} ↗`;
    office.append("Verified office · ", source);
  }
  el("company-facts").replaceChildren();
  for (const [label, value] of [
    ["Founders", c.founders?.join(", ") || "Not yet verified"],
    ["Team", c.teamSize || "Not yet verified"],
  ]) {
    const dt = document.createElement("dt"),
      dd = document.createElement("dd");
    dt.textContent = label;
    dd.textContent = value;
    el("company-facts").append(dt, dd);
  }
  if (c.teamSource) {
    const a = document.createElement("a");
    a.href = c.teamSource;
    a.textContent = "Team source ↗";
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    el("company-facts").append(a);
  }
  const jobs = activeJobs(c);
  el("company-jobs").replaceChildren();
  if (!jobs.length)
    el("company-jobs").textContent =
      "No currently verified vacancies in this collection. See the company website for opportunities.";
  for (const job of jobs) {
    const a = document.createElement("a");
    a.href = job.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.textContent = `${job.title} ↗ · ${job.location} · Closes ${job.expiresAt.slice(0, 10)}`;
    el("company-jobs").append(a);
  }
  el<HTMLAnchorElement>("company-website").href = c.website;
  el<HTMLAnchorElement>("company-source").href = c.sourceUrl;
  el("company-reviewed").textContent = `Facts reviewed ${c.reviewedAt}`;
  const observation = observations[c.id];
  el("company-source-state").textContent = observation
    ? `Source checked ${new Date(observation.checkedAt).toLocaleString()}. ${observation.changed ? "Page changed; facts await review." : "No change detected since the stored source check."}`
    : "Saved research snapshot. Not a live hiring guarantee.";
  focusGame();
  el("card-close").focus();
}
function closeCard() {
  card.hidden = true;
  focusGame();
  el("discover-toggle").focus();
}
function showCompanyGroup(group: Company[]) {
  card.hidden = true;
  search.hidden = true;
  el("map-cluster-title").textContent = `${group.length} companies in this area`;
  el("map-cluster-companies").replaceChildren(
    ...group.map((company) => companyButton(
      company,
      company.office?.address ?? "Rautatientori exhibit",
    )),
  );
  clusterCard.hidden = false;
  el("cluster-close").focus();
}

function updateMapMarkers(playing: boolean) {
  const groups: { companies: Company[]; x: number; y: number }[] = [];
  for (const company of filtered) {
    if (!playing || (!mapOpen && selected?.id !== company.id)) continue;
    const point = engine.projectCompany(company.id);
    if (!point?.visible) continue;
    const group = mapOpen && groups.find(({ x, y }) =>
      Math.abs((x - point.x) * window.innerWidth) < 100 &&
      Math.abs((y - point.y) * window.innerHeight) < 68);
    if (group) {
      const n = group.companies.length;
      group.x = (group.x * n + point.x) / (n + 1);
      group.y = (group.y * n + point.y) / (n + 1);
      group.companies.push(company);
    } else groups.push({ companies: [company], x: point.x, y: point.y });
  }

  const visible = new Set<HTMLButtonElement>();
  for (const { companies: group, x, y } of groups) {
    let button: HTMLButtonElement;
    if (group.length === 1) {
      const [company] = group;
      button = el<HTMLButtonElement>(`map-pin-${company.id}`);
      button.dataset.kind = mapOpen && company.office ? "office" : "exhibit";
      button.title = (mapOpen && company.office?.address) || "Rautatientori exhibit";
    } else {
      const key = group.map((company) => company.id).join("/");
      button = clusterButtons.get(key) ?? document.createElement("button");
      if (!clusterButtons.has(key)) {
        button.className = "company-cluster";
        button.textContent = String(group.length);
        button.setAttribute("aria-label", `Show ${group.length} companies in this area`);
        button.onclick = () => showCompanyGroup(group);
        clusterButtons.set(key, button);
        el("discovery-clusters").append(button);
      }
    }
    visible.add(button);
    button.hidden = false;
    button.style.left = `${x * 100}%`;
    button.style.top = `${y * 100}%`;
  }
  for (const button of el("discovery-pins").querySelectorAll("button")) {
    button.hidden = !visible.has(button);
  }
  for (const [key, button] of clusterButtons) {
    if (visible.has(button)) continue;
    button.remove();
    clusterButtons.delete(key);
  }
}
function update(s: Snapshot) {
  const playing = s.state === "ride";
  panel.classList.toggle("playing", playing);
  panel.classList.toggle("theater", el("hud").classList.contains("theater"));
  if (!playing) {
    if (mapOpen) setMap(false);
    card.hidden = true;
    search.hidden = true;
  }
  nearest = undefined;
  let best = 24;
  for (const c of filtered) {
    const d = Math.hypot(c.placement.gx - s.gx, c.placement.gz - s.gz, s.y);
    if (d < best) {
      best = d;
      nearest = c;
    }
  }
  if (playing && nearest && !discoveries.has(nearest.id)) {
    discoveries.add(nearest.id);
    try {
      localStorage.setItem(
        "webworld-discoveries-v1",
        JSON.stringify([...discoveries]),
      );
    } catch {}
  }
  const near = el<HTMLButtonElement>("discover-nearby");
  near.hidden =
    !playing || !nearest || !card.hidden || !search.hidden || mapOpen;
  if (nearest) near.textContent = `R  ·  Discover ${nearest.name}`;
  el("discovery-count").textContent =
    `${companies.filter((c) => discoveries.has(c.id)).length} / ${companies.length} discovered · No rush. Just explore.`;
  el("discovery-navigation").hidden =
    !selected || !playing || mapOpen || !card.hidden;
  if (selected)
    el("discovery-navigation").textContent =
      `${selected.name} · ${Math.round(Math.hypot(selected.placement.gx - s.gx, selected.placement.gz - s.gz))} m · Rautatientori exhibit`;
  updateMapMarkers(playing);
}
el("discover-toggle").onclick = () => toggleSearch(search.hidden);
el("search-close").onclick = () => toggleSearch(false);
el("map-toggle").onclick = () => {
  card.hidden = true;
  search.hidden = true;
  setMap(!mapOpen);
};
el("card-close").onclick = closeCard;
el("cluster-close").onclick = () => {
  clusterCard.hidden = true;
  el("map-toggle").focus();
};
el("company-pin").onclick = () => {
  closeCard();
  setMap(true);
};
el("discover-nearby").onclick = () => {
  if (nearest) openCompany(nearest);
};
query.oninput = updateFilters;
el("company-sector").onchange = updateFilters;
el("company-hiring").onchange = updateFilters;
el("source-refresh").onclick = async () => {
  const button = el<HTMLButtonElement>("source-refresh");
  button.disabled = true;
  el("source-status").textContent = "Checking official sources…";
  try {
    const response = await fetch("/api/startups/refresh", {
      method: "POST",
      signal: AbortSignal.timeout(75000),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    observations = data.observations;
    engine.setSourceChanges(
      Object.keys(observations).filter((id) => observations[id].changed),
    );
    el("source-status").textContent = data.message;
  } catch (error) {
    el("source-status").textContent =
      error instanceof Error
        ? error.message
        : "Source check unavailable. Saved collection remains available.";
  } finally {
    button.disabled = false;
  }
};
window.addEventListener(
  "keydown",
  (event) => {
    if (event.target instanceof HTMLElement && event.target.closest("button[data-environment]")) return;
    if (!engine || engine.getSnapshot().state !== "ride") return;
    if (event.code === "Escape" && !clusterCard.hidden) {
      event.stopImmediatePropagation();
      el("cluster-close").click();
      return;
    }
    if (
      event.code === "Escape" &&
      (!card.hidden || !search.hidden || mapOpen)
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      card.hidden = true;
      toggleSearch(false);
      setMap(false);
      return;
    }
    if (
      event.target instanceof HTMLInputElement ||
      event.target instanceof HTMLSelectElement ||
      !card.hidden ||
      !search.hidden
    ) {
      event.stopImmediatePropagation();
      return;
    }
    if (
      event.code === "Slash" ||
      event.code === "KeyV" ||
      event.code === "KeyR"
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat) return;
      if (event.code === "Slash") toggleSearch(true);
      if (event.code === "KeyV") setMap(!mapOpen);
      if (event.code === "KeyR" && nearest) openCompany(nearest);
    }
    if (mapOpen || event.code === "Enter") event.stopImmediatePropagation();
  },
  true,
);
window.addEventListener("webworld-ready", () => {
  void (async () => {
    engine = window.__webworldEngine;
    syncEnvironment(engine.getSnapshot().environment);
    try {
      const response = await fetch("/data/startups/companies.json");
      companies = companiesSchema.parse(await response.json());
      engine.configureCompanies(companies);
      for (const sector of [
        ...new Set(companies.map((c) => c.sector)),
      ].sort()) {
        const o = document.createElement("option");
        o.value = sector;
        o.textContent = sector;
        el("company-sector").append(o);
      }
      for (const c of companies) {
        const b = document.createElement("button");
        b.id = `map-pin-${c.id}`;
        b.hidden = true;
        b.dataset.id = c.id;
        b.dataset.kind = c.office ? "office" : "exhibit";
        b.setAttribute("aria-label", c.name);
        b.title = c.office?.address ?? "Rautatientori exhibit";
        const badge = document.createElement("span");
        badge.className = "map-pin-badge";
        const words = c.name.split(/\s+/);
        badge.textContent = (words.length > 1
          ? words[0][0] + words[1][0]
          : c.name.slice(0, 2)).toUpperCase();
        const label = document.createElement("span");
        label.className = "map-pin-label";
        label.textContent = c.name;
        b.append(badge, label);
        b.style.setProperty("--company", c.color);
        b.onclick = () => openCompany(c);
        el("discovery-pins").append(b);
      }
      updateFilters();
      engine.subscribe(update);
      update(engine.getSnapshot());
      window.__webworld = {
        getDiscovery: () => ({
          selected: selected?.id,
          nearest: nearest?.id,
          mapOpen,
          discovered: [...discoveries],
          companies: companies.length,
          matches: filtered.map((c) => c.id),
        }),
      };
      void fetch("/api/startups/")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => {
          observations = d.observations || {};
        })
        .catch(() => {});
      void fetch("/api/startups/exhibits")
        .then((r) => (r.ok ? r.json() : Promise.reject()))
        .then((d) => engine.setExhibitMedia(d))
        .catch(() => {});
    } catch {
      el("fatal").textContent =
        "The company collection could not load. Please reload.";
      el("fatal").classList.remove("hidden");
    }
  })();
});
const gameScript = document.createElement("script");
gameScript.type = "module";
gameScript.src = "/engine/game.js";
gameScript.onerror = () => {
  el("fatal").textContent = "WEBWORLD could not load. Reload to try again.";
  el("fatal").classList.remove("hidden");
};
document.head.append(gameScript);
