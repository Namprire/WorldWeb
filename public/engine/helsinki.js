/* Daylight materials and shared geometry helpers. District layout lives in helsinki-map.js. */
export const helsinkiSurfacePalette = `
  // Helsinki plaster, oxidised copper and pale granite, under the original paint strokes.
  if (gIndoor < 0.5) {
    if (kind == 1.0) {
      vec3 plaster = seed < .30 ? vec3(.78,.61,.34) : seed < .60 ? vec3(.70,.43,.34) : vec3(.80,.74,.57);
      base = mix(base, plaster, .88);
    } else if (kind == 2.0) base = mix(base,vec3(.13,.28,.23),.83);
    else if (kind == 3.0 || kind == 7.0) base = mix(base,vec3(.45,.46,.40),.88);
    else if (kind == 4.0) base = mix(base,vec3(.52,.24,.15),.80);
    else if (kind == 5.0 || kind == 13.0) base = mix(base,vec3(.25,.37,.10),.72);
    else if (kind == 8.0 || kind == 9.0) base = mix(base,vec3(.34,.43,.10),.65);
    else if (kind == 11.0) base = mix(base,vec3(.66,.60,.46),.70);
    else if (kind == 17.0) base = mix(base,vec3(.14,.29,.24),.65);
  }
`;

