# Data and sources

## Companies

The company list comes from a curated database of Helsinki startups (`data/helsinki-startups.ods`, kept out of the repository; its export `data/spreadsheet.json` is included). Every company marked "On map" there is included, plus companies from an earlier research list: 143 companies in total.

| Where a company appears | Count | Rule |
| --- | --- | --- |
| On its building in the 3D city | 66 | Its address matches a building in the mapped district |
| Directory, outside the district | about 60 | Address confirmed in the Helsinki region address register, but beyond the 3D area |
| Directory, address not confirmed | the rest | No address could be matched; never placed on a guess |

The 39 Junction 2026 partners, their tiers, websites and logos come from the [Junction 2026 site](https://2026.hackjunction.com/) (`data/junction-partners.json`). Five have offices inside the district.

## Where each fact comes from

1. The curated database: description, founders, founding year, headcount, funding rounds and investors, each with the source link recorded there.
2. A [Context.dev](https://context.dev) company profile for the official website: description, address, size, LinkedIn, careers page and logo. A profile that resolves to a different brand (an acquirer or a parked domain) is dropped.
3. The address is matched to a building in the OpenStreetMap data, or to a point in the City of Helsinki's open address register.
4. Context.dev research for founders and funding, only where the database has neither.
5. Context.dev news, matched by company website: English articles where the company is the main subject, with match confidence of at least 0.95 and the company named in the headline. This keeps out same-name brands elsewhere.
6. The company's own careers page, read by Context.dev, for specific open roles.

Each value carries its source, retrieval date and a status shown in the interface:

| Label | Meaning |
| --- | --- |
| Verified | Read directly from the source |
| Sourced | Taken from the cited page |
| Written by Gemini | A summary or answer generated from the record |
| Suggested by Gemini | An inferred relationship, not a fact |

Missing facts are shown as "Not published". Headline types (funding, launch, partnership, hiring) come from keyword rules, not a model.

**Limits.** Figures are what the cited page says and may be out of date. Careers pages that load their listings with scripts come back empty, so "Hiring" undercounts.

## The map

- OpenStreetMap footprints, streets, parks, trees and shoreline for about 3.8 × 3.1 km of central Helsinki (ODbL).
- The City of Helsinki building register (CC BY 4.0) gives floor counts, completion years and facade materials. 2,427 of 2,736 buildings are matched. Heights come from floors; facade colours from material and era; buildings completed before 1932 get hipped roofs unless OpenStreetMap tags another shape.
- Terrain is flat. Details and limits: [helsinki-map.md](research/helsinki-map.md) and `public/data/helsinki/SOURCES.md`.

## Generated media

Cutscene scripts are written by Gemini from the stored records only, and voiced by Gemini TTS. They are cached in `data/cutscenes/` by a hash of the records behind them, so a scene is rebuilt only when its data changes.

The four establishing films in `public/films/` were made with Gemini Omni Flash from frames of this app's own city. The day, dusk and night films stay close to the map; the dawn film turned into a realistic impression of Helsinki, and its credit says so. No film shows company offices or people.

## Rebuilding

```sh
# Company data (spends Context.dev credits only for new or changed companies)
uv run --with odfpy==1.4.1 --with pandas python scripts/export-spreadsheet.py
npm run research

# Map (see public/data/helsinki/SOURCES.md)
python3 scripts/fetch-helsinki-osm.py
npm run map:register
uv run --with shapely==2.1.2 python scripts/build-helsinki-map.py
node scripts/triangulate-helsinki.mjs
node scripts/build-address-index.mjs

# Films (needs a Gemini key, about $0.56 each)
npm run films
```
