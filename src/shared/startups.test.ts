import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { companiesSchema, filterCompanies, activeJobs } from "./startups";
const companies = companiesSchema.parse(
  JSON.parse(
    readFileSync(
      new URL("../../public/data/startups/companies.json", import.meta.url),
      "utf8",
    ),
  ),
);
test("curated collection has unique identities, safe sources and honest locations", () => {
  assert.equal(companies.length, 10);
  assert.equal(new Set(companies.map((c) => c.id)).size, 10);
  assert.ok(companies.every((c) => c.placement.kind === "exhibition"));
  const { meta: { bbox: [west, south, east, north] } } = JSON.parse(
    readFileSync(new URL("../../public/data/helsinki/map.json", import.meta.url), "utf8"),
  );
  const offices = companies.flatMap(({ office }) => office ? [office] : []);
  assert.equal(offices.length, 6);
  assert.ok(offices.every(({ lat, lon }) =>
    lat >= south && lat <= north && lon >= west && lon <= east,
  ));
  assert.equal(
    companiesSchema.safeParse([
      { ...companies[0], sourceUrl: "javascript:alert(1)" },
    ]).success,
    false,
  );
});
test("hiring claims expire and combine with sector and text filters", () => {
  const now = Date.parse("2026-11-14T12:00:00Z");
  assert.deepEqual(
    filterCompanies(companies, "finance", "Climate", true, now).map(
      (c) => c.id,
    ),
    ["solar-foods"],
  );
  assert.equal(
    filterCompanies(companies, "", "", true, Date.parse("2026-11-16")).length,
    0,
  );
  assert.equal(activeJobs(companies[0], now).length, 0);
  assert.equal(
    filterCompanies(companies, "AI", "Data & AI", false, now).length,
    2,
  );
});
