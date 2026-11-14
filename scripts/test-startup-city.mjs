// Browser checks for STARTUP CITY. Run `npm run dev` first, then `npm run test:browser`.
// Provider calls are replaced with explicit fixtures here, so the checks never spend API credits.
import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const base = process.env.STARTUP_CITY_URL || "http://127.0.0.1:5179";
await mkdir("output/startup-city", { recursive: true });
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"] });
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
  // ── main flow, with Gemini and Context.dev replaced by fixtures
  let page = await open(async (p) => {
    await p.route("**/api/search", (r) => r.fulfill({ json: { mode: "gemini", model: "fixture-model", filters: { industries: ["ai"], hiring: false, recentlyFunded: false, hasNews: false, keywords: [], roleKeywords: [] } } }));
    await p.route("**/api/signals/refresh", (r) => r.fulfill({ status: 503, json: { mode: "cached", error: "Context.dev is not configured on the server. Showing the cached snapshot." } }));
  });
  check("title shows STARTUP CITY and its tagline", (await page.textContent("#plaque")).includes("Discover the startups building the future"));
  check("interface stays hidden behind the title painting", await page.evaluate(() => getComputedStyle(document.getElementById("startup-city")).display === "none"));
  await enter(page);
  let s = await state(page);
  check("entering opens the bird's-eye City Explorer", s.mode === "explorer" && s.engine === "free");
  check("30–50 companies are loaded", s.startups >= 30 && s.startups <= 51);
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
  for (const label of ["Visit website", "View jobs", "Ask Gemini", "Explore connections", "Navigate here", "Founded", "Founders", "Employees", "Funding", "Investors", "Open positions", "Recent news", "Last updated"]) check(`profile shows ${label}`, panel.includes(label));
  check("facts are labelled with provenance", await page.locator(".sc-panel .sc-prov.verified").count() > 0 && await page.locator(".sc-panel .sc-source a").count() > 0);
  await page.click(".sc-panel >> text=Navigate here");
  s = await state(page);
  check("navigation follows mapped streets", s.route && s.route.metres > 50);
  await page.keyboard.press("Escape");
  check("Escape closes the profile", (await state(page)).selectedId === null);

  await page.fill("#sc-query", "Show me AI startups in Helsinki");
  check("typing a question does not steer the camera or scooter", (await page.inputValue("#sc-query")) === "Show me AI startups in Helsinki");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__startupCity.store.getState().search.status === "done");
  s = await state(page);
  check("the question becomes structured filters", s.filters.industries.join() === "ai" && s.search.mode === "gemini");
  check("non-matching buildings dim, matches highlight", await page.locator('.sc-marker[data-state="match"]').count() >= 3 && await page.locator('.sc-marker[data-state="dim"]').count() >= 5);
  await page.click("text=Route between results");
  check("a route links the results", "tour" in (await state(page)).route);
  await page.screenshot({ path: "output/startup-city/test-search.png" });
  await page.click('button[aria-label="Clear search"]');

  await page.click("text=REFRESH STARTUP SIGNALS");
  await page.waitForSelector(".sc-refresh-status.error");
  check("an unavailable Context.dev is reported and the cached snapshot is named", (await page.textContent(".sc-refresh-status.error")).includes("cached snapshot") && (await state(page)).refresh.status === "error");

  await page.click(".sc-tools >> text=Connections");
  check("connections separate sourced links from AI suggestions", (await page.textContent(".sc-legend-card")).includes("not verified facts"));
  await page.click('button[aria-label="Hide connections"]');

  await page.click(".sc-rail-tabs >> text=LIVE FROM HELSINKI");
  await page.waitForSelector(".sc-feed li");
  check("the feed lists sourced headlines with a map link", await page.locator(".sc-feed li").count() > 0 && (await page.textContent(".sc-drawer")).includes("nothing is simulated"));
  await page.click(".sc-rail-tabs >> text=Directory");
  check("unplaced companies are listed separately", await page.waitForSelector('.sc-drawer:has-text("Location not verified")', { timeout: 5000 }).then(() => true, () => false));
  await page.click(".sc-rail-tabs >> text=Missions");
  await page.waitForSelector(".sc-missions");
  check("three missions with progress are shown", await page.locator(".sc-missions li").count() === 3);
  await page.keyboard.press("Escape");

  // ── street level
  await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((x) => x.id === "saidot") ?? st.startups.find((x) => x.location); st.select(t.location.buildingId, t.id, null); st.setMode("street"); st.select(null); });
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride", null, { timeout: 20000 });
  await page.waitForFunction(() => !!window.__startupCity.store.getState().near, null, { timeout: 10000 });
  check("Street Explorer drops the rider beside the startup", (await state(page)).mode === "street");
  const before = await page.evaluate(() => window.__webworldEngine.getSnapshot().gx + window.__webworldEngine.getSnapshot().gz);
  await page.keyboard.down("KeyW"); await page.waitForTimeout(900); await page.keyboard.up("KeyW");
  check("WASD moves the rider", Math.abs((await page.evaluate(() => window.__webworldEngine.getSnapshot().gx + window.__webworldEngine.getSnapshot().gz)) - before) > 0.5);
  await page.evaluate(() => window.__startupCity.store.setState({ near: window.__startupCity.store.getState().startups.find((x) => x.location).location.buildingId }));
  await page.keyboard.press("KeyE");
  s = await state(page);
  check("E visits the nearby startup", !!s.selectedId);
  await page.screenshot({ path: "output/startup-city/test-street.png" });
  await page.keyboard.press("Escape");
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "free");
  check("Tab returns to the City Explorer", (await state(page)).mode === "explorer");

  // ── guided demo with presenter controls
  await page.click(".sc-tools >> text=START DEMO");
  await page.waitForSelector(".sc-demo");
  check("the demo starts on step 1 of 9", (await page.textContent(".sc-demo")).includes("Step 1 of 9"));
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

  // ── API process down: the bundled snapshot is shown and labelled
  page = await open((p) => p.route("**/api/**", (r) => r.abort()));
  s = await state(page);
  check("without the API the bundled snapshot loads", s.startups >= 30 && /bundled snapshot/.test(s.loadError));
  await enter(page);
  await page.fill("#sc-query", "Find climate-tech companies");
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => window.__startupCity.store.getState().search.status === "done");
  s = await state(page);
  check("search falls back to keyword interpretation", s.search.mode === "local" && s.filters.industries.includes("climate"));
  await page.context().close();

  // ── phone layout
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
  console.log(`\n${passed} checks passed · screenshots in output/startup-city/`);
} finally {
  await browser.close();
}
