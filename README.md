# STARTUP CITY — HELSINKI

**Explore Helsinki. Discover the startups building the future.**

A playable 3D map of central Helsinki, painted in oils under animated northern lights, where real startups stand at their real addresses. Click a glowing building to read a sourced company profile, ask questions in plain language, pull fresh news and job listings through Context.dev, and watch the city react.

Built for Junction 2026, Context.dev challenge: *The Web Is Your Real-Time Database.*

> We transformed Helsinki's startup ecosystem from a static directory into a living, interactive 3D world.

## Start

Node.js 22.12 or later.

```sh
npm ci
cp .env.example .env      # add CONTEXT_DEV_API_KEY and GEMINI_API_KEY
npm run dev
```

Open http://127.0.0.1:5179 and press **Explore the city**, or **Start demo** for the 90-second guided walkthrough. Vite runs on `5179`, the Express API on `8787`. Without keys the app still runs on the bundled snapshot, clearly labelled as cached.

| Mode | Controls |
| --- | --- |
| **City Explorer** (bird's-eye) | Drag to pan · right-drag or Shift-drag to rotate · scroll to zoom · click a glowing building · WASD / arrows / Q / E also move the camera |
| **Street Explorer** (third person) | W A S D ride · F walk · drag to look · Space jump · **E** visit the nearby startup |
| Both | **Tab** switch mode · **/** focus search · **Esc** close |

## What is in it

- **Real Helsinki in 3D.** 1,851 OpenStreetMap building footprints, streets, tram tracks, parks, trees and shoreline across about 2.9 × 2.1 km, from Ruoholahti and the Maria 01 campus to Senate Square. One metre in the scene is one metre on the ground.
- **50 real organisations, 31 on the map** (49 companies plus the Maria 01 campus). Each placed company stands on the building at its reported street address. Companies sharing a building (six at Maria 01, plus the campus itself) get a grouped marker. The other 19 are listed in the directory as *location not verified*.
- **Company profiles** with description, industry, founding year, founders, employee range, funding, investors, open positions, recent news, website and LinkedIn. Every fact shows its source link, retrieval date and status.
- **Refresh startup signals.** Re-reads news coverage and careers pages through Context.dev, with loading, success and error states, caching and request limits.
- **Live from Helsinki.** A feed of published headlines with source, date and *View on map*. Funding news turns a building gold; launches pulse blue; hiring shows green.
- **Gemini search.** "Which startups are hiring developers?" becomes structured filters; matches light up and a route links them along real streets.
- **Connections.** Shared investors, joint announcements and same-industry links from the records, plus dashed Gemini suggestions labelled as AI-inferred.
- **Missions.** Find 3 AI startups, 3 that are hiring, 3 recently funded. Points, badges and a startup collection.
- **Guided demo** with Next, Previous, Pause and Restart. It works with the APIs unavailable.

## Where the data comes from

Nothing about a company is typed in by hand except its official domain and an editorial category. Run `npm run research` to rebuild the snapshot:

1. **Context.dev company profile** (`brand.retrieve`) for the domain: description, street address, employee range, industry, LinkedIn, careers link, logo. A profile that resolves to another brand (an acquirer or redirect) is dropped.
2. **Address check.** The reported Helsinki address must match a building in the bundled OpenStreetMap snapshot, or else the City of Helsinki open address register. No match means no marker.
3. **Context.dev research agent** (`web.answers`) for founding year, founders, funding and investors, each with the page it cited.
4. **Context.dev news** (`news.search` by company domain). Only English articles where the company is the primary subject, with match confidence of at least 0.95 and the company named in the headline. This filters out same-name brands elsewhere.
5. **Context.dev scrape** (`web.scrape` with a JSON schema) of the company's own careers page for specific open positions.
6. **Context.dev monitors** (`monitors.create`) on request: *Monitor for changes* in a profile starts a daily watch on that company's careers page or website.

| Label in the interface | Meaning |
| --- | --- |
| **Verified** | Read directly from the source: company profile, publisher headline, map register |
| **Sourced** | Extracted from the cited page by the Context.dev research agent |
| **AI summary** | Written by Gemini from the sourced record only |
| **AI suggestion** | Inferred by Gemini; never presented as fact |
| **Cached** | From the bundled snapshot rather than a live reading in this session |

Missing facts are shown as *Not publicly verified*. Headline types (funding, launch, partnership, hiring) are assigned by keyword rules, not by a model.

**Limits worth knowing.** Sourced figures are what the cited page reports and may be out of date. Careers pages that render listings with scripts, or list only departments, come back empty, so *Hiring* undercounts. Terrain is flat and most building heights are estimated from floor counts; see [map research and limits](docs/research/helsinki-map.md).

## Gemini roles

| Role | Model (override in `.env`) | Used for |
| --- | --- | --- |
| Fast | `gemini-4-hydrogen` | Question → structured filters |
| Research | `gemini-4-carbon` | Answering a question about one company from its record |
| Deep | `gemini-4-argon` | Suggesting relationships across the ecosystem; optional deeper answers |

Gemini receives only the stored, sourced records. If it is unavailable, search falls back to keyword interpretation and says so.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/startups` | Stored records, suggestions, service availability |
| `POST /api/signals/refresh` | Re-read news and careers pages (6 companies per call; 10-minute cache, 1 minute for a single company) |
| `POST /api/search` | Question → filters |
| `POST /api/ask` | Question about one company, answered from its record |
| `POST /api/connections/suggest` | Regenerate AI-inferred suggestions |
| `GET` / `POST /api/monitors` | Context.dev page monitors |

Keys stay on the server. Records are stored as JSON in `data/startups.json`.

## Verify

```sh
npm test                 # 24 unit checks: data contract, placement, filters, missions, connections
npm run build            # type check and production bundle
npm run dev              # then, in another terminal:
npm run test:browser     # 47 browser checks; screenshots in output/startup-city/
node scripts/test-helsinki-map.mjs   # map geometry, collision and landmarks
npm start                # production app and API together on port 8787
```

The browser checks replace provider calls with fixtures, so they spend no credits. They cover both camera modes, profiles and provenance labels, search and routing, the refresh error path, connections, feed, directory, missions, the demo's presenter controls, the offline snapshot fallback and the phone layout.

## Code map

| Path | Responsibility |
| --- | --- |
| `src/startup/scene.ts` | City Explorer camera, mode transitions, building glow, markers, connection arcs, picking, street routing |
| `src/startup/App.tsx`, `Panel.tsx` | Interface: search, filters, feed, missions, directory, profile, connections, demo |
| `src/startup/store.ts`, `logic.ts` | State, API calls, connections, missions and scoring |
| `src/shared/startup-schema.ts` | Data contract, provenance, filters, keyword rules |
| `server/startups/context.ts` | Context.dev: profile, news, jobs, research, monitors, address matching |
| `server/startups/gemini.ts` | Gemini: filters, grounded answers, suggestions |
| `server/startups/routes.ts` | API, caching, request limits, JSON store |
| `scripts/research-startups.ts` | Builds the snapshot and downloads logos |
| `scripts/build-address-index.mjs` | OpenStreetMap address → building index |
| `public/engine/` | Oil-paint renderer, aurora, map, rider. `webworld.js` is the adapter the scene layer plugs into |
| `public/data/helsinki/` | OpenStreetMap source and derived map, ODbL |

## Base map and credits

STARTUP CITY is built on this repository's earlier WEBWORLD project and keeps its look: the oil-paint treatment adapted from [Patch's oil-paint](https://patch.gg/blendi/oil-paint) (MIT; notice in `public/engine/oil-paint/NOTICE.md`), the animated aurora, the student on a scooter, and the movement, camera and renderer of the authorized game client in `public/engine/game.js`. The delivery missions, robots, drones and billboards of that project were removed; its `/api/sync` endpoint remains but is unused.

Map data © OpenStreetMap contributors, ODbL; details in `public/data/helsinki/SOURCES.md`. Address fallback: City of Helsinki open address register. Company logos and names belong to their owners and are shown for identification.
