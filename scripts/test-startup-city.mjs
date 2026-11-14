// Browser checks for STARTUP CITY. Run `npm run dev` first, then `npm run test:browser`.
// Provider calls are replaced with explicit fixtures here, so the checks never spend API credits.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.STARTUP_CITY_URL || "http://127.0.0.1:5179";
await mkdir("output/startup-city", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"] });
const errors = [];
let passed = 0;
const check = (name, value) => { assert.ok(value, name); passed++; console.log("PASS", name); };
const state = (page) => page.evaluate(() => {
  const s = window.__startupCity.store.getState();
  return { mode: s.mode, entered: s.entered, selectedId: s.selectedId, filters: s.filters, search: s.search, refresh: s.refresh, dataMode: s.dataMode, near: s.near, discovered: Object.keys(s.discovered), demo: s.demo, route: s.route, connectionsOn: s.connectionsOn, panel: s.panel, loadError: s.loadError, startups: s.startups.length, engine: window.__webworldEngine.getSnapshot().state };
});
async function open(setup) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => { if (m.type() === "error" && /WebGL|shader|GL_INVALID|Maximum update/i.test(m.text())) errors.push(m.text()); });
  await setup?.(page);
  await page.goto(base);
  await page.waitForFunction(() => !!window.__startupCity?.scene && window.__startupCity.store.getState().loaded, null, { timeout: 120000 });
  return page;
}
const enter = async (page) => {
  await page.click("#enter");
  await page.waitForFunction(() => window.__startupCity.store.getState().mode === "explorer" && window.__webworldEngine.getSnapshot().state === "free", null, { timeout: 30000 });
  await page.waitForTimeout(1200);
};

