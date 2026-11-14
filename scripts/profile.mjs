// Development helper: measures frame times, long tasks and hot functions in typical flows.
import { chromium } from "playwright";
const base = process.env.STARTUP_CITY_URL || "http://127.0.0.1:5179";
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const cdp = await page.context().newCDPSession(page);
await page.addInitScript(() => {
  window.__long = [];
  new PerformanceObserver((list) => { for (const e of list.getEntries()) window.__long.push({ at: Math.round(e.startTime), ms: Math.round(e.duration) }); }).observe({ type: "longtask", buffered: true });
});
const t0 = Date.now();
await page.goto(base + "/?nointro");
await page.waitForFunction(() => !!window.__startupCity?.scene && window.__startupCity.store.getState().loaded, null, { timeout: 120000 });
console.log("ready after", Date.now() - t0, "ms");
const frames = (label, ms) => page.evaluate(async ([label, ms]) => {
  const times = []; let last = performance.now(); const end = last + ms;
  await new Promise((done) => { const f = (t) => { times.push(t - last); last = t; t < end ? requestAnimationFrame(f) : done(); }; requestAnimationFrame(f); });
  times.sort((a, b) => a - b);
  const q = (p) => Math.round(times[Math.floor(times.length * p)]);
  return `${label}: ${times.length} frames, median ${q(0.5)} ms, p95 ${q(0.95)} ms, worst ${Math.round(times[times.length - 1])} ms`;
}, [label, ms]);
const longTasks = async (label) => { const l = await page.evaluate(() => { const v = window.__long; window.__long = []; return v; }); console.log(`  long tasks ${label}:`, l.length, l.sort((a, b) => b.ms - a.ms).slice(0, 5).map((x) => x.ms + "ms").join(" ")); };
await longTasks("loading");
await page.click("#enter");
await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "free", null, { timeout: 60000 });
await page.waitForTimeout(3000);
await longTasks("entering");
if (process.env.CPU) { await cdp.send("Profiler.enable"); await cdp.send("Profiler.start"); }
console.log(await frames("city view idle", 4000));
await page.evaluate(() => { window.__startupCity.store.setState({ connectionsOn: true }); });
console.log(await frames("city view, connections on", 4000));
await page.evaluate(() => { window.__startupCity.store.setState({ connectionsOn: false }); });
await longTasks("city view");
await page.evaluate(() => { const st = window.__startupCity.store.getState(); const t = st.startups.find((s) => s.id === "supercell") ?? st.startups.find((s) => s.location); st.select(t.location.buildingId, t.id, null); st.setMode("street"); st.select(null); });
await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride", null, { timeout: 30000 });
await page.waitForTimeout(1500);
await longTasks("drop to street");
await page.evaluate(() => { const st = window.__startupCity.store.getState(); st.navigateTo(st.startups.find((s) => s.id === "saidot").id); });
await page.keyboard.down("KeyW");
console.log(await frames("street, riding with a route", 6000));
await page.keyboard.up("KeyW");
await longTasks("street with route");
if (process.env.CPU) { const { profile } = await cdp.send("Profiler.stop");
const self = new Map(); const byId = new Map(profile.nodes.map((n) => [n.id, n]));
const dt = profile.timeDeltas; profile.samples.forEach((id, i) => { const n = byId.get(id); const key = `${n.callFrame.functionName || "(anon)"} ${n.callFrame.url.split("/").pop()}:${n.callFrame.lineNumber}`; self.set(key, (self.get(key) || 0) + (dt[i] || 0)); });
console.log("hot functions (self ms):"); [...self.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18).forEach(([k, v]) => console.log("  ", Math.round(v / 1000), k)); }
await browser.close();
