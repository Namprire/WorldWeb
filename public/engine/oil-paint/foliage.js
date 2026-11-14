/* Layered crown, bark and leaf strokes, adapted from Patch's world/forest.js
   and world/leaves.js (MIT). All tree centres remain at their mapped locations.
   One shared material; geometry is batched by the existing 100 m map tiles. */
const CORNERS = [[-1,-1],[1,-1],[1,1],[-1,1]];
function rng(id) {
  let seed = id * 9137 + 71;
  return () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
}
export function createFoliagePainter(engine, atlas) {
  const material = new engine.Material({
    name: "Patch oil paint / layered seasonal foliage",
    side: 2,
    uniforms: {
      tOilBrush: {value:atlas},
      uFogColor:engine.shared.uFogColor, uFogRange:engine.shared.uFogRange,
      uSun:engine.shared.uMoonDir, uSunColor:engine.shared.uMoonCol,
      uAutumn:engine.shared.uAutumn, uPaintTime:engine.shared.uPaintTime,
      uCityMap:engine.shared.uCityMap,
    },
    vertexShader: /* glsl */ `
      attribute vec4 aStroke;
      attribute vec2 aCorner;
      attribute vec3 aPaint; // family, kind (crown/core/falling/ground), phase
      uniform vec3 uSun;
      uniform vec3 uSunColor;
      uniform float uAutumn, uPaintTime, uCityMap;
      varying vec2 vUv;
      varying vec3 vPaint;
      varying float vDistance;
      const vec3 LEAF_L[5] = vec3[5](vec3(1.,.8,.2),vec3(1.,.57,.12),vec3(.94,.26,.09),vec3(.86,.82,.24),vec3(1.,.9,.36));
      const vec3 LEAF_M[5] = vec3[5](vec3(.76,.49,.11),vec3(.72,.33,.09),vec3(.61,.15,.08),vec3(.52,.52,.14),vec3(.82,.62,.17));
      const vec3 LEAF_S[5] = vec3[5](vec3(.46,.25,.10),vec3(.42,.17,.09),vec3(.34,.09,.11),vec3(.24,.29,.13),vec3(.50,.33,.13));
      void main() {
        float phase = aPaint.z;
        float kind = aPaint.y;
        if (kind > 1.5 && (uAutumn < .5 || uCityMap > .05)) {
          gl_Position=vec4(2.,2.,2.,1.); return;
        }
        vec3 P = position;
        float t = uPaintTime;
        float turn = sin(t*1.3+phase*23.);
        float gust = .5+.5*sin(t*.45+P.x*.035+P.z*.021);
        if (kind < 1.5) {
          P.x += sin(t*.8+phase*6.)*.16*gust;
          P.z += sin(t*.6+phase*5.)*.10*gust;
        } else if (kind < 2.5) {
          float life = fract(phase+t*(.045+phase*.025));
          P.y *= 1.-life;
          P.x += sin(t*.7+phase*16.)*1.7+life*2.;
          P.z += cos(t*.6+phase*14.)*.8;
        }
        vec4 view = modelViewMatrix*vec4(P,1.);
        float angle = phase*6.28 + (kind > 1.5 && kind < 2.5 ? turn*2. : .22*sin(t+phase*8.)*gust);
        vec2 along=vec2(sin(angle),cos(angle)), across=vec2(along.y,-along.x);
        if (kind > 2.5) {
          vec2 a = along*aCorner.y*aStroke.y + across*aCorner.x*aStroke.x;
          view = modelViewMatrix*vec4(P+vec3(a.x,0.,a.y),1.);
        } else {
          view.xy += across*aCorner.x*aStroke.x + along*aCorner.y*aStroke.y;
        }
        gl_Position=projectionMatrix*view;
        vDistance=length(view.xyz);
        vUv=(vec2(mod(aStroke.z,4.),floor(aStroke.z/4.))+(aCorner*.5+.5))/vec2(4.,2.);
        int family = int(aPaint.x+.5);
        vec3 toEye = normalize(cameraPosition-P);
        float through = pow(max(dot(-toEye,uSun),0.),2.);
        float lit = clamp(.50+.43*dot(normal,uSun)+through*.35,0.,1.);
        if (kind > .5 && kind < 1.5) lit *= .28;
        if (kind > 2.5) lit *= .85;
        lit += (phase-.5)*.15;
        vec3 autumn = mix(LEAF_S[family],LEAF_M[family],smoothstep(.24,.36,lit));
        autumn = mix(autumn,LEAF_L[family],smoothstep(.56,.7,lit));
        if (kind > .5 && kind < 1.5) autumn = mix(LEAF_S[family]*.5,vec3(.12,.10,.17),.35);
        vec3 night = mix(vec3(.10,.19,.13),vec3(.37,.46,.19),lit);
        night *= .19+uSunColor*.9;
        // The reference mixes pigments directly; do not shade the autumn paint twice.
        vPaint = mix(night,pow(autumn,vec3(1.6))*.88,uAutumn) * mix(.91,1.08,aStroke.w);
        vPaint = mix(vPaint,vec3(.42,.52,.28),uCityMap);
      }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D tOilBrush;
      uniform vec3 uFogColor;
      uniform vec2 uFogRange;
      varying vec2 vUv;
      varying vec3 vPaint;
      varying float vDistance;
      void main() {
        vec3 mark=texture2D(tOilBrush,vUv).rgb;
        if(mark.g < .34) discard;
        vec2 e=vec2(1.5/512.,0.);
        float hu=texture2D(tOilBrush,vUv+e.xy).r-texture2D(tOilBrush,vUv-e.xy).r;
        float hv=texture2D(tOilBrush,vUv+e.yx).r-texture2D(tOilBrush,vUv-e.yx).r;
        float rake=.5*hu-.7*hv;
        vec3 col=mix(vPaint,vPaint*1.15,smoothstep(.52,.78,mark.b));
        col*=mix(.95,1.04,mark.r)*(1.+rake*1.25);
        col+=vec3(1.,.97,.9)*pow(max(rake,0.),2.)*.7;
        float fog=pow(smoothstep(uFogRange.x,uFogRange.y,vDistance),1.3);
        gl_FragColor=vec4(mix(col,uFogColor,fog*.97),1.);
      }`,
  });
  function mark(batch, p, n, size, family, kind, random) {
    const cell=Math.floor(random()*8), tone=random(), phase=random();
    for(const corner of CORNERS) {
      batch.positions.push(...p); batch.normals.push(...n);
      batch.paint.push(family,kind,phase);
      batch.strokes.push(...size,cell,tone); batch.corners.push(...corner);
    }
  }
  return {
    batch: () => ({positions:[],normals:[],paint:[],strokes:[],corners:[]}),
    tree(batch,x,z,id,b,helpers) {
      const random=rng(id), birch=id%4===0;
      const height=9+random()*6, spread=birch?2.2:3.2+random()*1.4;
      const family=birch?4:id%5;
      const lean=(random()-.5)*.9;
      const bark=birch?[.67,.64,.54]:[.24,.18,.19];
      const {line}=helpers;
      // Branches support irregular, overlapping crowns instead of solid spheres.
      const top=[x+lean,height*.85,z+lean*.4];
      line(b,[x,0,z],[x+lean*.3,height*.48,z],birch?.15:.24,bark);
      line(b,[x+lean*.3,height*.48,z],top,birch?.10:.15,bark);
      if (birch) for(let k=1;k<8;k++) {
        const y=k*.7, dx=lean*y/height;
        line(b,[x+dx-.12,y,z+.12],[x+dx+.12,y+.03,z+.12],.035,[.17,.17,.19]);
      }
      for(let l=0;l<6;l++) {
        const angle=l*2.399+random()*.5;
        const radius=l===5?0:spread*(.48+random()*.25);
        const cx=x+lean+Math.cos(angle)*radius, cz=z+Math.sin(angle)*radius;
        const cy=height*(.63+l*.048);
        const reach=spread*(.43+random()*.16);
        line(b,[x+lean*.5,height*(.43+l*.045),z],[cx,cy,cz],.07,bark);
        for(let i=0;i<38;i++) {
          const y=random()*2-1,a=random()*Math.PI*2,ring=Math.sqrt(1-y*y);
          const nx=Math.cos(a)*ring,nz=Math.sin(a)*ring;
          const p=[cx+nx*reach,cy+y*reach*.9,cz+nz*reach];
          mark(batch,p,[nx,y,nz],[.30+random()*.22,.39+random()*.28],random()<.12?(family+1)%5:family,0,random);
        }
        // Small shaded touches fill the inside. No opaque crown or giant card.
        for(let i=0;i<4;i++) mark(batch,[cx+(random()-.5)*reach,cy-.2,cz+(random()-.5)*reach],
          [0,-.3,0],[.35,.48],family,0,random);
      }
      for(let i=0;i<6;i++) {
        mark(batch,[x+(random()-.5)*spread*2,height*(.5+random()*.3),z+(random()-.5)*spread*2],[0,1,0],[.09,.16],family,2,random);
      }
      for(let i=0;i<38;i++) {
        const angle=random()*Math.PI*2,r=Math.sqrt(random())*spread*1.45;
        mark(batch,[x+Math.cos(angle)*r,.10+random()*.015,z+Math.sin(angle)*r],[0,1,0],[.12+random()*.15,.19+random()*.2],family,3,random);
      }
    },
    mesh(batch) {
      const geometry=new engine.Geometry();
      for(const [name,data,size] of [["position",batch.positions,3],["normal",batch.normals,3],
        ["aPaint",batch.paint,3],["aStroke",batch.strokes,4],["aCorner",batch.corners,2]])
        geometry.setAttribute(name,new engine.Attribute(new Float32Array(data),size));
      const indices=new Uint32Array(batch.positions.length/12*6);
      for(let i=0;i<indices.length/6;i++) indices.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6);
      geometry.setIndex(new engine.Attribute(indices,1));
      geometry.computeBoundingSphere();
      const mesh=new engine.Mesh(geometry,material);
      mesh.name="Helsinki / layered crowns and autumn leaves";
      return mesh;
    },
  };
}
