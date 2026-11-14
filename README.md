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
| City view (from above) | Drag to move (it glides when flicked), scroll or pinch to zoom towards the cursor, double-click to zoom in, right-drag or two fingers to turn and tilt, click a lit building. Buttons bottom right: graphics, face north, zoom in and out. W A S D, Q and E move the camera; + and − zoom. |
| Street level | W A S D to ride, F to walk, drag to look, Space to jump, E to visit the startup in front of you. |
| Anywhere | Tab switches view, / jumps to search, Esc closes or skips a cutscene. |

## Getting around

- The visit opens high above the city on the full northern lights, then tilts down over Helsinki and descends onto the district. Any click or key skips it.
- Choosing a filter flies out to show every match, from wherever you are.
- Routes are drawn on the street in 3D and on the minimap. The route bar shows distance and walking time, with Street level or Overview, and Clear (Esc also clears).
- The buttons bottom right: settings (graphics level, company names on the map, sound, full screen, shortcuts), show the whole district, face north, zoom.
- `?` shows every shortcut. Copy link in a profile, or the address bar, opens straight to that company (`?company=saidot`).

## Junction 2026 partners

The partner list, tiers, websites and logos come from the Junction 2026 site (`data/junction-partners.json`); Anthropic was added from the organisers' list. Partners with a verified office inside the 3D district (Verda, Aiven, CRACI, Bahn Express and Lifeline Ventures) get an aurora-edged marker with their official logo, a taller light beam and a halo over the building. Every partner is listed at the top of the directory with its home city, the "Junction 2026 partners" filter lights them up, and Partner tour plays a narrated cutscene past their buildings. No partner is placed without a verified address.

## Smooth on any device

Hosting does not change frame rate: the city is drawn on the visitor's own graphics chip. The app adapts instead. The graphics button (bottom right) offers Auto, Smooth, Balanced and Detailed, which set render resolution, how far the city view draws and how many trees are shown. Auto starts from the device (phones and 4-core machines start on Smooth), lowers resolution when frames are slow, and steps down a level if that is not enough. On Linux, Chrome usually runs WebGL much faster than Firefox.

The Gemini question bar is switched off for now (`SEARCH_ENABLED` in `src/startup/App.tsx`); the category and partner filters do the same job.

## Try it on your phone

With the phone on the same Wi-Fi as the computer:

```sh
npm run dev:phone
```

Then open `http://<computer's Wi-Fi address>:5179` on the phone (find the address with `ip -4 addr` on Linux or `ipconfig getifaddr en0` on a Mac). Only the web page is exposed to the network; the API with your keys stays on the computer behind Vite's proxy. If the page doesn't load, the computer's firewall is blocking port 5179.

On Android you can also connect by USB, run `adb reverse tcp:5179 tcp:5179`, and open `http://localhost:5179`. That also lets you inspect the page from desktop Chrome at `chrome://inspect`.

On a phone: drag anywhere at street level to steer, tap Jump to jump, and tap the visit prompt near a startup. In the city view, drag to move and pinch to zoom and turn. Render resolution starts lower on phones and adapts to the frame rate.

## Publish on Google AI Studio (free)

AI Studio's Starter Tier publishes up to two full-stack apps to Cloud Run with a free `your-name.ai.studio` address, without a billing account. Workspace accounts and accounts that have had a paid Google Cloud billing account are not eligible.

1. Push this folder to a GitHub repository. Keep `.env` out of it (it is in `.gitignore`).
2. In AI Studio, open Build mode, then use the + menu in the prompt box and choose Import from GitHub.
3. In Settings, under Secrets, add `CONTEXT_DEV_API_KEY`. AI Studio provides `GEMINI_API_KEY` itself; add it as a secret too if the imported app does not pick it up.
4. Click Publish (top right), confirm, expand "Free .ai.studio URL" to choose the name, then Publish your app.

The server reads `PORT` and listens on all interfaces when it is set, as Cloud Run requires, and serves the built site from `dist/`, so the build must run before start (`npm run build && npm start`). AI Studio documents Node.js server support but not how it runs an imported Express app, so check its first build log for the start command it used. The Starter Tier filesystem is temporary, so refreshed signals and new cutscenes are lost when the instance restarts; the saved data and films in the repository are always there.

