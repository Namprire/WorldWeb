"""Run: uv run --with shapely==2.1.2 python scripts/build-helsinki-map.py
OSM-derived database is ODbL. Heights and road widths explicitly identify estimates.
"""
import json,math
from shapely.geometry import Polygon,LineString,Point,box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union,polygonize,linemerge
from shapely import make_valid
D=json.load(open('public/data/helsinki/source.osm.json')); E=D['elements']
origin=[24.9437,60.1712]; R=6371008.8; k=math.pi/180*R; c=math.cos(origin[1]*math.pi/180)
def xy(p):return ((p['lon']-origin[0])*k*c,(origin[1]-p['lat'])*k)
w,s,e,n=D['bbox'];a=xy({'lon':w,'lat':n});b=xy({'lon':e,'lat':s});clip=box(a[0],a[1],b[0],b[1]); bounds={'west':a[0],'north':a[1],'east':b[0],'south':b[1]}
def coords(g):return [xy(p) for p in g if p]
def polys(g):
 if g.is_empty:return []
 if g.geom_type=='Polygon':return [g]
 return [p for gg in getattr(g,'geoms',[]) for p in polys(gg)]
def lines(g):
 if g.is_empty:return []
 if g.geom_type=='LineString':return [g]
 return [p for gg in getattr(g,'geoms',[]) for p in lines(gg)]
def rings(p):
 p=orient(p,sign=1)
 return [[[round(x,2),round(z,2)] for x,z in r.coords][:-1] for r in [p.exterior,*p.interiors]]
def shape(e):
 if e['type']=='way':
  cs=coords(e.get('geometry',[]));return make_valid(Polygon(cs)) if len(cs)>=4 and cs[0]==cs[-1] else Polygon()
 out=[];inn=[]
 for m in e.get('members',[]):
  cs=coords(m.get('geometry',[]))
  if len(cs)>1:(inn if m.get('role')=='inner' else out).append(LineString(cs))
 outer=unary_union(list(polygonize(unary_union(out)))) if out else Polygon()
 inner=unary_union(list(polygonize(unary_union(inn)))) if inn else Polygon()
 return make_valid(outer.difference(inner))
def num(v):
 try:return float(str(v).replace(' m','').split(';')[0])
 except:return None
consumed=set()
for e in E:
 if e['type']=='relation' and e['tags'].get('building'):
  consumed.update(m['ref'] for m in e.get('members',[]) if m.get('type')=='way')
buildings=[]; parks=[];water=[];coasts=[]; roads=[];trees=[]; missing=0
roadtypes={'primary','secondary','tertiary','residential','unclassified','service','pedestrian','footway','cycleway','path','living_street','steps','primary_link','secondary_link','tertiary_link'}
for el in E:
 t=el['tags'];kind=el['type'];oid=f"{kind}/{el['id']}"
 if kind=='node':
  if t.get('natural')=='tree' and clip.contains(Point(xy(el))):trees.append([round(v,2) for v in xy(el)])
  continue
 if t.get('building') and t['building'] not in ['roof','shed','garage','garages'] and not(kind=='way' and el['id'] in consumed):
  g=shape(el).intersection(clip)
  if g.is_empty:missing+=1;continue
  raw=num(t.get('height'));levels=num(t.get('building:levels'));height=raw if raw and raw>2 else levels*3.2 if levels else 16
  for p in polys(g):
   if p.area<12:continue
   buildings.append({'id':oid,'name':t.get('name:en',t.get('name','')),'rings':rings(p),'h':round(min(100,height),2),'heightSource':'height' if raw else 'levels-estimate' if levels else 'fallback-estimate','bounds':[round(v,2) for v in p.bounds], 'type':t['building']})
 if t.get('leisure') in ['park','garden'] or t.get('landuse') in ['grass','recreation_ground']:
  for p in polys(shape(el).intersection(clip)):
   if p.area>12:parks.append({'id':oid,'name':t.get('name:en',t.get('name','')),'rings':rings(p)})
 if t.get('natural')=='water':
  for p in polys(shape(el).intersection(clip)):water.append({'id':oid,'rings':rings(p)})
 if kind=='way':
  cs=coords(el.get('geometry',[]))
  if len(cs)<2:continue
  line=LineString(cs)
  if t.get('natural')=='coastline':coasts.extend(lines(line.intersection(clip)))
  hw=t.get('highway');tram=t.get('railway')=='tram'
  if (hw in roadtypes or tram) and t.get('indoor')!='yes' and t.get('tunnel')!='yes' and (num(t.get('layer')) or 0)>=0 and t.get('access') not in ['private','no']:
   width=num(t.get('width')) or (1.6 if tram else 3 if hw in ['footway','path','steps'] else 4 if hw=='cycleway' else 7 if hw in ['service','pedestrian','living_street'] else 10)
   for part in lines(line.intersection(clip)):
    roads.append({'id':oid,'name':t.get('name',''),'kind':'tram' if tram else hw,'width':width,'widthSource':'width' if num(t.get('width')) else 'estimate','points':[[round(x,2),round(z,2)] for x,z in part.coords]})
