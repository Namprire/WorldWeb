/* Adapted from Patch oil-paint src/world/sky.js (MIT). See NOTICE.md.
   The original sky strokes share WEBWORLD's renderer and fullscreen sky. */
import { dabMaterial, dabGeometry, dabMesh } from "./reference/dabs.js";
import { Group } from "./reference/three.js";

export const AUTUMN_SKY = /* glsl */ `
vec3 autumnSky(vec3 v) {
  float sunward = max(dot(v, uSunDir), 0.0);
  vec3 low = airColour(v);
  vec3 high = mix(vec3(.37,.52,.67), vec3(.73,.77,.69), sunward * sunward);
  vec3 c = mix(low, high, smoothstep(0.0, .75, v.y));
  c = mix(c, vec3(1.,.90,.61), pow(sunward,24.) * .9);
  // The reference presents paint directly. Undo that display encoding before
  // WEBWORLD's existing linear/HDR finish, keeping blue and gold distinct.
  return pow(c,vec3(2.2)) * .75;
}
`;

export function createAutumnSky(shared) {
  const group = new Group();
  group.name = "Patch / autumn painted sky";
  const count = 1700;
  const dirs = new Float32Array(count * 4);
  let seed = 515;
  const rand = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
  for (let i = 0; i < count; i++) {
    const a = rand() * Math.PI * 2, y = -.08 + Math.pow(rand(),1.4)*1.08;
    const r = Math.sqrt(Math.max(0,1-y*y));
    dirs.set([Math.cos(a)*r,y,Math.sin(a)*r,rand()*1000],i*4);
  }
  const strokes = dabMesh(dabGeometry(count,{aDir:[dirs,4]}),dabMaterial(shared,{
    head: AUTUMN_SKY + "in vec4 aDir;",
    body: /* glsl */ `
      void makeDab(inout Dab d) {
        vec4 r = hash4(aDir.w);
        vec3 v = normalize(aDir.xyz);
        d.pos = cameraPosition + v * 1200.;
        vec3 level = normalize(cross(vec3(0.,1.,0.),v));
        vec3 ring = normalize(cross(uSunDir,v)+1e-4);
        d.dir = normalize(mix(level,ring,.45)+vec3(0.,(r.x-.5)*.5,0.));
        d.size = vec2(46.+40.*r.y,150.+130.*r.z) * 1.5;
        vec3 c = autumnSky(v);
        d.c1 = jitter(c,r.yzw,.16);
        d.c2 = jitter(c*1.035,r.wxy,.18);
        d.seed = aDir.w;
        d.lift = 0.;
      }`,
    uniforms:{uImpasto:{value:.18}},
    minPx:[10,20],maxPx:[900,1800],cells:[0,8],depthTest:false,depthWrite:false,
  }),-9);
  strokes.material.alphaToCoverage = false;
  group.add(strokes);
  return {group};
}
