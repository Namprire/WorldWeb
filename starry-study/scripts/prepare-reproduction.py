"""Prepare the user-authorized local copy of the observed public deployment.

Reuses captured bytes. Downloads only explicitly identified images/voice references,
sequentially with a short pause. Does not probe directories or contact game APIs.
"""
import csv,hashlib,json,shutil,subprocess,time
from pathlib import Path
BASE=Path(__file__).resolve().parents[1]
E=BASE/'evidence'; ROOT=BASE/'reproduction'; PUBLIC=ROOT/'public'
PUBLIC.mkdir(parents=True,exist_ok=True)
manifest=[]
for row in json.loads((E/'network.json').read_text())['network']:
 if 'local' not in row or '/_vercel/' in row['url'] or row['type']=='document':continue
 path=row['url'].removeprefix('https://starrynightrider.com/')
 dst=PUBLIC/path;dst.parent.mkdir(parents=True,exist_ok=True)
 shutil.copyfile(E/row['local'],dst)
 manifest.append({'url':row['url'],'path':path,'bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'provenance':'captured public bytes; user confirmed reuse permission'})
rows=list(csv.DictReader((BASE/'asset-inventory.csv').open()))
urls=sorted({r['url'] for r in rows if r['url'].startswith('https://starrynightrider.com/hails/') and r['url'].endswith('.mp3')})
urls+=['https://starrynightrider.com/'+p for p in ['painting-s.webp','sky-s.webp','og-painting.jpg']]
failures=[]
for url in urls:
 path=url.removeprefix('https://starrynightrider.com/');dst=PUBLIC/path;dst.parent.mkdir(parents=True,exist_ok=True)
 if not dst.exists():
  result=subprocess.run(['curl','-fsSL','--max-time','30',url,'-o',str(dst)],capture_output=True)
  if result.returncode:
   failures.append({'url':url,'error':result.stderr.decode()[-300:]})
   if dst.exists():dst.unlink()
   continue
  time.sleep(.18)
 manifest.append({'url':url,'path':path,'bytes':dst.stat().st_size,'sha256':hashlib.sha256(dst.read_bytes()).hexdigest(),'provenance':'explicit public asset reference; user confirmed reuse permission'})
html=(E/'raw/index.html').read_text()
html=html.replace('<title>Starry Nightrider</title>','<title>Starry Nightrider · Local reproduction</title>')
html=html.replace('<script type="module" crossorigin src="/assets/index-BY2CcXjY.js"></script>','<script type="module" src="/src/main.ts"></script>')
html=html.replace('<meta charset="utf-8" />','<meta charset="utf-8" />\n    <meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\' \'unsafe-inline\'; style-src \'self\' \'unsafe-inline\'; img-src \'self\' data: blob:; media-src \'self\' blob:; connect-src \'self\'; worker-src \'self\' blob:; object-src \'none\'; base-uri \'self\'; form-action \'self\'">')
html=html.replace('<h2 id="board-title">','<p style="font-size:12px;opacity:.7">Local scores on this device only · no online multiplayer</p><h2 id="board-title">')
(ROOT/'index.html').write_text(html)
(ROOT/'asset-manifest.json').write_text(json.dumps({'source':'public deployment captured 2026-11-14','authorization':'User explicitly confirmed permission to reuse original code and modified graphics in this conversation. Not independently legally verified.','assets':manifest,'failures':failures},indent=2))
print(json.dumps({'assets':len(manifest),'bytes':sum(r['bytes'] for r in manifest),'failures':failures},indent=2))
if failures:raise SystemExit(1)
