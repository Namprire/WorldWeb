import {readFile,writeFile} from 'node:fs/promises';
import {ShapeUtils,Vector2} from 'three';
const data=JSON.parse(await readFile('public/data/helsinki/map.json','utf8'));
for(const item of [...data.buildings,...data.parts,...data.parks,...data.water]) {
 const rings=item.rings.map(r=>r.map(p=>new Vector2(...p)));
 item.triangles=ShapeUtils.triangulateShape(rings[0],rings.slice(1)).filter(t=>{const v=item.rings.flat(),[a,b,c]=t.map(i=>v[i]);return Math.abs((b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]))>1e-6;});
 const points=item.rings.flat();
 item.bounds=[Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];
}
for(const r of data.roads)r.bounds=[Math.min(...r.points.map(p=>p[0])),Math.min(...r.points.map(p=>p[1])),Math.max(...r.points.map(p=>p[0])),Math.max(...r.points.map(p=>p[1]))];
await writeFile('public/data/helsinki/map.json',JSON.stringify(data));
await writeFile('public/data/helsinki/map-data.js','// OpenStreetMap-derived database, ODbL-1.0. See SOURCES.md.\nexport const mapData = '+JSON.stringify(data)+';\n');
console.log('Triangulated',data.buildings.length,'footprints with courtyard holes preserved.');
