# Startup City launch footage

**Latest UI-free night set:** [Clean night cinematics and launch reel](night-cinematics-clean/README.md).

**Latest preferred night set:** [Photographic night cinematics and launch reel](night-cinematics/README.md).

Captured from http://10.0.40.63:5179/. All clips and screenshots are 1920 × 1080. MP4 exports use H.264, 30 fps, CRF 17 and no audio. Original browser recordings are retained under `source/`; browser frame cadence may vary.

## Building treatment

Clips named `original` show the running game without building-material changes. Clips named `enhanced` use a video-only architectural finish applied inside isolated capture browser pages. It sharpens window surrounds, smooths plaster, adds subtle sill shading and roof seams, and reduces glowing windows. It preserves the existing footprint geometry, approximate building shapes, trees and streets. This is a more restrained architectural treatment, not a photorealistic reconstruction.

No files or settings were written to the remote game branch. Capture-page settings fix the time of day, use the existing cinematic camera, disable automatic render-resolution reduction, and suppress transient control tips. Map attribution stays visible. No paid generation or live signal-refresh requests were made.

## Shot list

| Clip | Length | Treatment | Description |
| --- | ---: | --- | --- |
| [01-original-night-title-to-city.mp4](video/01-original-night-title-to-city.mp4) | 13.0s | Original game | Original running game: night title into the full city explorer. |
| [02-original-startup-profile.mp4](video/02-original-startup-profile.mp4) | 8.9s | Original game | Original game interface: focus a startup, open its profile, show connections. |
| [03-enhanced-night-title-to-city.mp4](video/03-enhanced-night-title-to-city.mp4) | 12.8s | Enhanced | Video-only architectural finish: night title-to-city transition. |
| [04-enhanced-night-flyover.mp4](video/04-enhanced-night-flyover.mp4) | 9.4s | Enhanced | Night skyline flyover with cleaner facades and northern lights. |
| [05-enhanced-night-building-orbit.mp4](video/05-enhanced-night-building-orbit.mp4) | 8.5s | Enhanced | Close night orbit: sharp window frames, roof seams and restrained warm interiors. |
| [06-enhanced-day-city-flyover.mp4](video/06-enhanced-day-city-flyover.mp4) | 8.5s | Enhanced | Summer-afternoon flyover of the new map with architectural facades. |
| [07-enhanced-day-building-orbit.mp4](video/07-enhanced-day-building-orbit.mp4) | 8.5s | Enhanced | Architectural close orbit: plaster facades, window detailing and metal roof seams. |

## Browse

- `screenshots/`: 12 full-resolution PNGs, including matched original/enhanced building comparisons.
- [Screenshot contact sheet](contact-sheet.jpg)
- [Building comparison](building-comparison.jpg)
- [Video contact sheet](video-contact-sheet.jpg)
- `manifest.json`: shot descriptions, source recordings and trim positions.
- `verification.json`: dimensions and full video decode checks.

## Recapture

`node scripts/capture-startup-city-launch.mjs` captures the pack. Add `--resume` to keep completed sessions. Set `STARTUP_CITY_URL` to use a different server. Requires Chrome, Playwright and FFmpeg. `python3 scripts/verify-startup-city-launch.py` verifies clips and creates the contact sheets (requires Pillow).
