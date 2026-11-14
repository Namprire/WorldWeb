# WEBWORLD

Ride a painterly, Helsinki-inspired station district as a student on an electric scooter. Collect compute packets, deliver them to the Rautatientori terminal, and use **SYNC REALITY** to turn a headline into a new mission and change the city's atmosphere, robots, drones, billboards, courier traffic, and dialogue.

The current application lives at the **root of this Junction repository**. `starry-study/reproduction/` contains the earlier local reference version.

## Start

Use Node.js 22.12 or later.

```sh
cd /Users/nampham/Documents/Junction/WorldWeb
npm ci
npm run dev
```

Open [WEBWORLD on port 5179](http://127.0.0.1:5179/), then press **Let’s ride**. The command runs Vite on `5179` and the Express API on `8787`. Keep the terminal open while playing.

The active map now uses real **OpenStreetMap geometry for central Helsinki**, covering roughly 2 × 2 km. It contains 1,301 building footprints, mapped streets, tram tracks, parks, shoreline and tree positions. Central Station, Oodi, Helsinki Cathedral and Old Market Hall retain their mapped positions. There are 172 ambient pedestrians on checked public footpaths.

**Accuracy:** horizontal layout follows the bundled map data. Terrain is level; most heights are estimated from floor counts or a fallback, and ordinary roofs/facades are stylized. This is not a fully surveyed 3D reconstruction. Mission terminals are fictional game props. See [research, sources and limitations](docs/research/helsinki-map.md).

The entrance now frames the actual painted 3D city. On entry, the frame moves out of view and the original camera flies into that same scene and settles behind the student. There is no crossfade to a different city image. The HUD fades in when riding begins. Press **Escape** to return to the gallery and replay it. With reduced motion enabled in your system/browser, the long entry and return flights are skipped.

The first mission, **The Compute Run**, is ready immediately. Hold W and follow the cyan marker. Riding through each packet collects it automatically. Riding into the delivery marker with both packets completes the mission and earns 500 compute. SYNC REALITY cycles through three simulated news scenarios in Demo mode.

| Control            | Action                                               |
| ------------------ | ---------------------------------------------------- |
| W / Up             | Accelerate                                           |
| A / D              | Steer                                                |
| S / Down           | Brake                                                |
| F                  | Walk or remount while grounded                       |
| Space              | Jump, tap three times to activate flight             |
| E                  | Original trick controls                              |
| R                  | Interact with an active mission terminal when nearby |
| Drag / mouse wheel | Look / camera distance                               |
| T                  | Theater mode                                         |
| M                  | Sound                                                |
| Escape             | Return to the portal                                 |

Touch devices have the original steering stick plus jump, walking, and mission-interaction buttons.

## Live news

Copy `.env.example` to `.env`, set `CONTEXT_DEV_API_KEY` and `GEMINI_API_KEY`, and restart the server. Set `GEMINI_MODEL` to a compatible model available to your account. Select **Live news** before pressing SYNC REALITY.

Express retrieves a sourced article, asks Gemini for structured mission data, and validates it with the shared schema. The browser validates the response before changing the game. Failed requests preserve the current mission. Source name, source link, and retrieval time appear in the signal panel. Scenario dialogue and events are fictional adaptations of the headline.

**Verification status:** this workspace had no provider keys configured during implementation. The missing-configuration path was exercised against the real local backend. Successful and malformed API responses were tested using explicit browser fixtures. A real Context.dev → Gemini request still requires credentials and a model accessible to the account.

The gallery now shows a live painted view of the playable city; the approved Helsinki illustration is retained as artwork. The daytime sky, student/scooter and streetscape are rendered in 3D using the existing engine. Runtime image generation, generated voices, and video broadcasts are later extensions. The original synthesized game sounds remain active. Original village greetings are disabled so nearby robots and drones show the current scenario dialogue.

## Copy into another repository

Copy these root-level files and directories together:

- `public/` — game engine, scene additions, images, audio, and original client dependencies
- `src/` — current WEBWORLD interface, shared scenario validation, and earlier application modules
- `server/` — Context.dev and Gemini integration
- `scripts/` — browser verification
- `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `vite.config.ts`
- `.env.example`, `.gitignore`, `README.md`, `Design.md`

Run `npm ci` and `npm run dev` inside the destination. Dependencies and build output are regenerated. The playable application has no dependency on `starry-study/`.

## Build and verify

```sh
npm test
npm run build
npm start
```

The production app and API run together at [port 8787](http://127.0.0.1:8787/). Stop the development API before using `npm start` on that port.

With the development app running, run browser checks:

```sh
npm run test:browser
npm run test:portal  # entry, return, replay, portrait coverage and reduced motion
```

The browser checks use an installed Google Chrome through Playwright. `WEBWORLD_URL` can select another running local origin. Results and screenshots are written to `output/webworld/`. The checks cover real keyboard delivery, walking, flight, scenario changes, source attribution, invalid responses, and mobile layout. Provider success is simulated explicitly in these tests.

## Editing the game

| File                               | Responsibility                                                                                                                                                                                                                      |
| ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `public/engine/game.js`            | Readably formatted authorized derivative of the captured game. Original movement, camera, rendering, geometry and posing. Changes include the character palette/head, destination names, panorama, portal layout, and adapter hook. |
| `public/engine/webworld.js`        | Signs, mission markers, robots, drones, courier carts, scenario atmosphere, and the controlled game interface.                                                                                                                      |
| `public/engine/helsinki.js`        | Daylight palette and sky, original painted material integration, architectural details, birches, tram and tower clock.                                                                                                              |
| `public/engine/portal.js`          | Shared engine-clock timeline for the gallery frame, painting zoom/dissolve and return transition.                                                                                                                                   |
| `public/engine/student-scooter.js` | Student/scooter skin attached to the original rider rig; original steering, parking, spins, flips and flight wings.                                                                                                                 |
| `src/webworld/main.ts`             | Mission progression, HUD, source display, Demo/Live flow, and input for terminal interactions.                                                                                                                                      |
| `src/webworld/local-services.ts`   | Local scores and isolation of original external services, with forwarding for our own API.                                                                                                                                          |
| `src/webworld/webworld.css`        | Portal and responsive game interface.                                                                                                                                                                                               |
| `src/shared/schema.ts`             | Permitted mission actions, locations, world changes, and validation rules.                                                                                                                                                          |
| `server/director.ts`               | Gemini instructions and structured output parsing.                                                                                                                                                                                  |

The Helsinki art pass uses the existing street layout, building geometry, world curvature and collision system. It is an artistic interpretation, not an accurate Helsinki street map. Pale plaster, copper roofs, painterly clouds, birches, flower boxes, a parked tram and clock details replace the night palette. The generated painting is a 2D portal asset; the playable scene uses procedural 3D geometry.

Riding, walking, sprinting, jumping, flight, tricks, chase camera, orbit/zoom, scoring and mission rules retain their existing implementations. The student/scooter is a visual skin on the original rig. Added scenery and actors have no new traffic collision or combat system. SYNC REALITY still changes missions, actors and atmosphere; its three colour treatments now all remain daylight.

The gallery frame reads the painting’s actual aspect ratio. The original camera dive remains, with a continuous live scene behind the expanding frame. The return runs this visual timeline in reverse. Green HUD panels retain the news mode selector, source attribution and mission controls.

The original public client and assets are reused under the permission explicitly confirmed by the user in this conversation. The public-facing menu now uses WEBWORLD branding; source provenance remains documented here. `starry-study/` holds the original inspection, asset manifest, and earlier versions. The backend here is our local WEBWORLD backend. Global multiplayer and original online leaderboards are unavailable.

## Artwork and visual verification

The previously approved built-in image-generation artwork is now copied into this project:

- `public/art/helsinki/arrival.png` — approved Helsinki/student/scooter painting, retained for in-world gallery canvases and art direction; the title now renders the actual city.
- `docs/art-direction/helsinki-environment-kit.png` — approved environment reference sheet.
- `docs/art-direction/helsinki-prompts.md` — the original generation prompts and visual direction.

No new image generation or provider call is required to play. The former night panorama and sky files are retained for reference; the active sky uses a lightweight procedural daylight shader with the original projection and painted postprocessing.

Browser checks also verify the artwork aspect ratio, rendering without shader errors, and orbit/zoom while braking. Screenshots in `output/webworld/` include the portal, riding, student/scooter side view, walking, flight, scenario colour treatments and mobile layout. Live provider success remains tested through explicit fixtures unless real keys are configured.

For an optional video recording of the portal check, install Playwright’s video helper with `npx playwright install ffmpeg`, then run `PORTAL_VIDEO=1 npm run test:portal`. The recording is saved to `output/webworld/portal-transition.webm`; screenshots and checks are in `output/webworld/portal/`.

Check the district collision and mission paths with `node scripts/test-helsinki-map.mjs`. Map rendering and collision live in `public/engine/helsinki-real-map.js` and `helsinki-geography.js`; sourced geometry and mission destinations are in `public/data/helsinki/map.json`.

## Explore mapped Helsinki

Start in Rautatientori beside Central Station. Oodi is northwest; Senate Square and the cathedral are east; Esplanadi and the harbour are southeast. The minimap follows the imported footprints and roads. Walking, riding and flight retain their controls.

Map attribution is displayed in-game. The source and derived databases are available in `public/data/helsinki/`, with licensing and rebuild instructions in `SOURCES.md`. To check geographic landmarks, collision, courtyard roofs and pedestrian routes, run `node scripts/test-helsinki-map.mjs`.

The former procedural districts remain in the repository as inactive reference modules. The active renderer is `public/engine/helsinki-real-map.js`, with projection/collision in `helsinki-geography.js`.
