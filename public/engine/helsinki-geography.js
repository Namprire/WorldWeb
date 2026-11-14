// Loaded as JSON: parsing JSON is several times faster than compiling an equally large JS module.
const mapUrl = new URL("../data/helsinki/map.json", import.meta.url);
export const mapData =
  typeof window === "undefined"
    ? JSON.parse((await import("node:fs")).readFileSync(mapUrl, "utf8"))
    : await (await fetch(mapUrl)).json();
export const districtBuildings = mapData.buildings;
export const districtBounds = mapData.bounds;
export function project(lon, lat) {
  const [lo, la] = mapData.meta.origin,
    k = (Math.PI / 180) * mapData.meta.earthRadius;
  return [(lon - lo) * k * Math.cos((la * Math.PI) / 180), (la - lat) * k];
}
export function inRing(x, z, r) {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const a = r[i],
      b = r[j];
    if (
      a[1] > z !== b[1] > z &&
      x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0]
    )
      inside = !inside;
  }
  return inside;
}
export function inPolygon(x, z, rings) {
  return inRing(x, z, rings[0]) && !rings.slice(1).some((r) => inRing(x, z, r));
}
function edgeDistance(x, z, a, b) {
  const dx = b[0] - a[0],
    dz = b[1] - a[1],
    t = Math.max(
      0,
      Math.min(
        1,
        ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1),
      ),
    );
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
export const collisionBuildings = [
  ...districtBuildings.filter((b) => !b.detailedParts),
  ...mapData.parts,
];
const grid = new Map();
for (const b of collisionBuildings) {
  const [x, z, X, Z] = b.bounds;
  for (let i = Math.floor(x / 50); i <= Math.floor(X / 50); i++)
    for (let j = Math.floor(z / 50); j <= Math.floor(Z / 50); j++) {
      const key = `${i},${j}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(b);
    }
}
export function isWater(x, z) {
  return mapData.water.some(
    (w) =>
      x >= w.bounds[0] &&
      x <= w.bounds[2] &&
      z >= w.bounds[1] &&
      z <= w.bounds[3] &&
      inPolygon(x, z, w.rings),
  );
}
export function districtProbe(x, z, y, radius = 0, out = {}) {
  Object.assign(out, {
    floor: 0,
    ceil: Infinity,
    blocked: false,
    roof: false,
    hall: null,
  });
  const found = new Set();
  for (
    let i = Math.floor((x - radius) / 50);
    i <= Math.floor((x + radius) / 50);
    i++
  )
    for (
      let j = Math.floor((z - radius) / 50);
      j <= Math.floor((z + radius) / 50);
      j++
    )
      for (const b of grid.get(`${i},${j}`) || []) found.add(b);
  for (const b of found) {
    const inside = inPolygon(x, z, b.rings);
    const touches =
      radius > 0 &&
      b.rings.some((r) =>
        r.some((a, i) => edgeDistance(x, z, a, r[(i + 1) % r.length]) < radius),
      );
    if (!inside && !touches) continue;
    if (y + 1.7 < (b.minHeight || 0)) {
      out.ceil = Math.min(out.ceil, b.minHeight);
      continue;
    }
    if (y >= b.h - 0.35) {
      out.floor = Math.max(out.floor, b.h);
      out.roof = true;
    } else out.blocked = true;
  }
  const b = districtBounds;
  if (
    x < b.west + radius ||
    x > b.east - radius ||
    z < b.north + radius ||
    z > b.south - radius
  )
    out.blocked = true;
  if (y < 1.5 && isWater(x, z)) out.blocked = true;
  return out;
}
