# WEBWORLD launch assets

Actual captures from the main game, recorded locally on 14 November 2026. Autumn wood and Northern lights are included.

- `screenshots/`: 11 full-resolution PNG stills, 1920 × 1080.
- `video/`: 7 separate H.264 MP4 clips, 1920 × 1080, 30 fps export, yuv420p, no audio. Ready to import into a launch-video editor.
- `source/`: original WebM recordings, including setup footage and earlier takes; use the MP4s for the selected shots.
- `contact-sheet.jpg`: visual index of all screenshots.
- `manifest.json`: descriptions, capture states, raw-source filenames and trim times.
- `verification.json`: dimensions and full video decode checks.

## Video shot list

| Clip | Length | Content |
| --- | ---: | --- |
| [01-title-to-game.mp4](video/01-title-to-game.mp4) | 11.6s | Northern lights: actual continuous night title-to-game camera transition. |
| [02-autumn-scooter.mp4](video/02-autumn-scooter.mp4) | 7.1s | Clean scooter ride north through the open exhibition square. |
| [03-company-discovery.mp4](video/03-company-discovery.mp4) | 8.6s | Search for Varjo and open its sourced company profile in the square. |
| [04-helsinki-city-view.mp4](video/04-helsinki-city-view.mp4) | 8.6s | Rise to the Helsinki atlas with the complete company collection. |
| [05-autumn-flight.mp4](video/05-autumn-flight.mp4) | 8.8s | Launch from the scooter and fly above the autumn city. |
| [06-northern-lights-scooter.mp4](video/06-northern-lights-scooter.mp4) | 7.5s | Clean scooter ride north through the open exhibition square. |
| [07-autumn-park-atmosphere.mp4](video/07-autumn-park-atmosphere.mp4) | 10.0s | Autumn park atmosphere, foliage and falling leaves; fixed scenic camera. |

## Screenshot index

- [01-autumn-title.png](screenshots/01-autumn-title.png) — Framed autumn city and WEB WORLD title.
- [02-autumn-gameplay.png](screenshots/02-autumn-gameplay.png) — Scooter in the square with the normal game HUD.
- [03-autumn-scooter-clean.png](screenshots/03-autumn-scooter-clean.png) — Theater-mode scooter ride through the open Helsinki square.
- [04-company-search.png](screenshots/04-company-search.png) — Company search over the open Helsinki square.
- [05-company-profile.png](screenshots/05-company-profile.png) — Varjo profile over the open Helsinki square.
- [06-helsinki-city-view.png](screenshots/06-helsinki-city-view.png) — Full Helsinki company atlas with all search filters cleared.
- [07-autumn-flight.png](screenshots/07-autumn-flight.png) — Player flying above painted Helsinki.
- [08-northern-lights-title.png](screenshots/08-northern-lights-title.png) — Northern lights title painting.
- [09-northern-lights-scooter.png](screenshots/09-northern-lights-scooter.png) — Theater-mode scooter ride through the open Helsinki square.
- [10-northern-lights-exhibits.png](screenshots/10-northern-lights-exhibits.png) — Northern lights above the company exhibition square.
- [11-autumn-park.png](screenshots/11-autumn-park.png) — Clean view into Kaisaniemi Park using the existing free-camera preview.

## Capture notes

The clean riding and flight shots use the existing theater mode. Temporary toast messages are suppressed by capture-only browser CSS in the final riding takes; the game source is unchanged. Map attribution stays visible. The park uses the existing free-camera URL preview. Company profiles use bundled demo/source snapshots; these assets do not claim live source checks.

The exported frame rate is 30 fps; original browser capture cadence may vary. Audio is omitted for adding your launch soundtrack or narration.

To recapture, run `npm run dev` and then `node scripts/capture-launch-assets.mjs`, followed by `node scripts/capture-launch-assets.mjs --retake-rides` and `node scripts/capture-launch-assets.mjs --retake-discovery`. Requires installed Chrome, Playwright and FFmpeg. Run `node scripts/capture-launch-assets.mjs --night-title` to use the northern-lights title-to-game transition, as in the current pack. These commands overwrite the matching launch assets.
