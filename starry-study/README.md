# Starry Nightrider feasibility study

## Aktuelle Version: Originalclient lokal

Nach der ausdrücklichen Wiederverwendungserlaubnis des Nutzers gibt es jetzt eine wesentlich genauere Version unter **[`reproduction/`](reproduction/README.md)**. Dort laufen die unveränderten öffentlichen Spiel-Bundles mit den Originalgrafiken und allen Sprachclips. Multiplayer und öffentliche APIs sind durch lokale Einzelspieler-Adapter ersetzt.

```sh
cd /Users/nampham/Documents/ChatGPT/Junction/starry-study/reproduction
npm ci
npm run dev
```

Dann [http://127.0.0.1:5178](http://127.0.0.1:5178/) öffnen. Details und Bildnachweis: [reproduction-report.md](reproduction-report.md). **Für die originalgetreue Darstellung `reproduction/` starten, nicht den älteren Ordner `prototype/`.**

## Ursprüngliche Studie und unabhängiger Prototyp

An evidence-based analysis of the public client at [starrynightrider.com](https://starrynightrider.com/), plus an **independently written** TypeScript/Vite/Three.js prototype. Everything for this task is in this directory; the existing application in the parent `Junction/` directory is untouched.

Start with [reverse-engineering-report.md](reverse-engineering-report.md), [architecture.md](architecture.md), [asset-inventory.csv](asset-inventory.csv), and [feasibility-matrix.md](feasibility-matrix.md).

## Run the prototype

Requirements: Node.js **22.12+**, npm, and a browser with WebGL 2. Keyboard/mouse required for gameplay; touch movement and gamepad are not implemented.

```sh
cd /Users/nampham/Documents/ChatGPT/Junction/starry-study/prototype
npm ci
npm run dev
```

Open [http://127.0.0.1:5178](http://127.0.0.1:5178/), then select **Begin the ride**. The server binds to loopback only. It does not contact the original game or any external API. No credentials or environment variables are needed.

| Control | Action |
|---|---|
| W / ↑ | Pedal or walk forward |
| A D / ← → | Steer |
| S / ↓ | Brake |
| Space | Jump; three taps within 1.1 seconds enable flight |
| Hold Space in flight | Climb; release to descend |
| E while airborne | Simplified spin trick; land after enough rotation for +50 |
| F while grounded | Toggle walking/bicycle |
| Drag scene / wheel | Orbit view / zoom |
| T | Theater HUD/collectible visibility |
| M | Toggle synthesized sound (starts off) |
| P / Pause button | Pause simulation |
| R / Reset button | Reset position and score |

Follow the lights along the main street to the gold ring before the steeple. Each orb adds 10 carried points. Enter the ring at ground level to deliver all carried points. This route is finite; reset starts another ride. It is intentionally simpler than the target. Reloading also resets scores; there is no persistence, multiplayer or leaderboard.

## Build and test

From `prototype/`:

```sh
npm test
npm run build
npm run preview
```

`npm test` runs four simulation checks. `npm run build` performs strict TypeScript checking and creates `dist/`. `npm run preview` serves the production build at the same port; stop the dev server first. The 556 kB single JavaScript chunk triggers Vite's size advisory but builds successfully.

In another terminal, from the **study directory**:

```sh
cd /Users/nampham/Documents/ChatGPT/Junction/starry-study
npm ci
npm run verify
```

The browser verifier expects the production preview on port 5178 and an installed Google Chrome (`channel: 'chrome'`). It launches an isolated headless profile, checks movement, braking, walking, jump/flight, theater, drag-look, delivery and pause, then records screenshots and timing. It also asserts no external prototype requests and no console/page errors. It closes its browser when finished. Stop the preview with Ctrl+C when done.

For a machine without Chrome, install the normal vendor build, or explicitly change both inspection and verification launch options to the same Playwright Chromium channel and install it using Playwright's supported installer. Such a run is a different benchmark environment and should be recorded as such.

## Reproduce the public inspection

**Saved evidence is already included.** Re-running the following contacts the public website and overwrites the evidence in this directory. Copy the study to a new dated directory first if preserving the historical capture matters.

```sh
npm ci
npm run inspect
npm run check-references
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm run format-evidence
.venv/bin/python scripts/analyze.py
```

Run `npm run verify` before `scripts/analyze.py`; analysis compares the captured original with the verified prototype. The reference checker performs at most three source-map GETs and six HEAD requests derived from known asset references. The browser inspection performs one page visit with ordinary keyboard actions, blocks all non-GET/HEAD requests, and intercepts WebSockets without forwarding to the server. It never submits scores or chat. Future site updates may change selectors, symbols, asset names or API behavior; inspect failures and update the script only from new public evidence. Do not convert missing references into a brute-force search.

`format-evidence` formats raw JS into separate analysis copies. It never rewrites canonical `evidence/raw/` bytes. `analyze.py` runs offline and regenerates the CSV and `evidence/measurements.json`. Pillow is used for image dimensions and a palette-distribution measurement, not image generation.

## Directory layout

```text
starry-study/
  reverse-engineering-report.md
  architecture.md
  asset-inventory.csv
  feasibility-matrix.md
  README.md
  prototype/                 # Standalone original runnable app and tests
  scripts/
    inspect.mjs              # Public page inspection, writes/WS blocked
    instrument.mjs           # Shared read-only measurement hooks
    verify.mjs               # Local production browser verification
    check-references.py      # Bounded public map/metadata checks
    format-evidence.mjs      # Pretty copies + symbol index
    analyze.py               # Offline inventory/metrics
  evidence/
    raw/                     # Original downloaded bytes; never app dependencies
    *.js                     # Formatted inspection copies, not recovered sources
    *.json                   # Responses, timing, actions, checks, metrics
    original-*.png            # Screenshots of captured target
    prototype-*.png           # Screenshots of the tested prototype
```

## Interpretation and rights boundaries

- Public JavaScript is a shipped client build, not the original repository. Three tested source maps were unavailable.
- Original static/runtime evidence and prototype behavior are distinguished throughout the reports. Some input attempts did not conclusively activate the intended original mode.
- Original server code is unavailable. The prototype has no original service integration.
- Target assets, bundles, shader captures and screenshots are retained locally as analysis evidence. Public access does not grant a redistribution/reuse license. Keep them out of prototype builds and any published package.
- The prototype's application code, shader, generated textures and geometry were newly authored. Third-party runtime dependencies come from npm and retain their licenses (including Three.js MIT); see package metadata and `node_modules/three/LICENSE` after installation.
- The work is not a formal separated-team clean-room reconstruction, and the visual rubric is not a percentage of recovered code.
- Tests passed on the recorded desktop environment; touch interaction, gamepad, mobile GPU performance and long-duration memory behavior remain unverified.
