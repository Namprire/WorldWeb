from pathlib import Path
from PIL import Image, ImageDraw
import json
import subprocess

root = Path('assets/launch-startup-city')
manifest = json.loads((root / 'manifest.json').read_text())
manifest['screenshots'] = list({s['file']: s for s in manifest['screenshots']}.values())
verification = []
source_checks = []
for path in sorted((root / 'source').glob('page@*.webm')):
    if path.stat().st_size == 0:
        path.unlink()  # Empty temporary file from the interrupted connection.
    else:
        (root / 'source' / 'incomplete').mkdir(exist_ok=True)
        path.rename(root / 'source' / 'incomplete' / path.name)
for path in sorted((root / 'source').rglob('*.webm')):
    stream = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', str(path)]))['streams'][0]
    assert stream['width'] >= 1920 and stream['height'] >= 1080
    source_checks.append({'file': str(path.relative_to(root)), **stream})
for clip in manifest['clips']:
    path = root / clip['file']
    info = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_streams', '-show_format', '-of', 'json', str(path)]))
    stream = info['streams'][0]
    assert stream['width'] >= 1920 and stream['height'] >= 1080
    clip['exportedDurationSeconds'] = round(float(info['format']['duration']), 3)
    result = subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-i', str(path), '-f', 'null', '-'], capture_output=True, text=True)
    assert result.returncode == 0 and not result.stderr, result.stderr
    verification.append({'file': clip['file'], 'width': stream['width'], 'height': stream['height'], 'codec': stream['codec_name'], 'fullDecode': 'passed'})
files = sorted((root / 'screenshots').glob('*.png'))
for path in files:
    with Image.open(path) as im:
        assert im.size == (1920, 1080), path

sheet = Image.new('RGB', (1440, 64 + ((len(files) + 2) // 3) * 300), '#101b22')
draw = ImageDraw.Draw(sheet)
draw.text((20, 20), 'STARTUP CITY / LAUNCH CAPTURES / ALL STILLS 1920 x 1080', fill='#94e6c6')
for i, path in enumerate(files):
    with Image.open(path) as im:
        im = im.convert('RGB'); im.thumbnail((480, 270))
        x, y = (i % 3) * 480, 64 + (i // 3) * 300
        sheet.paste(im, (x, y)); draw.text((x + 8, y + 279), path.stem, fill='white')
sheet.save(root / 'contact-sheet.jpg', quality=94)

comparison = Image.new('RGB', (1920, 1160), '#101b22')
draw = ImageDraw.Draw(comparison)
for i, (file, title) in enumerate([('01-original-buildings-day.png', 'ORIGINAL GAME'), ('02-enhanced-buildings-day.png', 'VIDEO-ONLY BUILDING FINISH')]):
    im = Image.open(root / 'screenshots' / file).convert('RGB')
    comparison.paste(im.resize((960, 540)), (i * 960, 40))
    detail = im.crop((0, 420, 900, 960)).resize((960, 540))
    comparison.paste(detail, (i * 960, 620))
    draw.text((i * 960 + 20, 14), title, fill='white')
    draw.text((i * 960 + 20, 594), 'Facade / roof detail', fill='#94e6c6')
comparison.save(root / 'building-comparison.jpg', quality=95)

review = Image.new('RGB', (1440, len(manifest['clips']) * 300), '#101b22')
draw = ImageDraw.Draw(review)
for i, clip in enumerate(manifest['clips']):
    duration = clip['exportedDurationSeconds']
    for j, time in enumerate([.5, duration / 2, duration - .5]):
        target = Path(f'/tmp/startup-city-review-{i}-{j}.jpg')
        subprocess.run(['ffmpeg', '-hide_banner', '-v', 'error', '-y', '-ss', str(time), '-i', str(root / clip['file']), '-frames:v', '1', str(target)], check=True)
        with Image.open(target) as im:
            im.thumbnail((480, 270)); review.paste(im, (j * 480, i * 300))
        draw.text((j * 480 + 8, i * 300 + 279), f'{Path(clip["file"]).stem} / {time:.1f}s', fill='white')
review.save(root / 'video-contact-sheet.jpg', quality=91)
(root / 'manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
(root / 'verification.json').write_text(json.dumps({'screenshots': len(files), 'clips': verification, 'sources': source_checks, 'runtimeErrors': manifest['errors']}, indent=2) + '\n')

lines = ['# Startup City launch footage', '', f'Captured from {manifest["source"]}. All clips and screenshots are 1920 × 1080. MP4 exports use H.264, 30 fps, CRF 17 and no audio. Original browser recordings are retained under `source/`; browser frame cadence may vary.', '',
         '## Building treatment', '',
         'Clips named `original` show the running game without building-material changes. Clips named `enhanced` use a video-only architectural finish applied inside isolated capture browser pages. It sharpens window surrounds, smooths plaster, adds subtle sill shading and roof seams, and reduces glowing windows. It preserves the existing footprint geometry, approximate building shapes, trees and streets. This is a more restrained architectural treatment, not a photorealistic reconstruction.', '',
         'No files or settings were written to the remote game branch. Capture-page settings fix the time of day, use the existing cinematic camera, disable automatic render-resolution reduction, and suppress transient control tips. Map attribution stays visible. No paid generation or live signal-refresh requests were made.', '',
         '## Shot list', '', '| Clip | Length | Treatment | Description |', '| --- | ---: | --- | --- |']
for clip in manifest['clips']:
    lines.append(f'| [{Path(clip["file"]).name}]({clip["file"]}) | {clip["exportedDurationSeconds"]:.1f}s | {"Enhanced" if clip["enhanced"] else "Original game"} | {clip["description"]} |')
lines += ['', '## Browse', '',
          f'- `screenshots/`: {len(files)} full-resolution PNGs, including matched original/enhanced building comparisons.',
          '- [Screenshot contact sheet](contact-sheet.jpg)', '- [Building comparison](building-comparison.jpg)', '- [Video contact sheet](video-contact-sheet.jpg)',
          '- `manifest.json`: shot descriptions, source recordings and trim positions.', '- `verification.json`: dimensions and full video decode checks.', '',
          '## Recapture', '', '`node scripts/capture-startup-city-launch.mjs` captures the pack. Add `--resume` to keep completed sessions. Set `STARTUP_CITY_URL` to use a different server. Requires Chrome, Playwright and FFmpeg. `python3 scripts/verify-startup-city-launch.py` verifies clips and creates the contact sheets (requires Pillow).', '']
(root / 'README.md').write_text('\n'.join(lines))
print(json.dumps({'clips': len(manifest['clips']), 'screenshots': len(files), 'seconds': round(sum(c['exportedDurationSeconds'] for c in manifest['clips']), 1), 'errors': manifest['errors'], 'failure': manifest.get('failure')}))
