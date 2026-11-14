import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.WEBWORLD_URL || "http://127.0.0.1:5179";
const output = "output/webworld/environment";
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const check = (message, ok) => { assert.ok(ok, message); console.log("PASS", message); };
const state = (page) => page.evaluate(() => window.__webworldEngine.getSnapshot());
const load = async (page, suffix = "") => {
  await page.goto(base + suffix);
  await page.waitForFunction(() => !!window.__webworld);
  await page.waitForFunction(() => Number(getComputedStyle(document.getElementById("loading")).opacity) < .01);
};
function watch(page) {
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error" && /WebGL|THREE|shader|GL_INVALID/i.test(message.text())) errors.push(message.text());
  });
}
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  watch(page);
  await load(page);
  check("A fresh visit opens Autumn wood", (await state(page)).environment === "autumn");
  const autumn = await page.locator("#gl").screenshot();
  await page.waitForTimeout(450);
  check("Autumn title stays pixel still", autumn.equals(await page.locator("#gl").screenshot()));
  await page.screenshot({ path: `${output}/autumn-title.png` });
  await page.locator('#gallery [data-environment="aurora"]').press("Space");
  await page.waitForTimeout(200);
  check("Keyboard selection changes the painting without starting the ride",
    (await state(page)).environment === "aurora" && (await state(page)).state === "title");
  const aurora = await page.locator("#gl").screenshot();
  check("Northern lights and Autumn wood render different paintings", !autumn.equals(aurora));
  await page.waitForTimeout(450);
  check("Northern lights title stays pixel still", aurora.equals(await page.locator("#gl").screenshot()));
  await page.reload();
  await page.waitForFunction(() => !!window.__webworld);
  check("Environment choice survives a reload", (await state(page)).environment === "aurora");
  await page.click('#gallery [data-environment="autumn"]');
  await page.click("#enter");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride", null, { timeout: 25000 });
  await page.keyboard.down("s"); await page.waitForTimeout(700); await page.keyboard.up("s");
  check("The existing entrance reaches a playable autumn city", (await state(page)).state === "ride");
  await page.screenshot({ path: `${output}/autumn-ride.png` });
  await page.evaluate(() => window.__webworldEngine.setUIFocus(true));
  const before = await state(page);
  await page.locator('#webworld [data-environment="aurora"]').press("Enter");
  const after = await state(page);
  check("Switching environment retains location and locomotion state",
    before.gx === after.gx && before.gz === after.gz && before.y === after.y &&
    before.walking === after.walking && before.flying === after.flying && after.environment === "aurora");
  await page.screenshot({ path: `${output}/aurora-ride.png` });
  await page.evaluate(() => window.__webworldEngine.setUIFocus(false));
  await page.click('#webworld [data-environment="autumn"]');
  await page.click("#map-toggle");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().camera.y > 1000);
  check("The sourced startup atlas still opens in autumn", (await state(page)).buildings === 1301 && (await state(page)).mapOpen);
  await page.keyboard.press("Escape");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "title", null, { timeout: 20000 });
  // A canvas-element screenshot also captures the plaque layered above it.
  // Wait for its 450 ms CSS fade before comparing the frozen painting.
  await page.waitForFunction(() => document.getElementById("gallery")
    .getAnimations({ subtree: true }).every(animation => animation.playState !== "running"));
  const returned = await page.locator("#gl").screenshot();
  await page.waitForTimeout(500);
  check("Returning freezes the chosen environment again", returned.equals(await page.locator("#gl").screenshot()));
  await page.close();

  const mobile = await browser.newPage({ viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  watch(mobile);
  await load(mobile);
  const fits = async (selector) => {
    const box = await mobile.locator(selector).boundingBox();
    return box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 390 && box.y + box.height <= 844;
  };
  check("Both environment choices and Start fit a phone title screen", await fits('#gallery .environment-picker') && await fits('#enter'));
  await mobile.screenshot({ path: `${output}/mobile-title.png` });
  await mobile.click("#enter");
  await mobile.waitForFunction(() => window.__webworldEngine.getSnapshot().state === "ride");
  check("The environment switch fits the phone HUD", await fits('#webworld .environment-picker'));
  await mobile.click('#webworld [data-environment="aurora"]');
  await mobile.click('#discover-toggle');
  check("Company discovery still fits below environment controls", await fits('#discovery-search'));
  await mobile.screenshot({ path: `${output}/mobile-menu.png` });
  await mobile.close();

  const park = await browser.newPage({ viewport: { width: 1440, height: 900 }, reducedMotion: "reduce" });
  watch(park);
  await load(park, "?environment=autumn&cam=80,3,-280,10,-4,65,0");
  await park.screenshot({ path: `${output}/autumn-park.png` });
  await park.close();
  check("No shader or runtime errors in either environment", errors.length === 0);
} finally { await browser.close(); }
