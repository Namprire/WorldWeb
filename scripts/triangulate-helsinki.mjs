import {readFile,writeFile} from 'node:fs/promises';
import {ShapeUtils,Vector2} from 'three';
const data=JSON.parse(await readFile('public/data/helsinki/map.json','utf8'));
for(const item of [...data.buildings,...data.parts,...data.parks,...data.water]) {
 const rings=item.rings.map(r=>r.map(p=>new Vector2(...p)));
 item.triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1)).filter(t=>{const v=item.rings.flat(),[a,b,c]=t.map(i=>v[i]);return Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-6;});
 const points=item.rings.flat();
 item.bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
// Roof slopes: a vertex on the footprint outline is an eave (lift 0); any other vertex is on the ridge (lift 1).
const tri=(rings)=>{const v=rings.map(r=>r.map(p=>new Vector2(...p)));return ShapeUtils.triangulateShape(v[0],v.slice(1));};
const onEdge=(p,rings)=>rings.some(r=>r.some((a,i)=>{const b=r[(i+1)%r.length],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dz)/(dx*dx+dz*dz||1)));return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dz)<0.05;}));
for(const b of data.buildings){
 if(!b.roof)continue;
 b.roof.band=b.roof.band.map(rings=>({rings,triangles:tri(rings),lift:rings.flat().map(p=>onEdge(p,b.rings)?0:1)}));
 b.roof.top=b.roof.top.map(rings=>({rings,triangles:tri(rings)}));
}
for(const r of data.roads)r.bounds=[Math.min(...r.points.map(p=>p[0])),Math.min(...r.points.map(p=>p[1])),Math.max(...r.points.map(p=>p[0])),Math.max(...r.points.map(p=>p[1]))];
await writeFile('public/data/helsinki/map.json',JSON.stringify(data));

console.log('Triangulated',data.buildings.length,'footprints with courtyard holes preserved.');