# Split the bounding rectangle along real coastline. OSM land is left in lon/lat,
# hence right after reversing latitude to the game's south-positive Z axis.
segments=[(a,b) for l in coasts for a,b in zip(list(l.coords),list(l.coords)[1:])]
regions=list(polygonize(unary_union([clip.boundary,*coasts])))
land=[]
for region in regions:
 q=region.representative_point();px,pz=q.x,q.y
 aa,bb=min(segments,key=lambda ab:LineString(ab).distance(q))
 cross=(bb[0]-aa[0])*(pz-aa[1])-(bb[1]-aa[1])*(px-aa[0])
 if cross<0:land.append(region)
 else:water.append({'id':'coastline-derived','rings':rings(region)})
waterUnion=unary_union([Polygon(w['rings'][0],w['rings'][1:]) for w in water]); landGeom=clip.difference(waterUnion)
# Source footprints define all collision. Courtyards remain open.
solid=unary_union([Polygon(b['rings'][0],b['rings'][1:]) for b in buildings])
def clear(p,r=1):return landGeom.contains(Point(p)) and solid.distance(Point(p))>r
# Keep the introductory mission on the actual open Rautatientori square.
for z in range(-55,61):
 if not clear((0,z),.6):raise RuntimeError(f'Intro corridor blocked at {z}')
# Real public footways for NPCs, clipped away from buildings and shoreline.
routes=[]
for road in roads:
 if road['kind'] not in ['footway','pedestrian','path']:continue
 if 'steps'==road['kind']:continue
 for a,b in zip(road['points'],road['points'][1:]):
  ln=LineString([a,b]);length=ln.length
  if length<14 or length>100:continue
  if ln.distance(solid)<1 or not landGeom.covers(ln.buffer(.4)):continue
  routes.append([a,b])
routes=sorted(routes,key=lambda r:(r[0][0]//120,r[0][1]//120)); selected=[];occupied={}
for r in routes:
 cell=(int(r[0][0]//120),int(r[0][1]//120))
 if occupied.get(cell,0)<2:selected.append(r);occupied[cell]=occupied.get(cell,0)+1
# Snap game-only terminals to mapped public footways, never invent a real shop claim.
def terminal(lon,lat,name):
 target=Point(xy({'lon':lon,'lat':lat}));candidates=[]
 for r in roads:
  if r['kind'] not in ['footway','pedestrian','path']:continue
  ln=LineString(r['points']);p=ln.interpolate(ln.project(target))
  if clear((p.x,p.y),2):candidates.append((p.distance(target),p))
 p=min(candidates,key=lambda p:p[0])[1];return {'gx':round(p.x,2),'gz':round(p.y,2),'name':name}
locations={'depot':{'gx':0,'gz':-2,'name':'Rautatientori south terminal'},'plaza':{'gx':0,'gz':-27,'name':'Rautatientori'},'compute':{'gx':0,'gz':-55,'name':'Rautatientori delivery terminal'},'exchange':terminal(24.938,60.173,'Oodi square terminal'),'relay':terminal(24.952,60.1698,'Senate Square terminal'),'arcade':terminal(24.9529,60.1672,'Market Square terminal')}
landmarks=[b for b in buildings if b['id'] in ['way/122595198','way/1542850662','way/596937289','way/123814071']]
parts=[]
for parent in landmarks:
 pg=Polygon(parent['rings'][0],parent['rings'][1:]); pgparts=[]
 for el in E:
  t=el['tags']
  if not t.get('building:part'):continue
  g=shape(el)
  if g.is_empty or g.area<.02 or not pg.buffer(1).covers(g.representative_point()):continue
  raw=num(t.get('height'));levels=num(t.get('building:levels'))
  if raw is None and levels is None:continue
  h=raw if raw is not None else levels*3.2
  for p in polys(g.intersection(clip)):
   if p.area<.02:continue
   parts.append({'id':f"{el['type']}/{el['id']}",'parent':parent['id'],'type':parent['type'],'rings':rings(p),'h':h,'minHeight':num(t.get('min_height')) or 0,'roofHeight':num(t.get('roof:height')) or 0,'roofShape':t.get('roof:shape','flat'),'heightSource':'height' if raw is not None else 'levels-estimate','bounds':[round(v,2) for v in p.bounds]})
   pgparts.append(p)
 if pgparts and unary_union(pgparts).intersection(pg).area/pg.area>.85:
  parent['detailedParts']=True

result={'meta':{'source':'OpenStreetMap contributors','license':'ODbL-1.0','attributionUrl':'https://www.openstreetmap.org/copyright','retrievedAt':D['retrievedAt'],'bbox':D['bbox'],'origin':origin,'projection':'Local equirectangular metres, X east, Z south','earthRadius':R,'heightPolicy':'OSM height; else building:levels × 3.2 m; else 16 m. Flat roofs and level terrain are approximations.','omittedIncompleteBuildingFeatures':missing},'bounds':bounds,'buildings':buildings,'parts':parts,'parks':parks,'water':water,'roads':roads,'trees':trees,'routes':selected[::max(1,math.ceil(len(selected)/90))][:90],'locations':locations,'landmarks':[{'id':b['id'],'name':b['name'],'bounds':b['bounds']} for b in landmarks]}
json.dump(result,open('public/data/helsinki/map.json','w'),separators=(',',':'))
print({k:len(result[k]) for k in ['buildings','roads','parks','water','trees','routes']});print('bounds',bounds);print('landmarks',result['landmarks']);print('terminals',locations)
