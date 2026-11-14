/* World-pinned brush cards, adapted from Patch's oilpaint/dabs.js (MIT).
   Batched by the existing map tiles; geographic tree positions stay unchanged. */
export function createFoliagePainter(engine, atlas) {
  const material = new engine.Material({
    name: "Patch oil paint / foliage dabs",
    side: 2,
    uniforms: {
      tOilBrush: { value: atlas },
      uFogColor: engine.shared.uFogColor,
      uFogRange: engine.shared.uFogRange,
      uSun: engine.shared.uMoonDir,
      uSunColor: engine.shared.uMoonCol,
    },
    vertexShader: `
      attribute vec4 aStroke;
      attribute vec2 aCorner;
      attribute vec3 color;
      uniform vec3 uSun;
      uniform vec3 uSunColor;
      varying vec2 vUv;
      varying vec3 vPaint;
      varying float vDistance;
      void main() {
        vec4 view = modelViewMatrix * vec4(position,1.);
        vec3 run = mat3(viewMatrix) * vec3(.35,1.,.12);
        vec2 along = normalize(run.xy + vec2(.0001));
        vec2 across = vec2(along.y,-along.x);
        view.xy += across * aCorner.x * aStroke.x + along * aCorner.y * aStroke.y;
        gl_Position = projectionMatrix * view;
        vDistance = length(view.xyz);
        vec2 q = aCorner * .5 + .5;
        vUv = (vec2(mod(aStroke.z,4.),floor(aStroke.z/4.)) + q) / vec2(4.,2.);
        float lit = smoothstep(-.35,.8,dot(normal,uSun));
        vec3 shade = color * vec3(.52,.66,.82);
        vec3 light = color * vec3(1.15,1.08,.71) + vec3(.055,.032,.004);
        vPaint = mix(shade,light,lit) * mix(.85,1.14,aStroke.w) * (.12 + uSunColor * .72);
      }`,
    fragmentShader: `
      uniform sampler2D tOilBrush;
      uniform vec3 uFogColor;
      uniform vec2 uFogRange;
      varying vec2 vUv;
      varying vec3 vPaint;
      varying float vDistance;
      void main() {
        vec3 mark = texture2D(tOilBrush,vUv).rgb;
        if(mark.g < .38) discard;
        vec2 e = vec2(1.5/512.,0.);
        float hu = texture2D(tOilBrush,vUv+e.xy).r - texture2D(tOilBrush,vUv-e.xy).r;
        float hv = texture2D(tOilBrush,vUv+e.yx).r - texture2D(tOilBrush,vUv-e.yx).r;
        float rake = .5*hu - .7*hv;
        vec3 col = mix(vPaint,vPaint*1.22,smoothstep(.52,.78,mark.b));
        col *= mix(.95,1.04,mark.r) * (1. + rake*1.25);
        col += vec3(1.,.97,.9)*pow(max(rake,0.),2.)*1.2;
        float fog = pow(smoothstep(uFogRange.x,uFogRange.y,vDistance),1.5);
        gl_FragColor = vec4(mix(col,uFogColor,fog*.97),1.);
      }`,
  });
  return {
    batch: () => ({ positions: [], normals: [], colors: [], strokes: [], corners: [] }),
    tree(batch, x, z, id) {
      let seed = id * 9137 + 71;
      const random = () => ((seed = (Math.imul(seed,1664525)+1013904223) >>> 0) / 4294967296);
      const palette = [[.30,.40,.13],[.43,.46,.16],[.22,.37,.22],[.58,.40,.12]];
      const colour = palette[id % palette.length];
      for (let i=0;i<56;i++) {
        const y = random()*2-1, angle=random()*Math.PI*2;
        const ring = Math.sqrt(1-y*y), nx=Math.cos(angle)*ring, nz=Math.sin(angle)*ring;
        const radius = .85 + random()*.3;
        const centre = [x+nx*2*radius,5.5+y*2.5*radius,z+nz*2*radius];
        const width=.32+random()*.35, length=.42+random()*.4, mark=Math.floor(random()*8), tone=random();
        for (const corner of [[-1,-1],[1,-1],[1,1],[-1,-1],[1,1],[-1,1]]) {
          batch.positions.push(...centre); batch.normals.push(nx,y,nz);
          batch.colors.push(...colour); batch.strokes.push(width,length,mark,tone);
          batch.corners.push(...corner);
        }
      }
    },
    mesh(batch) {
      const geometry = new engine.Geometry();
      for (const [name,data,size] of [["position",batch.positions,3],["normal",batch.normals,3],
        ["color",batch.colors,3],["aStroke",batch.strokes,4],["aCorner",batch.corners,2]])
        geometry.setAttribute(name,new engine.Attribute(new Float32Array(data),size));
      geometry.computeBoundingSphere();
      const mesh = new engine.Mesh(geometry,material);
      mesh.name = "Helsinki / brush-painted tree crowns";
      return mesh;
    },
  };
}
