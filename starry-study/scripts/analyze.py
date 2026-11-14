"""Offline evidence inventory and descriptive measurements. Requires Pillow."""
import csv, hashlib, json, math, re, statistics
from pathlib import Path
from collections import Counter
from PIL import Image
BASE=Path(__file__).resolve().parents[1]
E=BASE/'evidence'
load=lambda name:json.loads((E/name).read_text())
network=load('network.json'); runtime=load('runtime.json'); proto=load('prototype-runtime.json')
purposes={
 'index.html':'Document, DOM HUD and entry controls',
 'index-BY2CcXjY.js':'Three.js renderer internals and game orchestration, physics, camera, shaders, audio, network client',
 'kit-DsD4Rc8o.js':'Three.js core classes and procedural world/configuration helpers',
 'hails-DeolUH4Z.js':'NPC voice/line table and deterministic speaker selection',
 'index-DHKFK6Tp.css':'Gallery, HUD, minimap, leaderboard and responsive styles',
 'painting.webp':'Full painting used by gallery compositing and projection materials',
 'painting-s.webp':'Small-device painting variant; referenced in loader',
 'sky.webp':'Sky painting sampled by animated sky shader',
 'sky-s.webp':'Small-device sky variant; referenced in loader',
 'flow.png':'Sky stroke direction encoded as double angle plus coherence; shader comments confirm',
 'fill.png':'Sky color fill behind removed cypress; shader comments confirm',
 'cypress.png':'Cypress silhouette mask used for fragment discard',
 'og-painting.jpg':'Social share preview; HTML metadata',
 'script.js':'Vercel analytics script; not a game dependency',
}
rows=[]
for r in network['network']:
 url=r['url']; name=url.split('/')[-1];p=E/r.get('local','missing');size=r.get('decodedBytes',r.get('contentLength',''))
 purpose=purposes.get(name,'Ambient NPC voice clip' if '/hails/' in url else 'Leaderboard avatar' if 'twimg.com' in url or 'unavatar.io' in url else 'Leaderboard GET response')
 row=dict(url=url,type=r.get('mime',r['type']),bytes=size or '',byte_basis='decoded body' if 'decodedBytes' in r else 'response Content-Length (206 may be partial)' if size else 'not retained',status=r['status'],purpose=purpose,evidence='network.json',confidence='high',sha256=r.get('sha256',''),width='',height='')
 if p.is_file() and r.get('mime','').startswith('image/'):
  with Image.open(p) as im:row.update(width=im.width,height=im.height)
 rows.append(row)
for m in load('referenced-metadata.json'):
 found=next((r for r in rows if r['url']==m['url']),None)
 if found:found.update(bytes=m['contentLength'] or '',byte_basis='HEAD Content-Length; full object',evidence='network.json; referenced-metadata.json')
 else:rows.append(dict(url=m['url'],type=m['mime'],bytes=m['contentLength'] or '',byte_basis='HEAD Content-Length',status=m['status_line'],purpose=purposes[m['url'].split('/')[-1]],evidence='bundle loader or HTML; referenced-metadata.json',confidence='high'))
# Enumerate only names and indices present in the exposed voice table; no requests.
hails=(E/'hails-DeolUH4Z.js').read_text(); clipcount=0
for speaker,body in re.findall(r'^    (\w+): \[(.*?)\n    \]',hails,re.M|re.S):
 for n in range(len(re.findall(r'`[^`]*`',body))):
  clipcount+=1;url=f'https://starrynightrider.com/hails/{speaker}.{n}.mp3'
  if any(r['url']==url for r in rows):continue
  rows.append(dict(url=url,type='audio/mpeg (inferred)',bytes='',byte_basis='not requested',status='referenced; existence unverified',purpose='Ambient NPC voice clip inferred from exposed speaker/index URL construction',evidence='hails module + index module pl()',confidence='medium'))
for url,purpose in [('https://starrynightrider.com/api/presence','Presence count and haul reports; POST blocked'),('https://starrynightrider.com/api/talk','Conversation endpoint in client; current R binding disabled'),('wss://starry-nightrider-riders.starry-nightrider-riders.workers.dev/ws','Rider synchronization; attempted connection blocked')]:
 rows.append(dict(url=url,type='JSON API / WebSocket',bytes='',byte_basis='not measured',status='client reference; no service validation',purpose=purpose,evidence='index module Mc/Xc/pl; network.json',confidence='high for client reference'))
for m in load('source-map-checks.json'):
 rows.append(dict(url=m['url'],type='source-map candidate',bytes=m['bytes'],byte_basis='error response body; not a source map',status=m['result'],purpose='Conventional adjacent map check',evidence='source-map-checks.json',confidence='high'))
