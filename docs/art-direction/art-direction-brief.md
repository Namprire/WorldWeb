# Art direction brief — WEBWORLD: Ideas After Dark

## Game frame

- **Player fantasy:** Step through a gallery frame into an oil-painted nocturnal Helsinki on a student's standing electric scooter, exploring Rautatientori and central Helsinki under northern lights to discover the companies building what comes next.
- **Core verbs:** Ride, steer, brake, walk/remount, leap/fly, approach & inspect startup exhibits (`R`), search & filter companies (`/`), rise into City View (`V`), pause back into the gallery frame (`Esc`).
- **Engine and renderer:** Custom Three.js WebGL 2 forward/composited renderer (`public/engine/game.js`) with the Patch procedural oil-paint surface & brush-atlas pipeline (`public/engine/oil-paint/`), dynamic 2D canvas signage (`public/engine/webworld.js`), and HTML/CSS discovery HUD (`src/webworld/main.ts`, `src/webworld/discovery.css`).
- **Target platforms:** Desktop and mobile modern web browsers supporting WebGL 2 (responsive from `390×844` mobile portrait up to `1440×900+` desktop landscape).
- **Camera/view/facing:** Third-person chase camera behind the student rider (`fov: 50°–75°`), interpolating smoothly to an elevated orthographic-like oblique overview (`position: [0, 185, 125]`, `lookAt: [0, 0, -32]`) in City View, and framed inside a gallery mat during title/pause states (`public/engine/portal.js`).
- **Native viewport and common display scale:** Full-bleed responsive WebGL canvas (`1280×800` / `1440×900` reference desktop, `390×844` reference mobile) with dynamic resolution scaling (`state.quality` between `0.55` and `1.0` targeting 60+ FPS).
- **Typical asset size on screen:**
  - Student & scooter rig: ~12–18% of viewport height in chase view (`~1.85 m` world height).
  - Exhibition signboards: `4.8 m × 2.4 m × 0.1 m` world size (`1024×512` 2D canvas texture), occupying ~15–35% viewport width when approached within interaction radius.
  - Elevated cinematic exhibit screens (Aiven, Varjo, Oura): `9.0 m × 5.0 m × 0.1 m` at `y = 8.1 m`.
  - Ground discovery rings: `8.8 m` diameter (`r = 4.4 m`) segmented 64-box ring at `y = 0.12 m`.

## Visual system

- **Shape language:**
  - **Architecture:** Grounded Nordic neoclassical, Jugendstil, and contemporary timber/glass masses extruded from sourced OpenStreetMap footprints (`1,301` buildings, `95` landmark building parts including Central Station clock tower, Oodi, and Helsinki Cathedral).
  - **Characters & vehicles:**Tactile low-poly procedural primitives (ellipsoids, tapered tubes, rounded boxes) assembled into readable silhouettes without skeletal mesh imports.
  - **Exhibition props:** Clean architectural steel stanchions, wide 2:1 signboards, elevated 16:9-like (`9:5`) floating art screens, and circular ground rings.
- **Silhouette priorities:**
  1. Student rider profile (cream helmet, teal jacket, rust canvas backpack, standing mint-accented scooter deck/stem).
  2. Landmark towers & rooflines against the aurora sky (Central Station clock tower, Cathedral domes, Oodi timber curve).
  3. Startup exhibition rings and elevated glowing screens in Rautatientori corridor.
  4. Birch/pine street trees and ambient pedestrians (`172` walkers).
