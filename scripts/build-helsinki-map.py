"""Run: uv run --with shapely==2.1.2 python scripts/build-helsinki-map.py
OSM-derived database is ODbL. Heights and road widths explicitly identify estimates.
"""
import json,math
from shapely.geometry import Polygon,LineString,Point,box
from shapely.geometry.polygon import orient
from shapely.ops import unary_union,polygonize,linemerge
from shapely import make_valid
D=json.load(open('data/map/source.osm.json')); E=D['elements']
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
   buildings.append({'id':oid,'name':t.get('name:en',t.get('name','')),'rings':rings(p),'h':round(min(100,height),2),'heightSource':'height' if raw else 'levels-estimate' if levels else 'fallback-estimate','bounds':[round(v,2) for v in p.bounds], 'type':t['building'],
    'tags':{k:t[k] for k in ['building:colour','roof:colour','roof:shape','building:material','roof:material','building:levels','start_date'] if k in t}})
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

# City of Helsinki building register: floors, completion year and facade material for each footprint.
import os,random
REGISTER='data/map/register.json'
FACADE={'1':'concrete','2':'brick','3':'metal','4':'stone','5':'wood','6':'glass','7':'render'}
def hexrgb(h):
 h=h.lstrip('#');return [round(int(h[i:i+2],16)/255,3) for i in (0,2,4)]
NAMED={'white':'#e8e6df','yellow':'#d9b45a','beige':'#cbb48e','cream':'#e3d7b8','grey':'#9a9a94','gray':'#9a9a94','red':'#9c4a3c','brown':'#7a5440','pink':'#d39a8c','green':'#6f8f6a','orange':'#c98a4a','black':'#2c2e31','blue':'#6c87a3','darkgrey':'#55585b','darkgray':'#55585b','lightgrey':'#c4c3bd'}
def colour(v):
 if not v:return None
 v=v.strip().lower()
 if v.startswith('#') and len(v)==7:return hexrgb(v)
 return hexrgb(NAMED[v]) if v in NAMED else None
# Facade palettes by material and era, sampled from central Helsinki streets.
OLD_RENDER=['#d8b45f','#e2cc8f','#d9a68a','#e6dccb','#c9b79c','#b8a58a','#e0c3a6','#c7c9b8','#d6b07a','#ead7ae']
STONE=['#8d8a83','#a19c92','#76736d','#9b9285']
OLD_BRICK=['#c9a46e','#d8bf93','#b98d6c','#d6c6a9']
NEW_BRICK=['#9a5440','#87493a','#a8644b','#7d4f3f']
CONCRETE=['#c8c6bf','#b6b4ae','#d9d6cd','#a9a8a3']
GLASS=['#7f95a3','#6f8796','#8aa0ab']
METAL=['#9aa0a3','#80868a']
WOOD=['#c9a24a','#a6503c','#d8cfb6']
def pick(lst,seed):return hexrgb(lst[int(seed*997)%len(lst)])
def facade(material,year,seed):
 if material=='glass':return pick(GLASS,seed)
 if material=='metal':return pick(METAL,seed)
 if material=='wood':return pick(WOOD,seed)
 if material=='stone':return pick(STONE,seed)
 if material=='concrete':return pick(CONCRETE,seed)
 if material=='brick':return pick(OLD_BRICK if year and year<1940 else NEW_BRICK if year and year>=1950 else OLD_RENDER,seed)
 if year and year>=1960:return pick(CONCRETE,seed)
 return pick(OLD_RENDER,seed)
ROOF_TIN=['#3f454b','#4b5157','#34383c','#585d61','#6a4a3e']
register=[]
if os.path.exists(REGISTER):
 REG=json.load(open(REGISTER))
 for f in REG['features']:
  g=f['geometry'];polysR=[]
  if g['type']=='Polygon':g={'type':'MultiPolygon','coordinates':[g['coordinates']]}
  for poly in g['coordinates']:
   ext=[xy({'lon':x,'lat':y}) for x,y in poly[0]];holes=[[xy({'lon':x,'lat':y}) for x,y in r] for r in poly[1:]]
   if len(ext)>=4:polysR.append(make_valid(Polygon(ext,holes)))
  if not polysR:continue
  shapeR=unary_union(polysR);pr=f['properties']
  year=int(str(pr['c_valmpvm'])[:4]) if pr.get('c_valmpvm') else None
  register.append({'geom':shapeR,'floors':pr.get('i_kerrlkm'),'year':year,'material':FACADE.get(str(pr.get('c_julkisivu'))),'use':pr.get('tyyppi')})
 from shapely.strtree import STRtree
 tree=STRtree([r['geom'] for r in register])
