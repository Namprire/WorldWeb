import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  mapData,
  project,
  inPolygon,
  districtProbe,
  isWater,
  collisionBuildings,
} from "../public/engine/helsinki-geography.js";
const source = JSON.parse(
  await readFile("data/map/source.osm.json", "utf8"),
);
assert.deepEqual(project(...mapData.meta.origin), [0, 0]);
assert.ok(mapData.buildings.length > 1000);
for (const lm of mapData.landmarks) {
  const feature = mapData.buildings.find((b) => b.id === lm.id),
    original = source.elements.find((e) => `${e.type}/${e.id}` === lm.id);
  assert.ok(original, "Landmark must have a source feature");
  for (const p of feature.rings[0])
    assert.ok(
      original.geometry.some(
        (q) =>
          Math.hypot(
            project(q.lon, q.lat)[0] - p[0],
            project(q.lon, q.lat)[1] - p[1],
          ) < 0.02,
      ),
      "Landmark footprint retains source coordinates",
    );
}
assert.equal(
  isWater(...project(24.956, 60.166)),
  true,
  "South Harbour follows the sea side of the real coastline",
);
assert.equal(
  isWater(...project(24.9415, 60.171)),
  false,
  "Railway station remains on land",
);
for (const name of ["Aleksanterinkatu", "Mannerheimintie"])
  assert.ok(mapData.roads.some((r) => r.name === name));
for (const b of mapData.buildings) {
  assert.ok(b.triangles.length > 0);
  assert.ok(
    ["height", "register-floors", "levels-estimate", "fallback-estimate"].includes(b.heightSource),
  );
  const vertices = b.rings.flat();
  for (const t of b.triangles) {
    const p = t.map((i) => vertices[i]);
    const x = p.reduce((v, p) => v + p[0], 0) / 3,
      z = p.reduce((v, p) => v + p[1], 0) / 3;
    assert.ok(
      inPolygon(x, z, b.rings),
      "Roof triangles must not cover courtyards",
    );
  }
  const face = b.triangles.find((t) => {
    const p = t.map((i) => vertices[i]);
    return (
      Math.abs(
        (p[1][0] - p[0][0]) * (p[2][1] - p[0][1]) -
          (p[1][1] - p[0][1]) * (p[2][0] - p[0][0]),
      ) > 1
    );
  });
  if (face && !b.detailedParts) {
    const points = face.map((i) => vertices[i]),
      x = points.reduce((s, p) => s + p[0], 0) / 3,
      z = points.reduce((s, p) => s + p[1], 0) / 3;
    assert.equal(districtProbe(x, z, 0, 0).blocked, true);
    assert.ok(districtProbe(x, z, b.h + 120, 0).floor >= b.h);
  }
}
for (let z = -55; z <= 60; z++)
  assert.equal(
    districtProbe(0, z, 0, 0.6).blocked,
    false,
    "Intro mission corridor remains open",
  );
for (const p of Object.values(mapData.locations))
  assert.equal(
    districtProbe(p.gx, p.gz, 0, 0.6).blocked,
    false,
    "Mission terminal is accessible",
  );
for (const [i, [a, b]] of mapData.routes.entries())
  for (let t = 0; t <= 1; t += 0.025)
    assert.equal(
      districtProbe(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, 0, 0.3)
        .blocked,
      false,
      `Citizen route ${i} follows clear public space`,
    );
console.log(
  `PASS ${mapData.buildings.length} sourced footprints, roof holes, real landmark coordinates, named roads, coastline, mission corridor and ${mapData.routes.length} NPC routes`,
);