- **Value structure:** High-contrast nocturnal value hierarchy—deep navy/slate sky and ground (`#0a1420` to `#101e2b`), mid-value warm plaster/granite facades illuminated by streetlamp pools and moonlight, and high-value luminous accents (`#9de5c3` mint UI/rings, `#f5f0e7` signboard typography, aurora curtains, and company accent colors).
- **Palette roles and exact swatches:**
  - **Gallery mount & UI surfaces:** Midnight linen `#0a1420`, frame slate `#263b42`, discovery pane `#152730` → `#0b151d`, signboard navy `#101e2b`, intro board parchment `#f0e5c9` with ochre border `#997b43`.
  - **Primary interactive & brand accents:** Luminous mint `#9de5c3`, hover mint `#c3f4d7`, muted slate-teal `#acbbca`, warm focus terracotta `#ad633c`, ivory typography `#f7f0df` / `#f2eee4`.
  - **Helsinki architecture (`helsinkiSurfacePalette`):** Warm ochre plaster `rgb(0.78, 0.61, 0.34)` (`#c79c57`), terracotta plaster `rgb(0.70, 0.43, 0.34)` (`#b36e57`), pale Nordic cream `rgb(0.80, 0.74, 0.57)` (`#ccbd91`), oxidized copper roofs `rgb(0.12, 0.28, 0.25)` (`#1f4740`), slate roofs `rgb(0.18, 0.23, 0.26)` (`#2e3b42`), pale granite `rgb(0.66, 0.60, 0.46)` (`#a89975`).
  - **Student & scooter rig:** Teal jacket `rgb(0.08, 0.25, 0.22)` (`#144038`), cream hoodie/helmet/sneakers `rgb(0.84, 0.79, 0.64)` (`#d6c9a3`), rust backpack `rgb(0.52, 0.23, 0.085)` (`#853b16`), charcoal trousers `rgb(0.085, 0.12, 0.13)` (`#161f21`), graphite deck `rgb(0.17, 0.23, 0.21)` (`#2b3b36`), mint scooter accents `rgb(0.27, 0.49, 0.37)` (`#457d5e`).
  - **Company exhibit swatches (`companies.json`):** Aiven `#83e4cf`, Varjo `#b8a4fa`, Oura `#efb978`, ICEYE `#8ebeff`, Reaktor `#f19c91`, Smartly `#eeb2f5`, Supermetrics `#f1cb75`, Yousician `#9fe4ac`, Sulapac `#8bcdc4`, Solar Foods `#e3c46e`.
- **Materials and surface cues:**
  - **Oil-paint impasto (`public/engine/oil-paint/surface.js`):** Procedural 8-mark bristle brush sheet (`512×256` RGBA canvas texture) mapped in object-space UVs with explicit screen-space derivatives (`textureGrad`) so camera rotation never causes "shower-door" swimming. Three-tone pigment mixing (warm light, native midtone, cool shade) plus stationary linen canvas weave in post-processing.
  - **Signage & screens:** Un-dabbed readable 2D canvas textures with subtle procedural brush tooth (`0.035`) and emissive/gamma-lifted shader screens.
- **Edge/line treatment:** Soft post-process depth/normal outline (`uOutline = 0.16`), crisp 1px–2px UI borders (`#9dbfb933` / `--company` left border), and bold sans-serif canvas typography on exhibition boards.
- **Lighting direction and contrast:** Upper-left moon/sky directional light (`normalize(vec3(-0.45, 0.72, 0.38))`), ambient sky `rgb(0.075, 0.13, 0.20)`, ambient ground `rgb(0.025, 0.045, 0.065)`, scooter headlamp (`uHeadPower = 1.6` while riding), and filmic composite (`uExposure = 0.72`, `uContrast = 0.09`, `uSaturation = 1.08`, `uBloom = 0.18`).
- **Detail density and focal hierarchy:** Broad brushstroke LOD clamping (`lod` clamped to `[-1.0, 2.5]` with `uStrokeDist = 48 m`) keeps distant roofs and streets calm while concentrating bristle relief, lamp pools, and crisp typography on nearby exhibits and the player rig.
- **Motion character:** Smooth spring-damped scooter lean and wheel rotation, gentle sinusoidal ring pulse (`0.025 * sin(t * 1.5 + phase)`), slow procedural aurora curtains and exhibit shader waves (`t = clock * 0.22`), and full `prefers-reduced-motion: reduce` support (freezes shader clocks, aurora, and CSS orbits; shortens portal dive).
- **Explicit exclusions:**
  - No fake offices or unverified geocoded claims (every Rautatientori board explicitly states `DISCOVERY EXHIBITION · NOT AN OFFICE`).
  - No baked text or brand logos inside generated raster/video art (all typography is code-rendered on 2D canvases or DOM).
  - No Van Gogh cypress overlay in Helsinki (`lu.visible = false` in `game.js`).
  - Not a daytime lighting scene in the active runtime (daylight files in `docs/art-direction/` are archived concept boards only).

## Technical contract