matched=0
for b in buildings:
 poly=Polygon(b['rings'][0],b['rings'][1:]);seed=(int(b['id'].split('/')[1])%997)/997
 best=None;bestArea=0
 if register:
  for i in tree.query(poly):
   a=register[i]['geom'].intersection(poly).area
   if a>bestArea:bestArea=a;best=register[i]
 info=best if best and bestArea>0.3*min(poly.area,best['geom'].area) else None
 t=b.pop('tags',{})
 year=info['year'] if info else None
 if not year and t.get('start_date','')[:4].isdigit():year=int(t['start_date'][:4])
 material=(info or {}).get('material') or {'brick':'brick','stone':'stone','glass':'glass','concrete':'concrete','metal':'metal','wood':'wood','plaster':'render'}.get(t.get('building:material',''))
 if info and info['floors'] and b['heightSource']!='height':
  b['h']=round(min(100,info['floors']*3.5+1.2),2);b['heightSource']='register-floors';matched+=1
 if year:b['year']=year
 if material:b['material']=material
 # OSM colour tags are rough (pure white, pure black, web red): use them as a hint, blended with the palette and clamped.
 def soften(c,base,lo,hi):
  if not c:return base
  m=[0.55*a+0.45*b for a,b in zip(c,base)];return [round(min(hi,max(lo,v)),3) for v in m]
 b['wall']=soften(colour(t.get('building:colour')),facade(material,year,seed),0.22,0.86)
 shape=t.get('roof:shape')
 pitched=shape in ('hipped','gabled','mansard','pyramidal','half-hipped','gambrel','skillion') if shape else (year is not None and year<1932 and b['h']>=7)
 b['roofColour']=soften(colour(t.get('roof:colour')),pick(ROOF_TIN,seed) if pitched else hexrgb('#5f6264'),0.17,0.7)
 if pitched and b['type']!='cathedral':
  # Hipped roof: slopes from every outer and courtyard edge up to an inset ridge outline.
  d=min(6.5,max(1.5,b['h']*0.18))
  top=poly.buffer(-d,join_style=2)
  while (top.is_empty or top.area<4) and d>1.2:
   d*=0.7;top=poly.buffer(-d,join_style=2)
  if not top.is_empty and top.area>=4:
   band=poly.difference(top)
   b['roof']={'rise':round(min(4.5,d*0.75),2),'band':[rings(p_) for p_ in polys(band) if p_.area>0.5],'top':[rings(p_) for p_ in polys(top) if p_.area>0.5]}
print('register matched heights for',matched,'of',len(buildings),'buildings;',sum(1 for b in buildings if 'roof' in b),'pitched roofs')
result={'meta':{'source':'OpenStreetMap contributors','license':'ODbL-1.0','attributionUrl':'https://www.openstreetmap.org/copyright','retrievedAt':D['retrievedAt'],'bbox':D['bbox'],'origin':origin,'projection':'Local equirectangular metres, X east, Z south','earthRadius':R,'heightPolicy':'OSM height tag; else City of Helsinki register floors x 3.5 m + 1.2 m; else OSM building:levels x 3.2 m; else 16 m. Roof shapes before 1932 are inferred as hipped unless OSM tags a shape. Facade colours follow register material and era unless OSM tags a colour. Terrain is level.','omittedIncompleteBuildingFeatures':missing},'bounds':bounds,'buildings':buildings,'parts':parts,'parks':parks,'water':water,'roads':roads,'trees':trees,'routes':selected[::max(1,math.ceil(len(selected)/90))][:90],'locations':locations,'landmarks':[{'id':b['id'],'name':b['name'],'bounds':b['bounds']} for b in landmarks]}
json.dump(result,open('public/data/helsinki/map.json','w'),separators=(',',':'))
print({k:len(result[k]) for k in ['buildings','roads','parks','water','trees','routes']});print('bounds',bounds);print('landmarks',result['landmarks']);print('terminals',locations)
