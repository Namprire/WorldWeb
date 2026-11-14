// Captures the README screenshots and hero clip from a running dev server (npm run dev).
// Output: docs/images/. Run: node scripts/dev/capture-media.mjs
import { chromium, devices } from "playwright";
import { mkdir } from "node:fs/promises";
const base = process.env.STARTUP_CITY_URL || "http://127.0.0.1:5179";
const out = "docs/images";
await mkdir(out, { recursive: true });
await mkdir("output/media", { recursive: true });
const noHowTo = (context) => context.addInitScript(() => { try { localStorage.setItem('startup-city-howto', 'done') } catch {} })
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"] });
const ready = async (page, minutes = 22 * 60) => {
  await page.goto(`${base}/?nointro`, { timeout: 120000 });
  await page.waitForFunction(() => !!window.__startupCity?.scene && window.__startupCity.store.getState().loaded, null, { timeout: 120000 });
  await page.evaluate((m) => { localStorage.setItem("startup-city-howto", "done"); window.__startupCity.store.getState().setTime({ live: false, minutes: m }); }, minutes);
};
const enter = async (page) => {
  await page.click("#enter");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "free" && !document.body.classList.contains("sc-opening"), null, { timeout: 60000 });
  await page.waitForTimeout(1500);
};

// Hero clip: the opening flight, recorded as video.
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: "output/media", size: { width: 1280, height: 720 } } });
  await noHowTo(context);
  const page = await context.newPage();
  await ready(page);
  await page.click("#enter");
  await page.waitForFunction(() => !document.body.classList.contains("sc-opening") && window.__webworldEngine.getSnapshot().state === "free", null, { timeout: 60000 });
  await page.waitForTimeout(2500);
  await context.close();
  console.log("hero video:", await page.video().path());
}

// Stills
{
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, reducedMotion: "reduce" });
  await noHowTo(context);
  const page = await context.newPage();
  await ready(page);
  await enter(page);
  await page.screenshot({ path: `${out}/city-night.jpg`, type: "jpeg", quality: 84 });
  await page.click(".sc-side-list >> text=Junction 2026 partners");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/partners.jpg`, type: "jpeg", quality: 84 });
  await page.click(".sc-side-list >> text=Junction 2026 partners");
  await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((s) => s.id === "verda"); st.select(t.location.buildingId, t.id, null); window.__startupCity.scene.focusBuilding(t.location.buildingId, 300); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/profile.jpg`, type: "jpeg", quality: 84 });
  await page.evaluate(() => window.__startupCity.store.getState().select(null));
  await page.evaluate(() => { window.__startupCity.store.getState().setTime({ minutes: 13 * 60 }); window.__startupCity.scene.flyTo({ tx: 150, tz: 250, dist: 420, pitch: 0.36, yaw: 0.6 }, 0.01); });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${out}/city-day.jpg`, type: "jpeg", quality: 84 });
  await page.evaluate(() => { const st = window.__startupCity.store.getState(); st.setTime({ minutes: 16 * 60 + 10 }); const a = st.startups.find((s) => s.id === "supercell"); st.select(a.location.buildingId, a.id, null); st.setMode("street"); st.select(null); });
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride", null, { timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.evaluate(() => window.__startupCity.store.getState().navigateTo("saidot"));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${out}/street.jpg`, type: "jpeg", quality: 84 });
  await page.evaluate(() => { window.__startupCity.store.getState().clearRoute(); window.__startupCity.store.getState().setTime({ minutes: 22 * 60 }); });
  await page.keyboard.press("Tab");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "free", null, { timeout: 30000 });
  await page.waitForTimeout(1500);
  await page.evaluate(() => window.__startupCity.store.getState().playCutscene({ kind: "intro" }));
  await page.waitForSelector(".sc-film", { timeout: 60000 });
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${out}/cutscene.jpg`, type: "jpeg", quality: 84 });
  await page.context().close();
}

// Phone
{
  const context = await browser.newContext({ ...devices["Pixel 7"], reducedMotion: "reduce" });
  await noHowTo(context);
  const page = await context.newPage();
  await ready(page);
  await enter(page);
  await page.screenshot({ path: "output/media/phone-1.png" });
  await page.tap(".sc-collapse");
  await page.waitForTimeout(500);
  await page.screenshot({ path: "output/media/phone-2.png" });
  await page.context().close();
}
await browser.close();
