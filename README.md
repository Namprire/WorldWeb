# WEBWORLD · A painted Helsinki

Explore oil-painted Helsinki in autumn sunlight or under northern lights on a student’s scooter and discover the companies building what comes next. The current experience is free exploration: **no quests, dialogue, delivery or reward flow**. Riding, walking, flight, the original camera and the continuous title-to-game transition remain. The title holds the actual city as a still painting; its animation resumes when you start and freezes again when you return.

Active checkout: `/Users/nampham/Documents/Junction/WorldWeb`, branch `webworld_origin`.

## Try it

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5179 and choose **Let’s ride**. Node 22.12+ is required. Development runs Vite on 5179 and Express on 8787. For a second checkout, start `PORT=8788 npm start` and `WEBWORLD_API_PORT=8788 npx vite --port 5181 --strictPort` in separate terminals.

Choose **Autumn wood** or **Northern lights** below the title painting or at the
top left while riding. Autumn is the default on a fresh browser; the selection is
remembered locally. Direct previews use `?environment=autumn` or
`?environment=aurora`. Switching changes lighting, sky, foliage and the gallery
mount while keeping your location, camera and ride. Autumn has layered gold,
copper and red tree crowns, falling leaves, ground litter and soft canopy shade.
The 2,436 existing mapped tree centres and all building/road footprints stay fixed.
For the woodland atmosphere, ride north into **Kaisaniemi Park** beyond the square.
The title remains a still frame in both modes, then animates on entry.

- **WASD / arrows:** ride and steer. **S:** brake.
- **F:** walk or remount. **Space:** jump; tap three times for flight.
- **R:** open a nearby company exhibit. Ride north through the square to find them.
- **/** or **Find a company:** search names, sectors and job titles; combine sector and Hiring filters.
- **V** or **City view:** rise above central Helsinki. Select a company tile or open a numbered group.
- **Escape:** close the active discovery panel/map; otherwise return to the title.
- **M:** sound. **T:** theater mode. Drag / wheel retain camera controls.

Profiles and search pause player movement so typing cannot accidentally drive the scooter. Closing them resumes the original controller. Discoveries persist on this browser; there are no points or rewards attached.

## What is real

The map uses OpenStreetMap geometry for roughly 2 × 2 km of central Helsinki: 1,301 building footprints, mapped streets, tram tracks, parks, shoreline and trees. There are 172 ambient pedestrians. Horizontal geometry is sourced; heights, facades and level terrain are approximations. [Map research and limitations](docs/research/helsinki-map.md); [source database](public/data/helsinki/SOURCES.md).

Ten sourced company snapshots are curated in `public/data/startups/companies.json`: Aiven, Varjo, Oura, ICEYE, Reaktor, Smartly, Supermetrics, Yousician, Sulapac and Solar Foods. This includes startups, scaleups and established innovators in the Finnish ecosystem. City view plots six published Helsinki offices using coordinates from the bundled OpenStreetMap data. The other four companies appear at their Rautatientori exhibits. All ten exhibits remain available during the ride.

Each profile links its primary source and shows its factual review date. Unknown founders and employee counts remain unknown. Hiring means a sourced vacancy whose explicit expiry has not passed. The initial Solar Foods Finance Director snapshot expires on 15 November 2026; the filter then stops showing it. A saved vacancy is not a promise that the role remains open.

## Live source checks

Copy `.env.example` to `.env` and set `CONTEXT_DEV_API_KEY` on the server. **Check sources** retrieves the ten allowlisted company pages through Context.dev, with two requests at a time, shared concurrent refreshes, a one-minute cooldown and persisted content hashes.

The first successful check establishes a baseline. Later content changes flag the exhibit for review and pulse its ring. A source-check timestamp is distinct from a factual review date. Failed pages preserve previous observations. **This MVP detects page changes; it does not automatically replace founders, employee counts or jobs with AI claims.** Reviewed updates are made in the collection file. Scheduled monitoring/webhooks and evidence-backed field updates are follow-up work.

Without credentials the saved collection still works, and the UI explains the unavailable live check. Live provider success has not been exercised with real credentials in this change.

## Cinematic exhibits and Gemini video

Aiven, Varjo and Oura have animated shader screens immediately, with no API calls. The original Patch aurora and painted city remain active. Reduced motion freezes gallery artwork and aurora and uses the existing shortened portal transition.

An optional server-side video pipeline uses Google’s documented `gemini-omni-1.2-flash` Interactions API. The model and API were checked against [Google’s video guide](https://aistudio.google.com/docs/omni). These clips are imagined gallery art, not company/product footage. The browser never receives an API key.

Preview a prompt for free:

```sh
npm run generate:exhibit -- aiven
```

After checking your Google account access, quota and price, explicitly opt into a paid generation:

```sh
npm run generate:exhibit -- aiven --accept-charges
```

Allowed exhibits: `aiven`, `varjo`, `oura`. Configure `GEMINI_API_KEY` only in `.env`. The command saves the remote interaction ID under `output/video-jobs/`, polls it, and writes the MP4 plus provenance to `public/media/exhibits/`. A repeated command resumes the saved operation or uses the existing clip. Run only one generation command at a time. If the initial submission fails before its ID is saved, inspect the provider account before retrying; its outcome may be unknown.

Reload the game after a clip is saved. Only the closest screen within 110 metres plays a muted clip; distant screens, background tabs, map view and reduced motion use local artwork. Missing media leaves the procedural fallback intact. No paid clips were generated during implementation; remote generation remains unverified until credentials and spending approval are supplied.

## Build and verify

```sh
npm test
npm run build
npm run test:browser
npm run test:portal
node scripts/test-helsinki-map.mjs
node scripts/test-environments.mjs
```

Browser checks use installed Chrome through Playwright. Set `WEBWORLD_URL` to test a different local origin. Screenshots are under `output/webworld/discovery/`. The discovery test covers proximity interaction, filters, source links, movement isolation, map return, walking/riding and mobile layout. The portal suite covers the original animated entry/return and reduced motion. Older mission modules and their unit tests remain as inactive reference code; `scripts/test-webworld.mjs` is the retired mission browser suite.

For production, `npm run build && npm start` serves the game and API at http://127.0.0.1:8787. Stop any development API on that port first.

## Main files

| File | Responsibility |
| --- | --- |
| `public/engine/game.js` | Existing renderer, controller, camera, animation and input; one UI movement-pause guard added |
| `public/engine/webworld.js` | Company signs, rings, cinematic screens, map camera and discovery bridge |
| `public/engine/helsinki-real-map.js` | Sourced Helsinki geometry |
| `public/engine/oil-paint/` | Painted surfaces, foliage, aurora and Patch provenance |
| `src/webworld/main.ts` | Discovery HUD, profiles, proximity, filters and input |
| `src/webworld/discovery.css` | Discovery presentation and responsive layout |
| `src/shared/startups.ts` | Validated company records, search and vacancy expiry |
| `server/startups.ts` | Source checks and cached media manifest |
| `server/exhibit-video.ts` | Optional generation, polling and disk cache |

The existing authorized client derivative is retained as the movement/rendering base. `starry-study/` is inactive reference material. Patch adaptation: https://patch.gg/nam-pham/oil-paint; [MIT notice](public/engine/oil-paint/NOTICE.md). Map attribution remains visible in-game. Earlier generated art references remain in `public/art/helsinki/` and `docs/art-direction/`.
