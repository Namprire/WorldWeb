import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const base = process.env.WEBWORLD_URL || "http://127.0.0.1:5179";
const browser = await chromium.launch({ channel: "chrome", headless: true });
const errors = [];
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  reducedMotion: "reduce",
});
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => {
  if (m.type() === "error" && /WebGL|shader|GL_INVALID/.test(m.text()))
    errors.push(m.text());
});
const check = (label, value) => {
  assert.ok(value, label);
  console.log("PASS", label);
};
const state = () => page.evaluate(() => window.__webworldEngine.getSnapshot());
try {
  await page.goto(base);
  await page.waitForFunction(() => !!window.__webworld);
  await page.waitForFunction(
    () =>
      Number(getComputedStyle(document.getElementById("loading")).opacity) <
      0.01,
  );
  await page.click("#enter");
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().state === "ride",
  );
  check(
    "Ten company exhibits load without mission UI",
    await page.evaluate(
      () =>
        window.__webworld.getDiscovery().companies === 10 &&
        !document.querySelector(".ww-mission"),
    ),
  );

  await page.keyboard.down("w");
  await page.waitForTimeout(3600);
  await page.keyboard.up("w");
  await page.waitForFunction(() => !!window.__webworld.getDiscovery().nearest);
  await page.keyboard.press("r");
  check(
    "R opens a nearby exhibit while riding",
    await page.locator("#company-card").isVisible(),
  );
  await page.keyboard.press("Escape");
  await page.click("#discover-toggle");
  await page.fill("#company-query", "Varjo");
  check(
    "Search matches source records",
    (await page.locator(".company-result").count()) === 1,
  );
  const before = await state();
  await page.keyboard.type("www");
  const after = await state();
  check(
    "Typing does not move the scooter",
    Math.hypot(before.gx - after.gx, before.gz - after.gz) < 0.01,
  );
  await page.fill("#company-query", "Varjo");
  await page.click(".company-result");
  check(
    "Profile shows a verified office address and separates it from the exhibit",
    (await page.textContent("#company-placement")).includes("not an office") &&
      (await page.textContent("#company-office")).includes("Vuorikatu 20") &&
      (await page.getAttribute("#company-source", "href")) ===
        "https://varjo.com/company",
  );
  await page.click("#company-pin");
  await page.waitForFunction(
    () => window.__webworldEngine.getSnapshot().camera.y > 1000,
  );
  check(
    "Map view exposes the matching office tile",
    await page.locator('#map-pin-varjo[data-kind="office"]:visible').count() === 1,
  );
  await page.click("#map-pin-varjo");
  check("Office tiles open the company's profile", (await page.textContent("#company-name")) === "Varjo");
  await page.click("#discover-toggle");
  await page.fill("#company-query", "");
  await page.click("#search-close");
  await page.waitForFunction(() =>
    [...document.querySelectorAll("#discovery-pins button:not([hidden]), .company-cluster")]
      .reduce((total, marker) => total + (marker.classList.contains("company-cluster") ? Number(marker.textContent) : 1), 0) === 10,
  );
  check("All ten companies are represented as tiles or counts", true);
  await page.locator(".company-cluster:visible").first().click();
  check("A numbered marker opens a list of nearby companies",
    await page.locator("#map-cluster-companies button:visible").count() > 1);
  await page.keyboard.press("Escape");
  await page.screenshot({path:"output/webworld/discovery/startup-map.png"});
  await page.keyboard.press("Escape");
  await page.waitForFunction(
    () => !window.__webworldEngine.getSnapshot().mapOpen,
  );
  check(
    "Escape exits map without leaving game",
    (await state()).state === "ride",
  );
  await page.click("#discover-toggle");
  await page.fill("#company-query", "");
  await page.selectOption("#company-sector", "Climate");
  await page.check("#company-hiring");
  // Deterministic fixture clock is not used: seed jobs intentionally expire.
  const count = await page.locator("#company-results .company-result").count();
  check("Hiring filters never invent roles", count <= 1);
  await page.uncheck("#company-hiring");
  await page.selectOption("#company-sector", "");
  await page.fill("#company-query", "zzzzz");
  check(
    "Empty filters explain result",
    (await page.textContent("#company-results")).includes(
      "No verified matches",
    ),
  );
  await page.fill("#company-query", "");
  await page.click("#source-refresh");
  await page.waitForFunction(
    () => !document.getElementById("source-refresh").disabled,
  );
  check(
    "Source refresh reports a result",
    (await page.textContent("#source-status")).length > 20,
  );
  await page.click("#search-close");
  await page.keyboard.press("f");
  check("Walking remains available", (await state()).walking);
  await page.keyboard.press("f");
  check("Scooter remount remains available", !(await state()).walking);
  await page.keyboard.down("w");
  await page.waitForTimeout(700);
  await page.keyboard.up("w");
  check("Original riding controller accelerates", (await state()).speed > 0);
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press("Space");
    await page.waitForTimeout(120);
  }
  await page.keyboard.down("Space");
  await page.waitForTimeout(1200);
  await page.keyboard.up("Space");
  check("Original flight remains available", (await state()).flying);
  await page.click("#discover-toggle");
  await page.fill("#company-query", "Aiven");
  await page.click("#company-results .company-result");
  await mkdir("output/webworld/discovery", { recursive: true });
  await page.screenshot({ path: "output/webworld/discovery/profile.png" });
  check("No runtime or shader errors", errors.length === 0);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "output/webworld/discovery/mobile.png" });
  const box = await page.locator("#company-card").boundingBox();
  check(
    "Company profile fits mobile viewport",
    box.x >= 0 && box.x + box.width <= 390,
  );
} finally {
  await browser.close();
}