favicon=re.search(r'<link rel="icon" href="([^"]+)"',(E/'raw/index.html').read_text())
if favicon:
 from urllib.parse import unquote
 rows.append(dict(url=favicon.group(1),type='image/svg+xml',bytes=len(unquote(favicon.group(1).split(',',1)[1]).encode()),byte_basis='decoded inline SVG UTF-8',status='inline document asset',purpose='Browser favicon',evidence='raw/index.html',confidence='high'))
rows.append(dict(url='https://va.vercel-scripts.com/v1/script.debug.js',type='application/javascript (inferred)',bytes='',byte_basis='not requested',status='static optional debug reference',purpose='Analytics debug-mode script; not observed loading',evidence='main module analytics loader',confidence='medium'))
for n,s in enumerate(runtime['capture']['shaders']):
 src=s['source'];kind='vertex' if s['type']==35633 else 'fragment';purpose='Compiled '+kind+' shader'
 for needle,label in [('tFlow','sky flow'),('tAO','AO/compositing'),('uThreshold','bloom prefilter'),('tCypress','cypress mask'),('uDynLamp','dynamic painted material'),('aWalkA','procedural NPC posing')]:
  if needle in src:purpose+='; '+label
 rows.append(dict(url=f'inline:runtime.json#capture.shaders/{n}',type='GLSL '+kind,bytes=len(src.encode()),byte_basis='captured UTF-8 shader source',status='shaderSource observed; not a network file',purpose=purpose,evidence='WebGL2 shaderSource hook',confidence='high',sha256=hashlib.sha256(src.encode()).hexdigest()))
fields=['url','type','bytes','byte_basis','status','purpose','evidence','confidence','sha256','width','height']
with (BASE/'asset-inventory.csv').open('w',newline='') as f:
 w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)

obs=load('observations.json');a=next(o['t'] for o in obs if o['label']=='ride');b=next(o['t'] for o in obs if o['label']=='pedal')
def summary(r,a,b):
 values=[x['dt'] for x in r['capture']['frames'] if a<x['t']<=b];sort=sorted(values)
 nav=r['navigation'][0];res=r['resources']
 return {'sample_start_ms':a,'sample_end_ms':b,'frames':len(values),'raf_fps':1000/statistics.mean(values),'median_frame_ms':statistics.median(values),'p95_frame_ms':sort[math.ceil(.95*len(sort))-1],'max_frame_ms':max(values),'navigation_response_end_ms':nav['responseEnd'],'dom_content_loaded_ms':nav['domContentLoadedEventEnd'],'load_event_end_ms':nav['loadEventEnd'],'heap_used_bytes':r['heap']['used'],'shader_source_calls':len(r['capture']['shaders']),'texImage2D_calls':len(r['capture']['textures']),'resource_transfer_bytes_reported':sum(x['transferSize'] for x in res),'resource_decoded_bytes_reported':sum(x['decodedBodySize'] for x in res),'context':r['capture']['contexts'],'user_agent':r['userAgent']}
measurements={'original':summary(runtime,a,b),'prototype':summary(proto,proto['measurementStart'],proto['measurementEnd']),'method':'One desktop headless Chrome run each, 1280x800 DPR1, same WebGL hooks. rAF cadence is a presentation opportunity proxy, not GPU completion time. Original window includes ride screenshot overhead; prototype window is 3s keyboard-only. Not an optimization benchmark. Resource Timing transfer zeros may mean cross-origin restriction/cache. Heap includes instrumentation, excludes native/GPU memory.'}
def histogram(path):
 im=Image.open(path).convert('RGB');hist=Counter((r//32,g//32,b//32) for r,g,b in im.getdata());n=im.width*im.height
 return {k:v/n for k,v in hist.items()}
h1=histogram(E/'original-ride.png');h2=histogram(E/'prototype-ride.png')
measurements['visual']={'rgb_histogram_overlap':sum(min(v,h2.get(k,0)) for k,v in h1.items()),'method':'Sum of minima of normalized 8x8x8 RGB histograms over full 1280x800 screenshots. Includes HUD. This measures palette distribution only; NOT a percentage reconstruction or perceptual similarity. Different worlds and cameras make pixel alignment metrics inappropriate.','original':'original-ride.png','prototype':'prototype-ride.png'}
measurements['inventory']={'rows':len(rows),'network_responses':len(network['network']),'voice_clip_references':clipcount,'retained_static_decoded_bytes':sum(r.get('decodedBytes',0) for r in network['network'])}
(E/'measurements.json').write_text(json.dumps(measurements,indent=2))
print(json.dumps(measurements,indent=2))