A public link spends your Gemini and Context.dev credits. Each visitor is limited per 10 minutes (6 signal refreshes, 40 searches, 30 questions, 20 cutscenes, 3 suggestion runs, 5 monitors), but set a budget alert in both services before sharing widely.



The map covers about 3.8 × 3.1 km of central Helsinki, from Salmisaari and Jätkäsaari to Kruununhaka. Footprints, streets, parks, trees and shoreline come from OpenStreetMap. Each building is matched to the City of Helsinki building register (2,427 of 2,736 matched), which gives:

- Height from the registered floor count.
- Facade colour from facade material and construction year: ochre, cream and pastel render on pre-war blocks, granite on stone buildings, brick, concrete and glass on newer ones.
- Roof shape: pre-1932 buildings get hipped tin roofs unless OpenStreetMap tags a different shape.

It keeps the oil-paint look. Terrain is flat and the rest of the limits are in [map research](docs/research/helsinki-map.md).

### Time of day

The sun follows its real path over Helsinki, computed for the date and time. By default the city follows the real clock, so in November it is dark from about half past four and the northern lights show only when the sky is dark enough. The clock at the bottom left lets you pick morning, afternoon, evening or night, drag to any time, run a time-lapse (one day in six minutes) or switch to midsummer, when the night never gets fully dark. Facade colours show by day; windows light up from dusk.

A new morning opens with a narrated briefing of the latest headlines. That happens when you pick Morning, or when morning arrives on the real clock or in the time-lapse.



The list comes from the curated database in `Helsinki Startups Map_ Database.ods`. Every row marked "On map" is included (95 companies), plus companies from an earlier research list that the database does not have yet. 144 companies in total:

- 67 stand on their building in the 3D district.
- 63 have an address confirmed in the Helsinki region address register that lies outside the district (Kallio, Pasila, Viikki, Otaniemi, Vantaa and so on). They are in the directory with their address, not guessed onto the map.
- 14 have no address that could be matched to a building.

Values in the database take precedence. Context.dev fills in what the database leaves empty: description, logo, size, links, news and open roles. When the database changes:

```sh
uv run --with odfpy==1.4.1 --with pandas python scripts/export-spreadsheet.py   # writes data/spreadsheet.json
npm run research                                                                  # updates data/startups.json
```

To rebuild the map itself (OpenStreetMap, then the Helsinki register, then geometry), see `public/data/helsinki/SOURCES.md`.

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
| Video | `gemini-omni-1.2-flash` | Establishing films for cutscenes |

Gemini only receives the stored records. If it is unavailable, search falls back to keywords and says so.

### Cutscenes

A cutscene is a short shot list that Gemini writes as JSON. Each shot names one of six camera moves the scene can perform (establish, aurora, flyover, orbit, close, rise), the company it looks at, and one line of narration. The server checks every company id against the records, removes dashes, voices each line with Gemini text-to-speech and caches the result by a hash of the records, so a scene is rebuilt only when its data changes. The browser plays it with letterboxing, subtitles and the scene's own camera; Esc skips.

Intro, briefing and mission scenes open with a short film that matches the time of day. `npm run films` captures frames of this map at dawn, afternoon, dusk and night (without the interface) and Gemini Omni Flash animates each into an 8 second clip, saved in `public/films/`. The day, dusk and night films stay close to the map. The dawn film came out as a realistic impression of Helsinki rather than the painted map, so its credit says so. The films show the city only, never company offices or people. Each costs about $0.56 to generate.

They appear:

- On first entry, as an intro over the city (skipped when reduced motion is on).
- Each new morning, as a briefing of the latest headlines.
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

Interface type is Google Sans Flex (SIL Open Font License), bundled locally. Map data © OpenStreetMap contributors, ODbL. Building heights, ages and materials: City of Helsinki building register, CC BY 4.0. See `public/data/helsinki/SOURCES.md`. Address fallback: City of Helsinki open address register. Company names and logos belong to their owners and are shown to identify them.
