import subprocess,urllib.request,concurrent.futures,xml.etree.ElementTree as ET,json,datetime
boxes=[(w,s,e,n) for w,e in [(24.929,24.9475),(24.9475,24.966)] for s,n in [(60.1605,60.16975),(60.16975,60.179)]]
def fetch(b):
 url='https://api.openstreetmap.org/api/0.6/map?bbox='+','.join(map(str,b))
 req=urllib.request.Request(url,headers={'User-Agent':'WEBWORLD-map-prototype/1.0'})
 data=subprocess.check_output(['curl','-f','-L','--max-time','50','-sS',url])
 print('downloaded',b,len(data),flush=True)
 return ET.fromstring(data)
items={}
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
 for root in pool.map(fetch,boxes):
  for e in root:
   if e.tag in ('node','way','relation'):items[(e.tag,e.attrib['id'])]=e
nodes={int(e.attrib['id']):{'lat':float(e.attrib['lat']),'lon':float(e.attrib['lon'])} for (t,i),e in items.items() if t=='node'}
ways={int(e.attrib['id']):e for (t,i),e in items.items() if t=='way'}
def tags(e):return {t.attrib['k']:t.attrib['v'] for t in e.findall('tag')}
def geom(e):return [nodes.get(int(n.attrib['ref'])) for n in e.findall('nd')]
elements=[]
for (t,i),e in items.items():
 ts=tags(e)
 if t=='way': elements.append({'type':t,'id':int(i),'tags':ts,'nodes':[int(n.attrib['ref']) for n in e.findall('nd')],'geometry':geom(e)})
 elif t=='relation':
  mem=[]
  for m in e.findall('member'):
   d=dict(m.attrib);d['ref']=int(d['ref'])
   if d['type']=='way' and d['ref'] in ways:d['geometry']=geom(ways[d['ref']])
   mem.append(d)
  elements.append({'type':t,'id':int(i),'tags':ts,'members':mem})
 elif ts:elements.append({'type':t,'id':int(i),'tags':ts,**nodes[int(i)]})
result={'source':'https://api.openstreetmap.org/api/0.6/map','retrievedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'bbox':[24.929,60.1605,24.966,60.179],'elements':elements}
json.dump(result,open('public/data/helsinki/source.osm.json','w'),separators=(',',':'))
print('saved',len(elements),'elements',flush=True)
