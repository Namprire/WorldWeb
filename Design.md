# WEBWORLD discovery prototype

The active experience is a playable startup exhibition in geographically mapped Helsinki. Exploration drives discovery; the interface stays out of the way until a player approaches a company or opens search. There are no active missions, dialogue, rewards, checkout, payments or delivery actions.

## Runtime boundary

`main.ts` installs the local service adapter and discovery UI, then loads `public/engine/game.js`. The existing renderer, frame loop, student rig, riding/walking/flight physics and gallery portal remain. The engine calls `installWebworld`, which installs painted Helsinki, pedestrians and the startup exhibits, then dispatches `webworld-ready`.

The TypeScript layer validates the local company collection before passing it into the bridge. The scene receives only placement, display and selection data. It exposes snapshots, projection, matching, source-change highlights and UI/map state. Services never manipulate meshes or movement.

`state.uiFocused` skips the player's physics update while search, a profile or map view is open. Input capture blocks gameplay shortcuts while typing; a blur event clears held keyboard controls. The original follow camera runs normally; the scene adapter interpolates its position and orientation toward a fixed overview only when city view is active. The camera matrix is updated before projecting company labels. Returning blends back to the existing follow camera. The title portal retains its original entry/return sequence.

## Data and trust

`public/data/startups/companies.json` is a curated, reviewed snapshot with primary-source URLs and dates. The Zod schema validates exhibition positions and optional published office addresses with HTTPS sources and OpenStreetMap coordinates. City view projects office coordinates into the same 3D map and groups nearby visible markers in screen space. The gameplay layer still uses the Rautatientori exhibit positions. Unknown facts remain null.

Search matches local name, description, sector and unexpired job titles. Hiring requires a sourced, dated job with an explicit expiry; expired jobs disappear automatically when rendering/filtering. The browser persists discovery IDs only, without an account.

`server/startups.ts` owns Context.dev credentials and a fixed URL allowlist drawn from the reviewed collection. Requests are bounded, two at a time, and concurrent users share a refresh. Content hashes and observation dates persist under ignored `output/`. On failure the reviewed collection and last successful observation remain. A changed source means “review needed”, not a verified new business fact. The first fetch establishes a baseline. There is no scheduled monitor or autonomous field extraction yet.

The old news/mission backend and earlier React application modules remain inactive reference implementations. The current UI never calls `/api/sync`.

## Art and video

The environment selector exposes `autumn` and `aurora` as presentation presets.
`oil-paint/environment.js` owns validated settings and local persistence; the scene
bridge exposes `setEnvironment`. It never moves the rider or changes collision
geometry. Switching at the title invalidates its single rendered frame, then
freezes the replacement painting. Existing entry/return timing stays unchanged.

Autumn uses Patch's sky brush directions and five foliage pigment families.
The 2,436 map trees use branching trunks and layered crowns with one shared
material, indexed quad geometry and existing tile culling. Wind and falling leaves
use the engine clock, frozen on the title and for reduced motion. Ground litter
and drifting leaves are hidden in atlas view. A static 2048px canopy shade atlas
adds ground shadows with no additional scene render; it is a visual approximation,
not a full building or terrain shadow simulation. No new renderer or runtime
dependency is introduced.

The existing Patch oil-paint brush atlas, foliage, sky curtains and warm night lighting remain inside one renderer. Company displays are new scene meshes, with legible canvas signs and animated ring markers. Three elevated shader screens provide immediate moving artwork. Art clocks freeze for reduced motion.

Optional Gemini video is deliberately separate from exploration. `scripts/generate-exhibit.ts` previews an allowlisted prompt by default. Explicit `--accept-charges` submits a background Interactions operation via the server module, saves its ID, polls and stores the result and provenance on disk. Re-running resumes a saved job or returns the cached clip. This is an operator-driven pipeline, not a browser generation endpoint. No actual paid generation was run during this implementation.

`GET /api/startups/exhibits` exposes local MP4 paths only. The scene plays at most the nearest clip within 110 metres; textures update at a capped rate. Other screens keep their shader fallback. Playback pauses in map view, when the tab is hidden and for reduced motion. No generated footage is used as evidence about a company.

Source refresh and media generation do not depend on one another. The game remains playable with no credentials or network provider access.

## Verification

The discovery browser suite covers loading, riding into an exhibit, R interaction, profile attribution, search/sector/hiring filters, input isolation, map camera, Escape return, walking/remounting and mobile bounds, plus runtime/shader errors. Unit tests validate records, safe sources, combined filters and vacancy expiry. Existing portal and geography suites protect the retained experience. Remote Context.dev and Gemini success require real credentials and are not claimed as tested.

See README.md for commands, provider limitations and source licensing.
