# Clean night cinematics — no game UI

The latest night-focused promotional set, captured from the Startup City version at http://10.0.40.63:5179/.

Title, painting frame, buttons, HUD, search, labels and panels are hidden in every exported shot. Only map attribution remains. The first shot is a full-screen city reveal.

- [Watch the night launch reel](night-launch-reel.mp4): five animated camera shots with crossfades, silent for your launch soundtrack.
- `video/`: five separate 1920 × 1080 H.264 MP4s at 30 fps export.
- `screenshots/`: six full-resolution 1920 × 1080 night PNGs.
- [Screenshot preview](contact-sheet.jpg) · [Video shot preview](video-contact-sheet.jpg)
- `source/`: original browser recording. Actual browser frame cadence can vary.

## Shot list

| File | Length | Shot |
| --- | ---: | --- |
| [01-night-city-reveal.mp4](video/01-night-city-reveal.mp4) | 8.5s | UI-free night city reveal beneath the northern lights. |
| [02-aurora-skyline-sweep.mp4](video/02-aurora-skyline-sweep.mp4) | 10.5s | Slow sweeping skyline shot beneath the animated northern lights. |
| [03-night-architecture-orbit.mp4](video/03-night-architecture-orbit.mp4) | 9.5s | Close orbit of the station: photographic plaster, glazing, projecting stone sills and cornices. |
| [04-night-rooftop-glide.mp4](video/04-night-rooftop-glide.mp4) | 10.4s | Smooth camera glide across the illuminated buildings and rooftops. |
| [05-night-city-rise.mp4](video/05-night-city-rise.mp4) | 11.8s | A rising reveal from the architectural square to the whole luminous city. |

## Video-only visuals

This set uses an AI-generated photographic Finnish facade texture, warm window interiors, projecting stone sills and lintels, cornice courses, rain pipes and roof details. Camera moves and animated northern lights run inside the game renderer. These are promotional renderings; they do not represent the current gameplay graphics. The underlying map and approximate building geometry remain stylized.

All material and geometry changes exist only in isolated capture browser pages. The remote branch was not edited. The scene uses fixed night lighting and a restrained cool fill to show architectural details. Map attribution remains visible.

Texture: [helsinki-photographic-facade.png](../materials/helsinki-photographic-facade.png), generated for this project. Building details are artistic additions, not verified facade reconstructions.

To recapture: `node scripts/capture-night-cinematics.mjs --no-ui`. To verify and regenerate previews: `python3 scripts/verify-night-cinematics.py --no-ui`.