- **Asset dimensions/aspect:**
  - Procedural brush atlas (`brush.js`): `512×256` (`4×2` grid of `128×128` cells, power-of-two).
  - Dynamic exhibition signboards (`webworld.js`): `1024×512` (2:1, power-of-two).
  - Active sky/canvas raster textures: `webworld-sky.png` (`1536×1024` RGB PNG, multiple of 4), `art/helsinki/arrival.png` (`1672×941` RGB PNG), `flow.png` (`500×396` RGB PNG), `cypress.png` (`1500×1188` RGB PNG, hidden in Helsinki), `fill.png` (`375×297` RGB PNG).
  - Social / OpenGraph preview: `og-painting.jpg` (`1200×630` RGB JPEG).
  - UI avatar icon: `local-avatar.svg` (`64×64` viewBox vector SVG).
- **Alpha/background:** Full-bleed sky, canvas, and concept textures are opaque `RGB` (`has_alpha: false`). UI icons use clean vector SVG transparency.
- **Grid/tile/frame size:** Brush sheet uses 8 cells (`4` columns × `2` rows, `128×128 px` each) with clamped UV margins (`clamp(q, 0.005, 0.995)`) to prevent atlas bleeding.
- **Anchor/pivot/baseline:**
  - World coordinates: Equirectangular local metres centered in Helsinki (`east = +X`, `south = +Z`, ground at `y = 0`).
  - Student & scooter rig: Root at ground contact `y = 0`, wheel centers at `y = 0.16 m`, head pivot at `y = 1.67 m`.
  - Exhibition boards: Center-mounted at `y = ground + 3.5 m` with twin steel supports reaching `y - 2.0 m`.
- **Filtering/mipmaps/compression:**
  - `flow.png` and optional exhibit `<video>` textures: `generateMipmaps = false`, linear filtering (`LinearFilter = 1006`).
  - `brush.js` atlas and `arrival.png` / `webworld-sky.png`: `generateMipmaps = true`, trilinear filtering with max hardware anisotropy, `ClampToEdgeWrapping`.
- **Color space:** Engine textures load with default linear/raw sampler handling and apply explicit gamma/exposure curves in fragment shaders (`pow(tex.rgb, vec3(2.2))`).
- **Texture/poly/material budgets:**
  - Single merged static world geometry per city layer + `10` exhibition stations (~35–55 draw calls total in Rautatientori).
  - At most **1** active `<video>` texture decoded and uploaded within `110 m` capped at `12.5 Hz` (`0.08 s` interval); all other screens use zero-bandwidth procedural GLSL.
- **Naming and folders:**
  - `public/engine/` — Core runtime, Helsinki procedural geometry, student rig, portal, and `oil-paint/` shaders + MIT provenance.
  - `public/data/helsinki/` — Sourced OSM geometry (`source.osm.json`, `map.json`, `map-data.js`, `SOURCES.md`).
  - `public/data/startups/` — Validated startup exhibition dataset (`companies.json`).
  - `public/art/helsinki/` & `public/` — Shipped raster textures and SVG icons.
  - `public/hails/` — Ambient rider voice/hail audio clips (`*.mp3`).
  - `public/media/exhibits/` — Optional operator-generated `.mp4` + `.json` provenance sidecars.
  - `docs/art-direction/` — Art direction brief, asset manifest, and concept boards.

## Visual target

- **Approved seed/reference paths:**
  - Active nocturnal oil-paint look: `public/engine/oil-paint/NOTICE.md`, `public/webworld-sky.png`, `public/art/helsinki/arrival.png`.
  - Exploratory daylight concept studies (non-runtime): `docs/art-direction/helsinki-environment-kit.png`, `docs/art-direction/helsinki-prompts.md`.
- **Required do/don't examples:**
  - **DO:** Route all new 3D city/actor meshes through `engine.paintMaterial()` with semantic `aData` kinds so they inherit the 8-mark bristle relief and linen weave.
  - **DO:** Keep company exhibit boards clearly labeled `DISCOVERY EXHIBITION · NOT AN OFFICE` and backed by primary HTTPS sources in `companies.json`.
  - **DON'T:** Bake text or company logos into AI-generated raster or video files.
  - **DON'T:** Enable uncalibrated base-engine projections (`cypress.png` mesh `lu` must remain `visible = false`).
- **Native-scale gameplay capture:**
  - Title gallery portal: `output/webworld/portal/00-gallery.png`
  - Active nocturnal city ride & exhibit: `output/webworld/portal/04-playing.png`, `output/webworld/discovery/profile.png`
  - Mobile responsive layout: `output/webworld/discovery/mobile.png`
- **Approval owner/date:** WEBWORLD team (`nampham`) · 2026-11-14
