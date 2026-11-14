"""Nine bounded checks of references in the captured deployment. No discovery scan."""
import json,re,subprocess
from pathlib import Path
E=Path(__file__).resolve().parents[1]/'evidence'
html=(E/'raw/index.html').read_text()
paths=list(dict.fromkeys(re.findall(r'(?:src|href)="(/assets/[^" ]+\.js)"',html)))
if len(paths)>3:raise SystemExit('Build changed: review script references before extending checks.')
maps=[]
for path in paths:
 raw=(E/'raw'/path.split('/')[-1]).read_text()
 url='https://starrynightrider.com'+path+'.map'
 r=subprocess.run(['curl','-sSL','--max-time','20','-w','\n%{http_code} %{content_type}',url],capture_output=True,check=True)
 body,meta=r.stdout.rsplit(b'\n',1)
 try:obj=json.loads(body);valid=obj.get('version')==3 and 'sources' in obj
 except (ValueError,AttributeError):valid=False
 maps.append(dict(url=url,result=meta.decode(),bytes=len(body),validSourceMap=valid,directivePresent='sourceMappingURL' in raw))
(E/'source-map-checks.json').write_text(json.dumps(maps,indent=2))
paths=['/painting-s.webp','/sky-s.webp','/og-painting.jpg','/hails/matilda.3.mp3','/hails/george.2.mp3','/hails/laura.11.mp3']
known=(E/'index-BY2CcXjY.js').read_text()+html+(E/'network.json').read_text()
out=[]
for path in paths:
 if path not in known and path[1:] not in known:raise SystemExit('Reference absent from evidence: '+path)
 url='https://starrynightrider.com'+path
 r=subprocess.run(['curl','-sSI','--max-time','20',url],capture_output=True,text=True,check=True)
 headers={}
 for line in r.stdout.splitlines():
  if ':' in line:k,v=line.split(':',1);headers[k.lower()]=v.strip()
 out.append(dict(url=url,status_line=r.stdout.splitlines()[0],mime=headers.get('content-type'),contentLength=headers.get('content-length'),method='HEAD',verified_tls=True))
(E/'referenced-metadata.json').write_text(json.dumps(out,indent=2))
print(f'Checked {len(maps)} map candidates and {len(out)} referenced resource headers.')
