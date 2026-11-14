# Feature-by-feature feasibility

**Follow-up:** the Prototype status column describes the original independent `prototype/`. After the user's reuse authorization, an original-client execution path was added under `reproduction/`; see [the reproduction report](reproduction-report.md). Its fidelity and implementation approach differ from this matrix's prototype.

Evidence applies to the public build captured on 14 November 2026. **High** confidence means directly supported by a response, screenshot, test or explicit client implementation; **medium** means bounded inference or partial observation; **low** means insufficient validation. Feasibility concerns an independently written equivalent, not permission to redistribute the original implementation.

Evidence keys: **B** = formatted `evidence/index-BY2CcXjY.js` with function anchors in `architecture.md`; **K** = `kit-DsD4Rc8o.js`; **N** = `network.json`; **R** = `runtime.json`; **O** = `observations.json` and `original-*.png`; **P** = `prototype-checks.json`; **M** = `measurements.json`.

| Feature | Observable / recoverable evidence | Independent reconstruction feasibility | Prototype status | Remaining experiment or limitation | Confidence |
|---|---|---|---|---|---|
| Public JS/CSS/HTML | N: 200 responses, raw bytes and SHA-256; three app modules | High for behavior analysis | Independent files only | Original filenames, project structure, source comments outside preserved shader strings unavailable | High |
| Original source maps | No directives in three modules; three adjacent `.map` requests returned 404 | Original source recovery not established | No claim of recovery | Other unpublished/unreferenced maps not searched | High for tested URLs; unknown globally |
| Engine | K `__THREE__=187`; R WebGL 2 context | High | Three 0.185.0 | Exact original dependency lock/custom patches unknown | High |
| Bundler / UI framework | ES module preload polyfill and hashed paths; direct DOM listeners | Straightforward to reproduce in Vite | TypeScript + Vite 7.3.8, direct DOM | Original Vite use is inference; no React established | Medium |
| Painted night atmosphere | O screenshots; B `va`, `io`, `ra`; five boot textures | High for broad atmosphere; costly for close match | Original canvas stone textures, blue village, warm lamps, procedural sky | Exact painted motifs and brush behavior substantially differ | High feasibility; low visual equivalence |
| Sky flow / star halos | B sky GLSL and samplers; R compiled sources | Equivalent technique feasible with original art/shaders | Own trig-based flowing sky and star glow | No target painting/flow/fill reused; original star placement not matched | High |
| Terrain and street world | K world helpers, B `_o` generation queue; O villages/hills | Medium–high with significant environment work | Finite flat street, houses, hills and cypresses | No streaming, terrain elevation, extended districts or interiors | High on observed design; medium total scope |
| Rider and bicycle | B `ds` and geometry builders; O rider | High at reduced fidelity | Procedural primitives, hat/scarf, pedal animation | No detailed anatomical rig, original costume mesh or wing geometry | High |
| Chase camera | B `Ns`; O changed framing | High | Smooth chase, speed FOV, drag orbit, zoom, collision ray | Original damping/lift/shake not calibrated by controlled trajectories | High static; medium behavioral parity |
| Painting-to-world entry | B `Hu`/`Wd`; O title/ride | High, with art and camera alignment effort | Own intro overlay fades out | No matched painting projection or cinematic dive | High |
| Bicycle throttle / steer / brake | B `js`, `Ps`; O pedal/turn | High | P: movement and braking; pure simulation collision test | Prototype does not auto-cruise at idle or use lane assist; speeds differ | High |
| Jump and landing | B vertical update; O jump input + flight; P jump test | High | Gravity, impulse, ground contact | No roof landing, coyote time or variable held-jump profile | High static; medium original standalone jump verification |
| Triple-tap flight | B `fd`/flight branch; O visible wings and flight toast | High | P: triple tap and altitude increase | No rendered wings, no original flight envelope | High |
| Walking | B `setWalking`/walk update; original screenshot attempt still shows bicycle | High | P: F toggles mode, lower speed and changed pose | Original walking activation not conclusively verified at captured instant; no wall climbing/reverse | High static, medium runtime |
| Air tricks | B `tricks`/`land`/`Cd` | Medium–high | One spin with +50 on qualifying landing; unit test | Original combo, bail, roof bonus and full rotation rules omitted; original E not runtime exercised | Medium |
| Orb collection | B `pc`/`Cd`; O score changes 0→25→30 | High | P: collection while moving; one-time collection set | Fixed path; original streak, prisms and routes omitted | High |
| Steeple delivery | B `Wl`/`sd`/`Cd` and UI instructions | High | P: normal keyboard ride banks ≥150 points | Original delivery not reached and confirmed in automated trace; local-only score | High static/prototype; medium original runtime |
| Boost / hyper meter | B `Cd` and `js` boost branch | High with tuning | Not implemented | Need runtime activation and duration/handling validation | Medium |
| Lighting / AO / bloom | B `to`, materials, R shader hooks | High technically | Hemisphere + moon + lamp lights; library bloom | No original material response, AO, outlines, bend or custom composite | High |
| Particles | B glow/orb emitters; O luminous trail | High | Orb bobbing and floating points | No matched burst/trail lifetime or pooling | High for broad effect |
| Audio | B `vc` and `pl`; N three MP3 responses; hails table | High for procedural sounds; new voice recording needed | Original synthesized collection/delivery tones | No music bed, NPC voices or acoustic equivalence; audio quality not measured | High for resources; medium reproduction |
| NPCs | B walker vertex shader/actions and greetings; O townsfolk | Medium–high | Not implemented | Procedural animation, avoidance and ambient speech need separate implementation | High observation; medium effort |
| Theater mode | B `yd`; O theater screenshot | High | P: T hides HUD and collectibles | Original also changes several game display groups; parity incomplete | High |
| Touch / gamepad | B `Ps` touch and gamepad branches | High with device testing | Responsive layout only, keyboard/mouse required | No touch movement/gamepad support; no physical-device tests | Medium |
| Multiplayer rendering / protocol | B `Xc`: 13-value outgoing state, handlers, snapshot interpolation; N blocked WS attempt | Medium–high for a separate self-hosted design | Not implemented | Server behavior, packet authority and true on-wire timing unverified | High client structure; low server parity |
| Multiplayer collision / loose orbs | B hit/grab sends and loss/transfer handlers | Medium with own server | Not implemented | No interaction with live riders; original adjudication unavailable | Medium client; unknown server |
| Presence | B `Mc`; N blocked POST; visible rider count in initial normal visit | Simple independent counter feasible | Not implemented | Counts do not establish co-located riders or server retention policy | High client; unknown server |
| Leaderboard | N successful GET; B `Rl` start-token and submit flow | High for own service; original backend unavailable | Local delivered score only | No score submitted, no token response captured; validation/storage unknown | High API reference; low implementation recovery |
| Chat / interactive talk | B contains `say` and `/api/talk`; bootstrap disables chat button and R action | Uncertain current availability | Not implemented | Dormant code is not proof of active service; provider/moderation unknown | Medium for inactive UI; low backend |
| Performance | M: short rAF samples, load timing, heap snapshots | Measurable within stated limits | ~60 rAF/s locally, no console/page errors in final test | Not GPU FPS, no long soak/device matrix, no GPU memory measurement | High raw measurements; low generalization |
| Exact visual match | M palette overlap 0.263; screenshot comparison | Requires original replacement art and much more tuning | Low-to-moderate broad resemblance | Metric is palette-only, not a 26.3% reconstruction score | Medium subjective assessment |

## Engineering estimates (not measured labor)

For one experienced browser-3D engineer, with art support where noted:

| Increment beyond this prototype | Rough effort | Main uncertainty |
|---|---|---|
| Calibrated handling, roof/interior collision, camera transitions and tricks | 1–3 engineer-weeks | Hidden edge cases and feel across geometry |
| Larger procedural town, NPCs, routes, minimap fidelity | 2–5 engineer-weeks | Original generator complexity and content density |
| High-quality original painterly assets, sky flow, materials and composition | 3–8 artist/graphics-engineer weeks | Art fidelity without reusing target assets |
| Independent multiplayer, presence and persistent leaderboard | 2–5 engineer-weeks | Authority, abuse handling, persistence, scaling and network testing |
| Mobile/gamepad tuning, optimization and regression testing | 1–3 engineer-weeks | Device and browser coverage |

These ranges overlap and should not be mechanically summed. Exact original backend behavior and original repository recovery have no supported completion estimate. This session produced a feasibility study and a deliberately smaller playable prototype, not a production rebuild.
