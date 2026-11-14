# WEBWORLD — What If the Internet Was a Video Game?

**Junction 2026 Hackathon Prototype**

WEBWORLD is a **GTA V-inspired**, AI-directed 3D open-world game prototype starring **Jensen Huang** in **Los Silicon** — featuring realistic California golden-hour/dusk urban PBR graphics (`ACESFilmicToneMapping` + `RoomEnvironment` IBL reflections, glass curtain-wall towers, asphalt boulevards, palm trees, clearcoat supercars) combined with rigged mocap character locomotion, Rapier 3D kinematic physics, 2-bone foot IK, and over-the-shoulder/first-person camera mechanics adapted from [`blendi/oil-paint`](https://git.patch.gg/blendi/oil-paint.git) (MIT / CC0 1.0). Real-world internet headlines dynamically reshape the 3D city's sky, lighting, commercial LED billboards, street traffic, pedestrian moods, autonomous androids, drones, and playable missions.

---

## Quick Start

### 1. Prerequisites
- **Node.js** `>= 20` (tested on Node `v26.3.1`) and **npm** `>= 10`

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment (Optional for Demo Mode, Required for Live Mode)
Copy `.env.example` to `.env` in the repository root:
```bash
cp .env.example .env
```

Edit `.env` to add your API credentials for **Live Mode**:
```env
GEMINI_API_KEY=your_gemini_api_key
CONTEXT_DEV_API_KEY=your_context_dev_api_key
GEMINI_MODEL=gemini-4-hydrogen
GEMINI_PRO_MODEL=gemini-4-carbon
PORT=3001
```

> **No API keys? No problem.** WEBWORLD boots automatically into **Demo Mode** when credentials are absent, offering three deterministic, clearly labeled simulated scenarios (**Event A: Robot Uprising**, **Event B: GPU Market Crash**, and **Event C: Technology Breakthrough**).

### 4. Run Locally (Backend + Frontend)
```bash
npm run dev
```
- **Game Client (Vite + React Three Fiber)**: `http://localhost:5173`
- **Backend Server (Express + Gemini + Context.dev)**: `http://localhost:3001`

---

## Controls

| Input | Action |
|---|---|
| `W` `A` `S` `D` / `Arrow Keys` / Left Stick | Move around Los Silicon (root-motion starts/stops/turns + stride-synced gaits) |
| `Shift` / `L3` or `RB` | Sprint |
| `Alt` (hold) or `CapsLock` (toggle) | Walk pace |
| `C` or `Right-Click` (pointer-locked) / `LT` | 8-Way Strafe / Aim locomotion |
| `Space` / `A` | Jump (on foot) / Handbrake (in supercar) |
| `F` / `Y` (Gamepad) | **Enter / Exit nearby GTA Supercar** (`NVIDIA Tensor GT`, `Vinewood Comet R`, `Founder Roadster V12`) |
| `V` / `Select` | Toggle **GTA Over-the-Shoulder 3rd-Person** ↔ **1st-Person Eye View** |
| `Mouse Drag`, `Double-Click` / `L` Pointer Lock, or `Q` / `E` | Rotate camera |
| `Mouse Wheel` / D-Pad Up·Down | Zoom camera distance |
| **Walk or Drive into Yellow Mission Corona** | Complete active mission & earn `$ / TFLOPS` |
| **Tap `SYNC REALITY` on iFruit Smartphone** | Pull headline & transform the 3D world |

---

## Operating Modes & Provenance Honesty

1. **Demo Mode (`DEMO MODE`)**
   - Works completely offline without API keys.
   - Cycles through (or lets you pick) 3 deterministic world transformations:
     - **Event A — Robot Uprising**: Crimson emergency sky, rotating red sirens, 12 rogue bipedal AI robots patrolling/chasing in the streets, panicking citizens, ember sparks, and a mission to patch `OmniMind AI Lab`.
     - **Event B — GPU Market Crash**: Amber/red crash lighting, crashing stock billboards, high-speed swerving chaos traffic, digital rain, and a mission to stabilize futures at `Silicon Stock Exchange`.
     - **Event C — Technology Breakthrough**: Electric cyan sky, 12 quad-rotor sky drones with volumetric searchlights, celebrating citizens, data snow, and a keynote launch at `Keynote Holo-Dome`.
   - Every Demo event carries `provenance: "simulated_demo"` (`sourceUrl: null`) and a prominent **`SIMULATED DEMO`** badge so fictional scenarios are never mistaken for real journalism.

2. **Live Mode (`LIVE MODE`)**
   - Uses the official **`context.dev`** SDK (`client.news.search` with `client.web.search` fallback) to retrieve real, recent tech headlines across NVIDIA, AI, GPUs, Big Tech, and Product Launches.
   - Sends the normalized article to the **Gemini AI World Director** via the official **`@google/genai`** (`>= 3.2.0`) **Interactions API** (`client.interactions.create`) with strict JSON Schema structured output validated at runtime by **Zod**.
   - **Never silently falls back to mock data**: if an API key is missing or an upstream request fails, the HUD surfaces a transparent error with an explicit button to switch to Demo Mode.

---

## Verified Gemini Models

Verified against the official `gemini-api-dev` skill (`@google/genai` v3.3.0 Interactions API):
- `gemini-4-hydrogen` — Default fast daily driver (recommended replacement for legacy `gemini-3.8-flash`)
- `gemini-3.5-flash-lite` — Ultra-fast, lowest-latency Flash-Lite option
- `gemini-4-carbon` — Configurable flagship / Pro-tier reasoning model
- `gemini-3.8-flash` — Supported active legacy model for compatibility
- Future multimodal hooks centralized in config: `gemini-nano-banana-2.1` (image) and `gemini-omni-1.2-flash` (video)

---

## Scripts

- `npm run dev` — Build shared types and run backend (`:3001`) + frontend (`:5173`) concurrently
- `npm test` — Run Vitest unit & integration test suite across `shared`, `server`, and `client`
- `npm run build` — Compile production TypeScript and Vite bundles for all workspaces
- `npm run typecheck` — Type-check all workspaces without emitting files
