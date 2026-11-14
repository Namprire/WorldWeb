// Builds data/helsinki-addresses.json: OSM addr:street + addr:housenumber -> map building.
// Used to place startups only at addresses that exist in the bundled OpenStreetMap snapshot.
import { readFile, writeFile } from "node:fs/promises";
import { mapData, project, inPolygon } from "../public/engine/helsinki-geography.js";
const source = JSON.parse(await readFile("data/map/source.osm.json", "utf8"));
const centre = (points) => {
  const valid = points.filter(Boolean);
  if (!valid.length) return null;
  return [valid.reduce((s, p) => s + p.lon, 0) / valid.length, valid.reduce((s, p) => s + p.lat, 0) / valid.length];
};
function edgeDistance(x, z, a, b) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz);
}
function buildingAt(x, z) {
  let best = null, bestDistance = 18;
  for (const b of mapData.buildings) {
    if (x < b.bounds[0] - 20 || x > b.bounds[2] + 20 || z < b.bounds[1] - 20 || z > b.bounds[3] + 20) continue;
    if (inPolygon(x, z, b.rings)) return { b, distance: 0 };
    for (const ring of b.rings) for (let i = 0; i < ring.length; i++) {
      const d = edgeDistance(x, z, ring[i], ring[(i + 1) % ring.length]);
      if (d < bestDistance) { bestDistance = d; best = b; }
    }
  }
  return best ? { b: best, distance: bestDistance } : null;
}
const index = {};
let total = 0;
for (const el of source.elements) {
  const street = el.tags?.["addr:street"], number = el.tags?.["addr:housenumber"];
  if (!street || !number) continue;
  const lonLat = el.type === "node" ? [el.lon, el.lat]
    : el.type === "way" ? centre(el.geometry || [])
    : centre((el.members || []).flatMap((m) => m.geometry || []));
  if (!lonLat) continue;
  const [x, z] = project(...lonLat);
  const B = mapData.bounds;
  if (x < B.west || x > B.east || z < B.north || z > B.south) continue;
  const hit = buildingAt(x, z);
  if (!hit) continue;
  const key = `${street.toLowerCase()}|${number.toLowerCase().replace(/\s+/g, "")}`;
  const entry = { street, number, x: +x.toFixed(2), z: +z.toFixed(2), lon: +lonLat[0].toFixed(6), lat: +lonLat[1].toFixed(6), building: hit.b.id, osm: `${el.type}/${el.id}`, exact: el.type !== "node" || hit.distance === 0 };
  // Prefer building-level tags over entrance nodes for the same address.
  if (!index[key] || (el.type !== "node" && !index[key].osm.startsWith("way"))) index[key] = entry;
  total++;
}
await writeFile("data/helsinki-addresses.json", JSON.stringify({ meta: { source: "OpenStreetMap contributors (ODbL)", retrievedAt: source.retrievedAt }, addresses: index }));
console.log("addresses", Object.keys(index).length, "from", total, "tagged elements");
for (const k of ["antinkatu|1", "lapinlahdenkatu|16", "elielinaukio|2g", "vuorikatu|20", "porkkalankatu|3", "pohjoinen rautatiekatu|21", "kaivokatu|10a", "postintaival|7"]) console.log(k, index[k] ? `${index[k].building} ${index[k].x},${index[k].z}` : "not found");
