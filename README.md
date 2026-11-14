# Startup City, Helsinki

Explore Helsinki. Discover the startups building the future.

A 3D map of central Helsinki at night, under the northern lights, with real startups at their registered addresses. Click a building to read the company's profile with a source for every fact, ask Gemini about it, pull fresh news and open roles through Context.dev, and watch short narrated cutscenes that Gemini writes and voices from the records.

Built for Junction 2026, Context.dev challenge: The Web Is Your Real-Time Database.

## Run it

Node.js 22.12 or later.

```sh
npm ci
cp .env.example .env      # add CONTEXT_DEV_API_KEY and GEMINI_API_KEY
npm run dev
```

Open http://127.0.0.1:5179 and press Explore the city, or Start demo for the 90-second guided tour. Vite serves on 5179 and the API on 8787. Without keys the app runs on the saved data and says so; cutscenes then use plain sentences from the records and no voice.

| Where | Controls |
| --- | --- |
| City view (from above) | Drag to move, right-drag or Shift-drag to turn, scroll to zoom, click a lit building. W A S D, Q and E also move the camera. |
| Street level | W A S D to ride, F to walk, drag to look, Space to jump, E to visit the startup in front of you. |
| Anywhere | Tab switches view, / jumps to search, Esc closes or skips a cutscene. |

## The companies

The list comes from the curated database in `Helsinki Startups Map_ Database.ods`. Every row marked "On map" is included (95 companies), plus companies from an earlier research list that the database does not have yet. 144 companies in total:

- 67 stand on their building in the 3D district.
- 63 have an address confirmed in the Helsinki region address register that lies outside the district (Kallio, Pasila, Viikki, Otaniemi, Vantaa and so on). They are in the directory with their address, not guessed onto the map.
- 14 have no address that could be matched to a building.

Values in the database take precedence. Context.dev fills in what the database leaves empty: description, logo, size, links, news and open roles. When the database changes:

```sh
uv run --with odfpy==1.4.1 --with pandas python scripts/export-spreadsheet.py   # writes data/spreadsheet.json
npm run research                                                                  # updates data/startups.json
```

Research results are cached in `data/research-cache.json`, so a second run only spends credits on new companies.

## Where each fact comes from

1. The company database: description, founders, founding year, headcount, funding rounds and investors, each with the source link recorded in the sheet.
2. A Context.dev company profile for the official domain: description, address, size, LinkedIn, careers page and logo. Profiles that resolve to a different brand (an acquirer or a parked domain) are dropped.
3. The address must match a building in the bundled OpenStreetMap data, or a point in the City of Helsinki's open address register. No match, no marker.
4. Context.dev research (`web.answers`) for founders and funding, only when the database has neither.
5. Context.dev news, matched by company domain. Only English articles where the company is the main subject, with match confidence of at least 0.95 and the company named in the headline. This keeps out same-name brands elsewhere.
6. Context.dev scrape of the company's own careers page for specific open roles.
7. Context.dev monitors, on request: Watch for changes in a profile starts a daily check of the careers page or website.

The profile labels each fact. Verified means it was read directly from the source. Sourced means it was taken from the cited page. Gemini means it was written or suggested by AI. Missing facts show as "Not published". Headline types (funding, launch, partnership, hiring) come from keyword rules, not a model.

Limits: figures are what the cited page says and may be out of date. Careers pages that load their listings with scripts come back empty, so "Hiring" undercounts. Terrain is flat and most building heights are estimated from floor counts; see [map research and limits](docs/research/helsinki-map.md).

## Gemini

| Role | Model (change in `.env`) | Used for |
| --- | --- | --- |
| Fast | `gemini-4-hydrogen` | Turning a question into map filters |
| Research | `gemini-4-carbon` | Answering questions about one company; writing cutscene scripts |
| Deep | `gemini-4-argon` | Suggesting relationships between companies; optional deeper answers |
| Voice | `gemini-3.8-flash-tts` | Narrating cutscenes |

Gemini only receives the stored records. If it is unavailable, search falls back to keywords and says so.

### Cutscenes

A cutscene is a short shot list that Gemini writes as JSON. Each shot names one of six camera moves the scene can perform (establish, aurora, flyover, orbit, close, rise), the company it looks at, and one line of narration. The server checks every company id against the records, removes dashes, voices each line with Gemini text-to-speech and caches the result by a hash of the records, so a scene is rebuilt only when its data changes. The browser plays it with letterboxing, subtitles and the scene's own camera; Esc skips.

They appear:

- On first entry, as an intro over the city (skipped when reduced motion is on).
- From Watch story in a company profile.
- From Watch next to a headline in Live from Helsinki.
- When a mission is completed, as a recap of the companies that completed it.
- In step 7 of the guided demo.

## API

| Route | Purpose |
| --- | --- |
| `GET /api/startups` | Stored records, suggestions and which services are available |
| `POST /api/signals/refresh` | Read news and careers pages again (6 companies per call, 10 minute cache, 1 minute for a single company) |
| `POST /api/search` | Question to filters |
| `POST /api/ask` | Question about one company, answered from its record |
| `POST /api/connections/suggest` | Regenerate Gemini's relationship suggestions |
| `POST /api/cutscene` | Script and narration for a cutscene |
| `GET`, `POST /api/monitors` | Context.dev page monitors |

Keys stay on the server. Records live in `data/startups.json`; a copy in `public/data/startups-snapshot.json` is used when the API is down.

## Checks

```sh
npm test                 # unit checks: data, placement, filters, missions, connections, cutscenes
npm run build            # type check and production bundle
npm run dev              # then, in another terminal:
npm run test:browser     # browser checks; screenshots in output/startup-city/
node scripts/test-helsinki-map.mjs   # map geometry, collision and landmarks
npm start                # production app and API together on port 8787
```

The browser checks replace Gemini and Context.dev with fixtures, so they spend no credits.

## Code

| Path | What it does |
| --- | --- |
| `src/startup/scene.ts` | City camera, view changes, cutscene camera moves, building glow, markers, connection lines, picking, street routing |
| `src/startup/App.tsx`, `Panel.tsx`, `Cutscene.tsx` | Interface |
| `src/startup/store.ts`, `logic.ts` | State, API calls, connections, missions and scoring |
| `src/shared/startup-schema.ts`, `cutscene-schema.ts` | Data contracts and rules |
| `server/startups/` | Context.dev, Gemini, cutscenes, API routes |
| `scripts/export-spreadsheet.py`, `research-startups.ts` | Database export and research pipeline |
| `public/engine/` | Oil-paint renderer, aurora, map and rider |
| `public/data/helsinki/` | OpenStreetMap source and derived map, ODbL |

## Credits

The renderer, aurora, rider and movement come from this repository's earlier WEBWORLD project and keep its look: an oil-paint treatment adapted from [Patch's oil-paint](https://patch.gg/blendi/oil-paint) (MIT, notice in `public/engine/oil-paint/NOTICE.md`), on the authorized game client in `public/engine/game.js`.

Interface type is Google Sans Flex (SIL Open Font License), bundled locally. Map data © OpenStreetMap contributors, ODbL; see `public/data/helsinki/SOURCES.md`. Address fallback: City of Helsinki open address register. Company names and logos belong to their owners and are shown to identify them.
