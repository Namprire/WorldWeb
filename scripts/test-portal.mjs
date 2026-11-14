import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, writeFile, rename } from "node:fs/promises";
const base = process.env.WEBWORLD_URL || "http://127.0.0.1:5179";
await mkdir("output/webworld/portal", { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true }),
  errors = [],
  checks = [];
function watch(page) {
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error" && /WebGL|THREE|shader|GL_INVALID/i.test(m.text()))
      errors.push(m.text());
  });
}
const check = (name, ok) => {
  assert.ok(ok, name);
  checks.push(name);
  console.log("PASS", name);
};
const load = async (p) => {
  await p.goto(base);
  await p.waitForFunction(() => !!window.__webworld);
  await p.waitForFunction(
    () =>
      Number(getComputedStyle(document.getElementById("loading")).opacity) <
      0.01,
  );
};
try {
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    ...(process.env.PORTAL_VIDEO === "1"
      ? {
          recordVideo: {
            dir: "output/webworld/portal",
            size: { width: 1280, height: 800 },
          },
        }
      : {}),
  });
  const page = await context.newPage();
  watch(page);
  await load(page);
  await page.screenshot({ path: "output/webworld/portal/00-gallery.png" });
  const stillBefore = await page.locator('#gl').screenshot();
  await page.waitForTimeout(700);
  check('Title artwork stays pixel-still before starting', stillBefore.equals(await page.locator('#gl').screenshot()));
  const original = await page.locator("#frame-lip").boundingBox();
  await page.click("#enter");
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#gallery").dataset.portalProgress) > 0.14,
  );
  check('Artwork starts moving during entry', !stillBefore.equals(await page.locator('#gl').screenshot()));
  let frame = await page.locator("#frame-lip").boundingBox();
  check(
    "Live city remains the title content as the frame moves away",
    frame.width > original.width * 1.1 &&
      (await page
        .locator("#gallery")
        .evaluate(
          (e) =>
            e.dataset.presentation === "live-scene" &&
            Number(e.dataset.paintingMix) === 0,
        )),
  );
  check(
    "Start controls cannot intercept the transition",
    await page.locator("#gallery").evaluate((e) => e.inert),
  );
  check(
    "HUD stays hidden during entry",
    !(await page
      .locator("#webworld")
      .evaluate((e) => e.classList.contains("playing"))),
  );
  await page.screenshot({ path: "output/webworld/portal/01-push-in.png" });
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#gallery").dataset.portalProgress) > 0.6,
  );
  await page.screenshot({ path: "output/webworld/portal/02-live-city.png" });
  await page.waitForFunction(
    () =>
      Number(document.querySelector("#gallery").dataset.portalProgress) > 0.99,
  );
  frame = await page.locator("#frame-lip").boundingBox();
  check(
    "Painting expands beyond every viewport edge",
    frame.x < 0 &&
      frame.y < 0 &&
      frame.x + frame.width > 1440 &&
      frame.y + frame.height > 900,
  );
  await page.waitForFunction(
    () => document.querySelector("#gallery").dataset.paintingMix === "0.0000",
  );
  check(
    "The same rendered city continues into the camera dive",
    await page.evaluate(
      () => window.__webworldEngine.getSnapshot().state === "dive",
    ),
  );
  await page.screenshot({ path: "output/webworld/portal/03-camera-dive.png" });
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "ride",
    null,
    { timeout: 25000 },
  );
  await page.keyboard.down("s");
  await page.waitForTimeout(800);
  await page.keyboard.up("s");
  await page.screenshot({ path: "output/webworld/portal/04-playing.png" });
  check(
    "Playable scene is visible after transition",
    await page
      .locator("#webworld")
      .evaluate((e) => e.classList.contains("playing")),
  );
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "title",
    null,
    { timeout: 20000 },
  );
  check(
    "Return restores the framed painting and keyboard focus",
    (await page
      .locator("#gallery")
      .evaluate((e) => !e.inert && e.dataset.portalProgress === "0.0000")) &&
      (await page
        .locator("#enter")
        .evaluate((e) => document.activeElement === e)),
  );
  await page.screenshot({ path: "output/webworld/portal/05-return.png" });
  await page.waitForTimeout(300);
  const returnedStill = await page.locator('#gl').screenshot();
  await page.waitForTimeout(700);
  check('Returning to the title freezes the artwork again', returnedStill.equals(await page.locator('#gl').screenshot()));
  check('Discovery HUD hides on return despite the paused clock', !(await page.locator('#webworld').evaluate(e=>e.classList.contains('playing'))));
  await page.keyboard.press("Enter");
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "ride",
    null,
    { timeout: 25000 },
  );
  check("The transition replays on a second entry", true);
  const video = page.video();
  await context.close();
  if (video)
    await rename(await video.path(), "output/webworld/portal-transition.webm");
  const phone = await browser.newPage({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  watch(phone);
  await load(phone);
  await phone.click("#enter");
  await phone.waitForFunction(
    () =>
      Number(document.querySelector("#gallery").dataset.portalProgress) > 0.99,
  );
  const mobileFrame = await phone.locator("#frame-lip").boundingBox();
  check(
    "Portrait entry fills the screen without gallery gaps",
    mobileFrame.x < 0 &&
      mobileFrame.y < 0 &&
      mobileFrame.x + mobileFrame.width > 390 &&
      mobileFrame.y + mobileFrame.height > 844,
  );
  await phone.screenshot({
    path: "output/webworld/portal/06-mobile-entry.png",
  });
  await phone.close();
  const reduced = await browser.newPage({
    viewport: { width: 1280, height: 800 },
    reducedMotion: "reduce",
  });
  watch(reduced);
  await load(reduced);
  await reduced.click("#enter");
  await reduced.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "ride",
    null,
    { timeout: 3000 },
  );
  check("Reduced motion skips the long camera dive", true);
  await reduced.keyboard.press("Escape");
  await reduced.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "title",
    null,
    { timeout: 3000 },
  );
  check("Reduced motion also skips the return flight", true);
  check("No runtime or shader errors", errors.length === 0);
  await writeFile(
    "output/webworld/portal/checks.json",
    JSON.stringify({ checks, errors }, null, 2),
  );
} finally {
  await browser.close();
}
