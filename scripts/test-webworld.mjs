import { chromium } from "playwright";
import { getDemoEvent } from "../src/shared/demo.ts";
import { mkdir, writeFile } from "node:fs/promises";
import assert from "node:assert/strict";
const base = process.env.WEBWORLD_URL || "http://127.0.0.1:5179";
await mkdir("output/webworld", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const checks = [],
  errors = [],
  requests = [];
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (error) => errors.push(error.message));
page.on("console", (message) => {
  if (
    message.type() === "error" &&
    /WebGL|THREE|shader|GL_INVALID/i.test(message.text())
  )
    errors.push(message.text());
});
page.on("request", (request) => requests.push(request.url()));
const check = (name, value) => {
  assert.ok(value, name);
  checks.push(name);
  console.log("PASS", name);
};
try {
  await page.goto(base);
  await page.waitForFunction(() => !!window.__webworldEngine);
  await page.waitForTimeout(1300);
  check(
    "WEBWORLD title and engine load",
    (await page.title()) === "WEBWORLD — Ride the internet",
  );
  check(
    "Helsinki presentation is active",
    await page.evaluate(
      () =>
        window.__webworldEngine.getSnapshot().presentation ===
        "helsinki-aurora",
    ),
  );
  check(
    "Gallery keeps its intended landscape framing",
    await page.evaluate(async () => {
      const image = new Image();
      image.src = "/art/helsinki/arrival.png";
      await image.decode();
      const frame = document
        .querySelector("#frame-lip")
        .getBoundingClientRect();
      return (
        Math.abs(
          frame.width / frame.height - image.naturalWidth / image.naturalHeight,
        ) < 0.01
      );
    }),
  );
  await page.screenshot({ path: "output/webworld/title.png" });
  await page.locator("#enter").click();
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "ride",
    null,
    { timeout: 20_000 },
  );
  await page.waitForTimeout(300);
  await page.screenshot({ path: "output/webworld/ride.png" });
  await page.keyboard.down("w");
  await page.waitForFunction(
    () => window.__webworld.getMission().completed,
    null,
    { timeout: 12_000 },
  );
  await page.keyboard.up("w");
  const completed = await page.evaluate(() => ({
    mission: window.__webworld.getMission(),
    engine: window.__webworldEngine.getSnapshot(),
  }));
  check(
    "Keyboard riding collects both packets and completes delivery",
    completed.mission.packets === 2 &&
      completed.mission.stepIndex === 3 &&
      completed.engine.banked >= 500,
  );
  await page.screenshot({ path: "output/webworld/delivery.png" });
  await page.keyboard.down("s");
  await page.waitForTimeout(1600);
  const beforeLook = await page.evaluate(() =>
    window.__webworldEngine.getSnapshot(),
  );
  await page.mouse.move(780, 520);
  await page.mouse.down();
  await page.mouse.move(960, 550, { steps: 12 });
  await page.mouse.up();
  await page.mouse.wheel(0, 160);
  await page.waitForTimeout(500);
  const afterLook = await page.evaluate(() =>
    window.__webworldEngine.getSnapshot(),
  );
  check(
    "Original orbit/zoom camera responds while player is stopped",
    Math.hypot(
      afterLook.camera.x - beforeLook.camera.x,
      afterLook.camera.y - beforeLook.camera.y,
      afterLook.camera.z - beforeLook.camera.z,
    ) > 0.2 &&
      Math.hypot(afterLook.gx - beforeLook.gx, afterLook.gz - beforeLook.gz) <
        0.2,
  );
  await page.screenshot({ path: "output/webworld/scooter-camera.png" });
  await page.mouse.wheel(0, -160);
  await page.keyboard.press("f");
  await page.keyboard.up("s");
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().walking,
  );
  check("Original walking toggle works", true);
  await page.screenshot({ path: "output/webworld/walk.png" });
  await page.keyboard.press("f");
  await page.waitForFunction(
    () => !window.__webworldEngine.getSnapshot().walking,
  );
  check("Original remount toggle works with scooter presentation", true);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
  }
  await page.keyboard.down("Space");
  await page.waitForTimeout(1200);
  await page.keyboard.up("Space");
  check(
    "Original flight works",
    await page.evaluate(() => window.__webworldEngine.getSnapshot().flying),
  );
  await page.screenshot({ path: "output/webworld/flight.png" });
  await page.keyboard.press("t");
  await page.waitForTimeout(200);
  check(
    "Theater hides the WEBWORLD HUD",
    await page
      .locator("#webworld")
      .evaluate((e) => e.classList.contains("theater")),
  );
  await page.keyboard.press("t");
  await page.waitForTimeout(200);
  for (const [name, atmosphere, count] of [
    ["Pull the Plug", "emergency", 10],
    ["Margin Call", "market", 0],
    ["The Blue Hour", "breakthrough", 0],
  ]) {
    await page.locator("#ww-sync").click();
    await page.waitForFunction(
      (title) => window.__webworld.getMission().title === title,
      name,
    );
    const snapshot = await page.evaluate(() =>
      window.__webworldEngine.getSnapshot(),
    );
    check(
      `${name} changes mission, atmosphere and actors`,
      snapshot.atmosphere === atmosphere && snapshot.robots === count,
    );
    if (name === "Pull the Plug")
      await page.screenshot({ path: "output/webworld/robots.png" });
    else await page.screenshot({ path: `output/webworld/${atmosphere}.png` });
  }
  const missionBefore = await page.evaluate(
    () => window.__webworld.getMission().missionSerial,
  );
  await page.locator("#ww-mode").selectOption("live");
  await page.route("**/api/sync", (route) =>
    route.fulfill({
      status: 503,
      json: {
        error:
          "Live Mode needs GEMINI_API_KEY and CONTEXT_DEV_API_KEY on the server.",
      },
    }),
  );
  await page.locator("#ww-sync").click();
  await page.waitForFunction(
    () => !document.getElementById("ww-sync").disabled,
  );
  check(
    "Missing credentials are visible and preserve the current mission",
    (await page
      .locator("#ww-status")
      .textContent()
      .then((t) => t.includes("API_KEY"))) &&
      (await page.evaluate(
        () => window.__webworld.getMission().missionSerial,
      )) === missionBefore,
  );
  // Exercise the integration boundary with an explicit test response, without claiming a live provider call.
  await page.unroute("**/api/sync");
  const fixture = getDemoEvent(0);
  fixture.news = {
    ...fixture.news,
    mode: "live",
    sourceName: "Integration test",
    sourceUrl: "https://example.org/test-headline",
    headline: "Controlled integration test headline",
  };
  await page.route("**/api/sync", (route) => route.fulfill({ json: fixture }));
  await page.locator("#ww-sync").click();
  await page.waitForFunction(
    () => !document.getElementById("ww-sync").disabled,
  );
  check(
    "Validated API response applies and shows source link",
    (await page.locator("#ww-source-link").getAttribute("href")) ===
      fixture.news.sourceUrl &&
      (await page.locator("#ww-title").textContent()) === "Pull the Plug",
  );
  await page.unroute("**/api/sync");
  await page.route("**/api/sync", (route) =>
    route.fulfill({ json: { scenario: { mission: { title: "INVALID" } } } }),
  );
  const serial = await page.evaluate(
    () => window.__webworld.getMission().missionSerial,
  );
  await page.locator("#ww-sync").click();
  await page.waitForFunction(
    () => !document.getElementById("ww-sync").disabled,
  );
  check(
    "Invalid API output is rejected without replacing the mission",
    (await page.evaluate(
      () => window.__webworld.getMission().missionSerial,
    )) === serial &&
      (await page
        .locator("#ww-status")
        .textContent()
        .then((t) => t.includes("unsupported"))),
  );
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    screen: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  const phone = await mobile.newPage();
  phone.on("pageerror", (e) => errors.push(e.message));
  await phone.goto(base + "/?ride");
  await phone.waitForFunction(
    () => window.__webworldEngine?.getSnapshot().state === "ride",
  );
  await phone.waitForTimeout(2000);
  check(
    "Mobile layout fits the viewport",
    await phone.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  );
  await phone.locator("#ww-collapse").click();
  check(
    "Mobile signal panel collapses",
    await phone
      .locator("#webworld")
      .evaluate((e) => e.classList.contains("feed-collapsed")),
  );
  await phone.screenshot({ path: "output/webworld/mobile.png" });
  await mobile.close();
  check("No runtime exceptions", errors.length === 0);
  check(
    "Gameplay only requests local resources",
    requests.every((url) => new URL(url).origin === new URL(base).origin),
  );
  await writeFile(
    "output/webworld/checks.json",
    JSON.stringify({ checks, errors, completed, requests }, null, 2),
  );
} finally {
  await browser.close();
}
