// Development helper: drives the running app and saves screenshots to output/startup-city/.
import { chromium } from "playwright";
const base = process.env.STARTUP_CITY_URL || "http://127.0.0.1:5179";
const steps = process.argv.slice(2);
const browser = await chromium.launch({ headless: true, args: ["--use-angle=gl-egl", "--ignore-gpu-blocklist", "--enable-gpu", "--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
const errors = [];
page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 300)); });
await page.goto(base);
await page.waitForFunction(() => !!window.__startupCity?.scene, null, { timeout: 120000 });
await page.waitForTimeout(1500);
const shot = async (name) => { await page.screenshot({ path: `output/startup-city/${name}.png` }); console.log("shot", name); };
for (const step of steps) {
  const [cmd, ...rest] = step.split(":");
  const arg = rest.join(":");
  if (cmd === "shot") await shot(arg);
  else if (cmd === "wait") await page.waitForTimeout(Number(arg));
  else if (cmd === "click") await page.click(arg, { timeout: 15000 });
  else if (cmd === "key") await page.keyboard.press(arg);
  else if (cmd === "type") await page.keyboard.type(arg);
  else if (cmd === "eval") console.log("eval", JSON.stringify(await page.evaluate(arg)));
}
console.log(errors.length ? "ERRORS\n" + [...new Set(errors)].join("\n") : "no page errors");
await browser.close();
