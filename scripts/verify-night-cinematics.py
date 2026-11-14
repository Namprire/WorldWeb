from pathlib import Path
from PIL import Image, ImageDraw
import json, subprocess, sys

no_ui='--no-ui' in sys.argv
root=Path('assets/launch-startup-city/night-cinematics'+('-clean' if no_ui else ''))
manifest=json.loads((root/'manifest.json').read_text())
files=sorted((root/'video').glob('*.mp4'))+[root/'night-launch-reel.mp4']
checks=[]
for path in files:
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_streams','-show_format','-of','json',str(path)]))
    stream=info['streams'][0]
    assert stream['width']>=1920 and stream['height']>=1080,path
    result=subprocess.run(['ffmpeg','-hide_banner','-v','error','-i',str(path),'-f','null','-'],capture_output=True,text=True)
    assert result.returncode==0 and not result.stderr,(path,result.stderr)
    checks.append({'file':str(path.relative_to(root)),'width':stream['width'],'height':stream['height'],'fps':stream['r_frame_rate'],'seconds':round(float(info['format']['duration']),3),'fullDecode':'passed'})
photos=sorted((root/'screenshots').glob('*.png'))
sheet=Image.new('RGB',(1440,680),'#07121c');d=ImageDraw.Draw(sheet)
d.text((20,20),'STARTUP CITY / PHOTOGRAPHIC NIGHT CINEMATICS / 1920 x 1080',fill='#a7ead5')
for i,path in enumerate(photos):
    with Image.open(path) as im:
        assert im.size==(1920,1080),path
        im=im.convert('RGB');im.thumbnail((480,270));x=(i%3)*480;y=60+(i//3)*300;sheet.paste(im,(x,y));d.text((x+8,y+278),path.stem,fill='white')
sheet.save(root/'contact-sheet.jpg',quality=95)

review=Image.new('RGB',(1440,len(files)*300),'#07121c');d=ImageDraw.Draw(review)
for i,entry in enumerate(checks):
    for j,t in enumerate([.5,entry['seconds']/2,entry['seconds']-.5]):
        target=Path(f'/tmp/night-cinematic-{i}-{j}.jpg')
        subprocess.run(['ffmpeg','-hide_banner','-v','error','-y','-ss',str(t),'-i',str(root/entry['file']),'-frames:v','1',str(target)],check=True)
        with Image.open(target) as im:
            im.thumbnail((480,270));review.paste(im,(480*j,300*i));d.text((480*j+8,300*i+278),f'{Path(entry["file"]).stem} / {t:.1f}s',fill='white')
review.save(root/'video-contact-sheet.jpg',quality=92)
(root/'verification.json').write_text(json.dumps({'videos':checks,'pngCount':len(photos),'runtimeErrors':manifest['errors']},indent=2)+'\n')
rows=['# Photographic night cinematics','',
'The latest night-focused promotional set, captured from the Startup City version at '+manifest['source']+'.', '',
'- [Watch the night launch reel](night-launch-reel.mp4): five animated camera shots with crossfades, silent for your launch soundtrack.',
'- `video/`: five separate 1920 × 1080 H.264 MP4s at 30 fps export.',
'- `screenshots/`: six full-resolution 1920 × 1080 night PNGs.',
'- [Screenshot preview](contact-sheet.jpg) · [Video shot preview](video-contact-sheet.jpg)',
'- `source/`: original browser recording. Actual browser frame cadence can vary.', '',
'## Shot list','', '| File | Length | Shot |','| --- | ---: | --- |']
if no_ui:
    rows[0]='# Clean night cinematics — no game UI'
    rows.insert(4,'Title, painting frame, buttons, HUD, search, labels and panels are hidden in every exported shot. Only map attribution remains. The first shot is a full-screen city reveal.\n')
for clip,check in zip(manifest['clips'],checks):
    rows.append(f'| [{Path(clip["file"]).name}]({clip["file"]}) | {check["seconds"]:.1f}s | {clip["description"]} |')
rows+=['','## Video-only visuals','',
'This set uses an AI-generated photographic Finnish facade texture, warm window interiors, projecting stone sills and lintels, cornice courses, rain pipes and roof details. Camera moves and animated northern lights run inside the game renderer. These are promotional renderings; they do not represent the current gameplay graphics. The underlying map and approximate building geometry remain stylized.', '',
'All material and geometry changes exist only in isolated capture browser pages. The remote branch was not edited. The scene uses fixed night lighting and a restrained cool fill to show architectural details. Map attribution remains visible.', '',
'Texture: [helsinki-photographic-facade.png](../materials/helsinki-photographic-facade.png), generated for this project. Building details are artistic additions, not verified facade reconstructions.', '',
f'To recapture: `node scripts/capture-night-cinematics.mjs{" --no-ui" if no_ui else ""}`. To verify and regenerate previews: `python3 scripts/verify-night-cinematics.py{" --no-ui" if no_ui else ""}`.', '']
(root/'README.md').write_text('\n'.join(rows))
parent=root.parent/'README.md'
if parent.exists():
    text=parent.read_text();notice=('**Latest UI-free night set:** [Clean night cinematics and launch reel](night-cinematics-clean/README.md).\n\n' if no_ui else '**Latest preferred night set:** [Photographic night cinematics and launch reel](night-cinematics/README.md).\n\n')
    if notice not in text:
        head,rest=text.split('\n',1);parent.write_text(head+'\n\n'+notice+rest.lstrip())
print(json.dumps({'clips':len(checks)-1,'reelSeconds':checks[-1]['seconds'],'screenshots':len(photos),'errors':manifest['errors']}))