try {
  // Main flow, with Gemini and Context.dev replaced by fixtures
  let page = await open(async (p) => {
    await p.route("**/api/search", (r) => r.fulfill({ json: { mode: "gemini", model: "fixture-model", filters: { industries: ["ai"], hiring: false, recentlyFunded: false, hasNews: false, keywords: [], roleKeywords: [] } } }));
    await p.route("**/api/signals/refresh", (r) => r.fulfill({ status: 503, json: { mode: "cached", error: "Context.dev is not configured on the server. Showing the cached snapshot." } }));
    await p.route("**/api/cutscene", async (r) => {
      const { kind, id } = r.request().postDataJSON();
      await new Promise((done) => setTimeout(done, 400));
      r.fulfill({ json: {
        title: kind === "company" ? "Fixture company scene" : "Fixture scene",
        shots: [
          { camera: "establish", focus: null, line: "First fixture line.", audio: null },
          { camera: kind === "company" ? "orbit" : "rise", focus: kind === "company" ? id : null, line: "Second fixture line.", audio: null },
        ],
        writer: "fixture-writer", voice: null, generatedAt: new Date().toISOString(),
      } });
    });
  });
  check("title shows STARTUP CITY and its tagline", (await page.textContent("#plaque")).includes("Discover the startups building the future"));
  check("interface stays hidden behind the title painting", await page.evaluate(() => getComputedStyle(document.getElementById("startup-city")).display === "none"));
  await enter(page);
  let s = await state(page);
  check("entering opens the bird's-eye City Explorer", s.mode === "explorer" && s.engine === "free");
  check("the full company list is loaded", s.startups >= 100);
  const markers = await page.locator(".sc-marker").count();
  check("startup buildings carry floating markers", markers >= 15);
  check("companies sharing a building are grouped", await page.locator(".sc-marker", { hasText: "Maria 01" }).count() === 1);
  await page.screenshot({ path: "output/startup-city/test-explorer.png" });

  await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((x) => x.location && x.industry === "ai"); window.__startupCity.scene.onPick(t.location.buildingId, null); });
  await page.waitForSelector(".sc-panel");
  s = await state(page);
  check("clicking a startup building opens its profile", !!s.selectedId);
  check("the visit is recorded as a discovery", s.discovered.includes(s.selectedId));
  const panel = await page.textContent(".sc-panel");
  for (const label of ["Visit website", "View jobs", "Ask Gemini", "Explore connections", "Navigate here", "Watch story", "Founded", "Founders", "People", "Funding", "Investors", "Open roles", "Recent news", "Updated"]) check(`profile shows ${label}`, panel.includes(label));
  check("facts are labelled with provenance", await page.locator(".sc-panel .sc-prov").count() > 2 && await page.locator(".sc-panel .sc-source a").count() > 0);
  await page.click(".sc-panel >> text=Navigate here");
  s = await state(page);
  check("navigation follows mapped streets", s.route && s.route.metres > 50);
  check("a route bar shows where the route goes", (await page.textContent(".sc-route-bar")).includes("Route to"));
  check("the route is handed to the minimap", await page.evaluate(() => window.__startupCity.scene.routes.length === 1));
  await page.click(".sc-route-bar >> text=Clear");
  check("Clear removes the route", (await state(page)).route === null && await page.evaluate(() => window.__startupCity.scene.routes.length === 0));
  await page.keyboard.press("Escape");
  check("Escape closes the profile", (await state(page)).selectedId === null);

  check("the Gemini question bar is hidden for now", await page.locator("#sc-query").count() === 0);
  await page.evaluate(() => window.__startupCity.scene.flyTo({ tx: 1000, tz: 1100, dist: 150 }, 0.01));
  await page.waitForTimeout(400);
  await page.click(".sc-side-list >> text=Categories");
  await page.click(".sc-side-sub >> text=AI & Data");
  s = await state(page);
  check("a category filter narrows the map", s.filters.industries.join() === "ai");
  await page.waitForTimeout(1800);
  check("choosing a filter flies out to show every match", await page.evaluate(() => window.__startupCity.scene.goal.dist > 400));
  check("non-matching buildings dim, matches highlight", await page.locator('.sc-marker[data-state="match"]').count() >= 3 && await page.locator('.sc-marker[data-state="dim"]').count() >= 5);
  await page.click(".sc-side-hint >> text=Route between them");
  check("a route links the results", "tour" in (await state(page)).route);
  await page.click(".sc-side-list >> text=Junction 2026 partners");
  check("the partner filter keeps only Junction partners lit", await page.locator('.sc-marker.partner[data-state="match"]').count() >= 4);
  await page.click(".sc-side-list >> text=All startups");
  check("partners on the map get their own marker", await page.locator(".sc-marker.partner").count() >= 4);

  // Web-map zoom: the ground under the cursor stays put
  const anchor = () => page.evaluate(() => { const g = window.__startupCity.scene.groundAt(900, 500); return g && [g.x, g.z]; });
  const anchorBefore = await anchor();
  for (let i = 0; i < 4; i++) { await page.mouse.move(900, 500); await page.mouse.wheel(0, -240); await page.waitForTimeout(60); }
  await page.waitForTimeout(1200);
  const anchorAfter = await anchor();
  check("scroll zooms towards the cursor", anchorBefore && anchorAfter && Math.hypot(anchorAfter[0] - anchorBefore[0], anchorAfter[1] - anchorBefore[1]) < 25);
  const dist = await page.evaluate(() => window.__startupCity.scene.goal.dist);
  await page.click('button[aria-label="Zoom out"]');
  await page.waitForTimeout(700);
  check("the zoom buttons work", (await page.evaluate(() => window.__startupCity.scene.goal.dist)) > dist * 1.3);

  await page.click(".sc-tools >> text=Refresh startup signals");
  await page.waitForSelector(".sc-refresh-status.error");
  check("an unavailable Context.dev is reported and the cached snapshot is named", (await page.textContent(".sc-refresh-status.error")).includes("cached snapshot") && (await state(page)).refresh.status === "error");

  await page.click(".sc-side-switch");
  check("connections separate sourced links from AI suggestions", (await page.textContent(".sc-legend-card")).includes("not verified facts"));
  await page.click('button[aria-label="Hide connections"]');

  await page.click(".sc-side-nav >> text=Live from Helsinki");
  await page.waitForSelector(".sc-feed li");
  check("the feed lists sourced headlines with a map link", await page.locator(".sc-feed li").count() > 0 && (await page.textContent(".sc-side-view")).includes("Only published headlines"));
  await page.click(".sc-back");
  await page.click(".sc-side-nav >> text=Directory");
  check("companies outside the district are listed separately", await page.waitForSelector('.sc-side-view:has-text("Outside the 3D district")', { timeout: 5000 }).then(() => true, () => false));
  await page.keyboard.press("Shift+Slash");
  check("? opens the shortcuts sheet", await page.locator(".sc-modal").count() === 1);
  await page.keyboard.press("Escape");
  await page.click(".sc-back");
  await page.click(".sc-side-nav >> text=Missions");
  await page.waitForSelector(".sc-missions");
  check("three missions with progress are shown", await page.locator(".sc-missions li").count() === 3);
  await page.keyboard.press("Escape");

  // Cutscene: company story, then skip with Escape
  await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((x) => x.location && x.industry !== "hub"); st.select(t.location.buildingId, t.id); });
  await page.waitForSelector(".sc-panel");
  await page.click(".sc-panel >> text=Watch story");
  await page.waitForSelector(".sc-cutscene .sc-subtitle:has-text('First fixture line')", { timeout: 10000 });
  check("a company story plays as a letterboxed cutscene", await page.locator(".sc-cutscene .sc-bar").count() === 2 && (await page.textContent(".sc-cut-top h2")) === "Fixture company scene");
  check("the interface is hidden and the camera is scripted during a cutscene", await page.evaluate(() => document.body.classList.contains("sc-cinema") && window.__startupCity.scene.cinematic));
  check("narration credits the model that wrote it", (await page.textContent(".sc-cut-bottom")).includes("fixture-writer"));
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => !window.__startupCity.store.getState().cutscene);
  check("Escape skips the cutscene and restores control", await page.evaluate(() => !document.body.classList.contains("sc-cinema") && !window.__startupCity.scene.cinematic));
  await page.evaluate(() => window.__startupCity.store.getState().playCutscene({ kind: "intro" }));
  await page.waitForSelector(".sc-cutscene .sc-subtitle:has-text('Second fixture line')", { timeout: 15000 });
  await page.waitForFunction(() => !window.__startupCity.store.getState().cutscene, null, { timeout: 15000 });
  check("a cutscene ends by itself after its last shot", (await state(page)).mode === "explorer");
  await page.keyboard.press("Escape");

  // Time of day: daylight replaces the aurora, night brings it back
  await page.evaluate(() => window.__startupCity.store.getState().setTime({ live: false, lapse: false, season: "today", minutes: 13 * 60 }));
  await page.waitForTimeout(600);
  const noon = await page.evaluate(() => window.__webworldEngine.visuals.getLight());
  await page.evaluate(() => window.__startupCity.store.getState().setTime({ minutes: 23 * 60 }));
  await page.waitForTimeout(600);
  const night = await page.evaluate(() => window.__webworldEngine.visuals.getLight());
  check("afternoon is daylight without aurora", noon.day > 0.6 && noon.dark < 0.05);
  check("night is dark enough for the aurora", night.dark > 0.95 && night.day < 0.05);
  await page.click(".sc-clock-pill");
  check("the clock offers the four parts of the day", (await page.textContent(".sc-clock-panel")).includes("Afternoon") && (await page.textContent(".sc-clock-panel")).includes("Midsummer"));
  await page.click(".sc-clock-pill");
  await page.evaluate(() => window.__startupCity.store.getState().setTime({ live: true }));

  // Street level
  await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((x) => x.id === "saidot") ?? st.startups.find((x) => x.location); st.select(t.location.buildingId, t.id, null); st.setMode("street"); st.select(null); });
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride", null, { timeout: 20000 });
  await page.waitForFunction(() => !!window.__startupCity.store.getState().near, null, { timeout: 10000 });
  check("Street Explorer drops the rider beside the startup", (await state(page)).mode === "street");
  await page.waitForTimeout(700);
  const position = () => page.evaluate(() => { const s = window.__webworldEngine.getSnapshot(); return [s.gx, s.gz]; });
  const before = await position();
  await page.keyboard.down("KeyW"); await page.waitForTimeout(900); await page.keyboard.up("KeyW");
  const after = await position();
  check("WASD moves the rider", Math.hypot(after[0] - before[0], after[1] - before[1]) > 0.5);
  await page.evaluate(() => window.__startupCity.store.setState({ near: window.__startupCity.store.getState().startups.find((x) => x.location).location.buildingId }));
  await page.keyboard.press("KeyE");
  s = await state(page);
  check("E visits the nearby startup", !!s.selectedId);
  await page.screenshot({ path: "output/startup-city/test-street.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "free");
  check("Tab returns to the City Explorer", (await state(page)).mode === "explorer");

  // Guided demo with presenter controls
  await page.evaluate(() => { try { localStorage.removeItem("startup-city-howto") } catch {} });
  await page.evaluate(() => window.__startupCity.store.setState({ shortcuts: true }));
  await page.keyboard.press("Escape");
  await page.click(".sc-howto >> text=Take the 90 second tour");
  await page.waitForSelector(".sc-demo");
  check("the demo starts on step 1 of 9", (await page.textContent(".sc-demo")).includes("1 of 9"));
  await page.click('button[aria-label="Next step"]'); await page.click('button[aria-label="Next step"]');
  check("Next advances", (await state(page)).demo.step === 2);
  await page.click('button[aria-label="Previous step"]');
  check("Previous goes back", (await state(page)).demo.step === 1);
  await page.click('button[aria-label="Pause"]');
  await page.waitForTimeout(11000);
  check("Pause holds the step", (await state(page)).demo.step === 1 && (await state(page)).demo.paused);
  await page.click('button[aria-label="Restart demo"]');
  check("Restart returns to the first step", (await state(page)).demo.step === 0);
  for (let i = 0; i < 8; i++) { await page.click('button[aria-label="Next step"]'); await page.waitForTimeout(700); }
  s = await state(page);
  check("the demo reaches the mission step with APIs unavailable", s.demo.step === 8 && s.panel === "missions");
  await page.screenshot({ path: "output/startup-city/test-demo.png" });
  await page.context().close();

  // API process down: the bundled snapshot is shown and labelled
  page = await open((p) => p.route("**/api/**", (r) => r.abort()));
  s = await state(page);
  check("without the API the bundled snapshot loads", s.startups >= 30 && /bundled snapshot/.test(s.loadError));
  await enter(page);
  await page.click(".sc-side-list >> text=Categories");
  await page.click(".sc-side-sub >> text=Climate");
  s = await state(page);
  check("filters work without the API", s.filters.industries.includes("climate") && await page.locator('.sc-marker[data-state="match"]').count() > 0);
  await page.context().close();

  // Phone layout
  const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce", hasTouch: true });
  page = await phone.newPage();
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(base);
  await page.waitForFunction(() => !!window.__startupCity?.scene && window.__startupCity.store.getState().loaded, null, { timeout: 120000 });
  await enter(page);
  check("phone layout has no horizontal overflow", await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
  await page.screenshot({ path: "output/startup-city/test-phone.png" });
  await phone.close();

  check("no page or shader errors", errors.length === 0 || (console.log(errors), false));
  console.log(`\n${passed} checks passed. Screenshots in output/startup-city/`);
} finally {
  await browser.close();
}
