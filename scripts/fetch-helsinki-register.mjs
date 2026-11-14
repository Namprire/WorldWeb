// Downloads the City of Helsinki building register for the map area.
// Source: kartta.hel.fi open data WFS, layer avoindata:Rakennukset_alue_rekisteritiedot (CC BY 4.0).
// Run from the repository root: node scripts/fetch-helsinki-register.mjs
import { writeFile } from "node:fs/promises";

const BBOX = [24.898, 60.151, 24.966, 60.179];
const KEEP = ["tyyppi", "tila", "i_kerrlkm", "c_valmpvm", "c_julkisivu", "c_rakeaine", "c_kayttark", "katunimi_suomi", "osoitenumero", "vtj_prt"];
const base = "https://kartta.hel.fi/ws/geoserver/avoindata/wfs?service=WFS&version=2.0.0&request=GetFeature" +
  "&typeNames=avoindata:Rakennukset_alue_rekisteritiedot&outputFormat=application/json&srsName=EPSG:4326" +
  `&bbox=${BBOX.join(",")},EPSG:4326&sortBy=id`;
const features = [];
for (let start = 0; ; start += 1000) {
  const response = await fetch(`${base}&count=1000&startIndex=${start}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error(`register request failed: ${response.status}`);
  const page = await response.json();
  for (const f of page.features) {
    const p = f.properties;
    if (p.tila && p.tila !== "voimassa") continue;
    features.push({ properties: Object.fromEntries(KEEP.map((k) => [k, p[k] ?? null])), geometry: f.geometry });
  }
  console.log(`fetched ${start + page.features.length} of ${page.numberMatched}`);
  if (page.features.length < 1000) break;
}
await writeFile("data/map/register.json", JSON.stringify({
  source: "City of Helsinki building register (avoindata:Rakennukset_alue_rekisteritiedot)",
  license: "CC BY 4.0",
  url: "https://kartta.hel.fi/ws/geoserver/avoindata/wfs",
  retrievedAt: new Date().toISOString(),
  bbox: BBOX,
  features,
}));
console.log(`saved ${features.length} buildings`);