export function installHelsinki(engine) {
  const { shared, sky, hills, post, Builder, Mesh, Group, kinds, ball, rod } =
    engine;
  const paint = engine.paintMaterial();
  const root = new Group();
  root.name = "Helsinki streetscape · visual layer";
  engine.scene.add(root);
  const colors = {
    cream: [0.83, 0.76, 0.58],
    copper: [0.14, 0.3, 0.24],
    wood: [0.45, 0.24, 0.1],
    bark: [0.78, 0.76, 0.62],
    ink: [0.065, 0.095, 0.08],
    leaf: [0.39, 0.47, 0.1],
    gold: [0.68, 0.48, 0.12],
    pink: [0.67, 0.28, 0.26],
    green: [0.18, 0.32, 0.14],
  };
  function builder() {
    const b = new Builder(32768);
    b.reset(0, 0, 0, 0);
    return b;
  }
  function localBox(b, x, y, z, w, h, d, color, kind = kinds.PLAIN) {
    b.color(color).data(kind, 0.43, 1, 0);
    const original = b.p;
    b.p = b.pl;
    b.box(x - w / 2, x + w / 2, z - d / 2, z + d / 2, y, y + h);
    b.p = original;
  }
  function ellipsoid(b, x, y, z, rx, ry, rz, color, kind = kinds.FIGURE) {
    b.color(color).data(kind, 0.47, 0.8, 0);
    ball(b, x, y, z, rx, ry, rz, 12, 8);
  }
  function line(b, a, c, width, color) {
    b.color(color).data(kinds.PLAIN, 0.31, 0.8, 0);
    rod(b, ...a, ...c, width);
  }
  function mesh(b, parent = root, mat = paint) {
    const m = new Mesh(b.build(), mat);
    m.frustumCulled = false;
    parent.add(m);
    return m;
  }
  function pos(gx, gz) {
    return [
      engine.worldX(gx, gz),
      engine.ground(gx, gz),
      engine.worldZ(gx, gz),
    ];
  }

  // Keep the original projected sky and painterly postprocessing; replace only sky colour/content.
  sky.material.fragmentShader = `precision highp float;
    varying vec3 vDir; uniform float uTime; uniform vec3 uDayTint;
    ${engine.shaderNoise}
    void main(){
      vec3 dir=normalize(vDir); float altitude=max(dir.y,0.0);
      vec2 p=dir.xz/max(.24,dir.y+.28); p.x+=uTime*.003;
      vec2 flow=p+vec2(sin(p.y*1.4)*.17,sin(p.x*.8)*.13);
      float n=vnoise(flow*1.45)*.63+vnoise(flow*3.8)*.27+vnoise(flow*9.0)*.10;
      vec2 strokes=vec2(flow.x*29.+sin(flow.y*11.)*2.,flow.y*90.);
      float dab=vnoise(strokes)*.6+vnoise(strokes*2.4)*.4;
      float cloud=smoothstep(.55,.78,n+(.5-dab)*.065)*smoothstep(-.07,.25,dir.y);
      vec3 blue=mix(vec3(.55,.72,.77),vec3(.15,.43,.67),pow(altitude,.45));
      vec3 white=mix(vec3(.69,.75,.72),vec3(1.,.94,.77),smoothstep(.49,.8,n));
      vec3 c=mix(blue,white,cloud); c*=.96+.08*dab;
      float sun=pow(max(dot(dir,normalize(vec3(-.45,.72,.38))),0.),220.);
      c+=vec3(1.,.82,.49)*sun*.40;
      gl_FragColor=vec4(c*uDayTint,1.);
    }`;
  sky.material.uniforms.uDayTint = { value: new engine.Color(1, 1, 1) };
  sky.material.needsUpdate = true;
  // Preserve the original hills' strokes and reveal animation, with a distant sage palette.
  for (const layer of hills.layers) {
    // Lower the reference's mountain silhouette into a distant, gentle treeline.
    const positions = layer.geometry.attributes.position;
    const ridge = layer.geometry.attributes.aRidge;
    for (let j = 0; j < positions.count; j++) {
      if (positions.getY(j) > 0) positions.setY(j, positions.getY(j) * 0.16);
      ridge.setX(j, ridge.getX(j) * 0.16);
    }
    positions.needsUpdate = ridge.needsUpdate = true;
    const mat = layer.material;
    mat.fragmentShader = mat.fragmentShader
      .replace(
        /vec3 ramp\(float v\) \{[\s\S]*?\n\}/,
        `vec3 ramp(float v) {
      vec3 deep=mix(vec3(.11,.23,.18),vec3(.27,.39,.35),uLayer);
      vec3 mid=mix(vec3(.27,.38,.24),vec3(.43,.53,.44),uLayer);
      vec3 lite=mix(vec3(.51,.57,.33),vec3(.58,.66,.55),uLayer);
      return v<.5?mix(deep,mid,clamp(v*2.,0.,1.)):mix(mid,lite,clamp(v*2.-1.,0.,1.));
    }`,
      )
      .replace(
        "const vec3 DARK = vec3(0.013, 0.019, 0.048);",
        "const vec3 DARK = vec3(.12,.23,.20);",
      );
    mat.needsUpdate = true;
  }
  shared.uMoonDir.value.set(-0.45, 0.72, 0.38).normalize();
  shared.uAmbSky.value.setRGB(0.36, 0.46, 0.51);
  shared.uAmbGround.value.setRGB(0.21, 0.23, 0.16);
  shared.uGlow.value = 0.3;
  shared.uStrokeDist.value = 10;
  post.composite.uniforms.uExposure.value = 0.96;
  post.composite.uniforms.uOutline.value = 0.38;
  post.composite.uniforms.uVignette.value = 0.12;
  post.composite.uniforms.uContrast.value = 0.13;
  post.prefilter.uniforms.uThreshold.value = 1.5;

  const themeTints = {
    breakthrough: {
      fog: [0.56, 0.69, 0.69],
      sun: [0.78, 0.74, 0.62],
      warm: [1, 0.66, 0.28],
      sky: [1, 1, 1],
    },
    emergency: {
      fog: [0.63, 0.54, 0.49],
      sun: [1, 0.61, 0.4],
      warm: [1, 0.3, 0.18],
      sky: [1.04, 0.89, 0.82],
    },
    market: {
      fog: [0.51, 0.62, 0.69],
      sun: [0.74, 0.76, 0.68],
      warm: [0.89, 0.61, 0.31],
      sky: [0.88, 0.96, 1.04],
    },
  };
  function atmosphere(mode) {
    const t = themeTints[mode] || themeTints.breakthrough;
    shared.uFogColor.value.setRGB(...t.fog);
    shared.uMoonCol.value.setRGB(...t.sun);
    shared.uWarmCol.value.setRGB(...t.warm);
    sky.material.uniforms.uDayTint.value.setRGB(...t.sky);
  }
  atmosphere("breakthrough");
  const helpers = { builder, localBox, ellipsoid, line, mesh, paint, colors };
  return {
    atmosphere,
    helpers,
    update() {
      shared.uHeadPower.value = 0;
    },
  };
}
