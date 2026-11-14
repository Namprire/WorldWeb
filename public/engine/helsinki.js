/* Moonlit Helsinki materials; the geographic layout stays in helsinki-real-map.js. */
import { installAurora } from "./oil-paint/aurora.js";
export const helsinkiSurfacePalette = `
  // Helsinki plaster, oxidised copper and pale granite, under the original paint strokes.
  if (gIndoor < 0.5) {
    // Walls and roofs keep the colours the map build derived from the Helsinki register and OSM tags.
    if (kind == 1.0 || kind == 2.0) base = base;
    else if (kind == 3.0 || kind == 7.0) base = mix(base,vec3(.40,.39,.35),.88);
    else if (kind == 4.0) base = mix(base,vec3(.23,.27,.29),.80);
    else if (kind == 5.0 || kind == 13.0) base = mix(base,vec3(.25,.37,.10),.72);
    else if (kind == 8.0 || kind == 9.0) base = mix(base,vec3(.34,.43,.10),.65);
    else if (kind == 11.0) base = mix(base,vec3(.66,.60,.46),.70);
    else if (kind == 17.0) base = mix(base,vec3(.14,.29,.24),.65);
  }
`;

export function installHelsinki(engine, oilPaint) {
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

  const aurora = installAurora(engine, oilPaint.atlas);
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

  shared.uAmbSky.value.setRGB(0.075, 0.13, 0.20);
  shared.uAmbGround.value.setRGB(0.025, 0.045, 0.065);
  shared.uGlow.value = 0.7;
  shared.uStrokeDist.value = 48;
  post.composite.uniforms.uExposure.value = 0.72;
  post.composite.uniforms.uOutline.value = 0.16;
  post.composite.uniforms.uVignette.value = 0.21;
  post.composite.uniforms.uContrast.value = 0.09;
  post.composite.uniforms.uSaturation.value = 1.08;
  post.composite.uniforms.uBloom.value = 0.18;
  post.prefilter.uniforms.uThreshold.value = 1.5;

  const themeTints = {
    breakthrough: {
      fog: [0.018, 0.055, 0.075],
      sun: [0.17, 0.26, 0.35],
      warm: [1, 0.66, 0.28],
      sky: [1, 1, 1],
    },
    emergency: {
      fog: [0.045, 0.035, 0.065],
      sun: [0.24, 0.19, 0.29],
      warm: [1, 0.3, 0.18],
      sky: [1.04, 0.89, 0.82],
    },
    market: {
      fog: [0.018, 0.035, 0.072],
      sun: [0.15, 0.22, 0.36],
      warm: [0.89, 0.61, 0.31],
      sky: [0.88, 0.96, 1.04],
    },
  };
  function atmosphere(mode) {
    const t = themeTints[mode] || themeTints.breakthrough;
    night.fog = t.fog;
    night.sun = t.sun;
    shared.uWarmCol.value.setRGB(...t.warm);
    aurora.setMood(mode);
    applyDaylight();
  }

  // Daylight. The night look above stays exactly as it was; daylight is blended over it by sun elevation.
  const night = { fog: themeTints.breakthrough.fog, sun: themeTints.breakthrough.sun, ambSky: [0.075, 0.13, 0.2], ambGround: [0.025, 0.045, 0.065], exposure: 0.72 };
  const moonDir = shared.uMoonDir.value.clone();
  const sun = { dir: new engine.Vector(0, -1, 0), elevation: -40 };
  const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
  const daySky = createDaySky();
  root.add(daySky.mesh);
  let lightState = { day: 0, dusk: 0, dark: 1 };

  function applyDaylight() {
    const e = sun.elevation;
    const day = smooth(-4, 10, e);          // full daylight once the sun is well up
    const dusk = Math.max(0, 1 - Math.abs(e + 2) / 7) * (1 - smooth(4, 12, e)); // golden and blue hour
    const dark = 1 - smooth(-13, -6, e);    // astronomical darkness, when the aurora can show
    const high = smooth(5, 35, e);
    const sunCol = mix([1.0, 0.56, 0.32], [1.0, 0.93, 0.82], high).map((v) => v * (1.05 + 0.35 * high));
    const dayFog = mix([0.62, 0.62, 0.66], [0.6, 0.7, 0.8], high);
    const duskFog = [0.34, 0.27, 0.36];
    let fog = mix(night.fog, dayFog, day);
    fog = mix(fog, duskFog, dusk * (1 - day * 0.6));
    shared.uFogColor.value.setRGB(...fog);
    shared.uMoonCol.value.setRGB(...mix(night.sun, sunCol, smooth(-6, 4, e)));
    shared.uMoonDir.value.copy(e > -6 ? sun.dir : moonDir);
    shared.uAmbSky.value.setRGB(...mix(mix(night.ambSky, [0.2, 0.2, 0.3], dusk), [0.36, 0.44, 0.58], day));
    shared.uAmbGround.value.setRGB(...mix(night.ambGround, [0.2, 0.18, 0.15], day));
    post.composite.uniforms.uExposure.value = night.exposure + 0.16 * day;
    aurora.setDarkness(dark);
    daySky.set(sun.dir, e, day, dusk, 1 - dark * 0.98);
    lightState = { day, dusk, dark };
  }
  applyDaylight();

  function createDaySky() {
    const geometry = new engine.Geometry();
    // A large inward-facing box; the shader paints by view direction, so its shape never shows.
    const s = 1;
    const p = [-s,-s,-s, s,-s,-s, s,s,-s, -s,-s,-s, s,s,-s, -s,s,-s,  -s,-s,s, s,s,s, s,-s,s, -s,-s,s, -s,s,s, s,s,s,
      -s,-s,-s, -s,s,-s, -s,s,s, -s,-s,-s, -s,s,s, -s,-s,s,  s,-s,-s, s,-s,s, s,s,s, s,-s,-s, s,s,s, s,s,-s,
      -s,s,-s, s,s,-s, s,s,s, -s,s,-s, s,s,s, -s,s,s,  -s,-s,-s, -s,-s,s, s,-s,s, -s,-s,-s, s,-s,s, s,-s,-s];
    geometry.setAttribute("position", new engine.Attribute(new Float32Array(p), 3));
    const uniforms = {
      uSun: { value: new engine.Vector(0, 1, 0) }, uElev: { value: -40 }, uDay: { value: 0 }, uDusk: { value: 0 },
      uAlpha: { value: 0 }, uTime: shared.uTime, tBrush: { value: oilPaint.atlas }, uFog: shared.uFogColor,
    };
    const material = new engine.Material({
      uniforms,
      vertexShader: `varying vec3 vDir;
        void main(){ vDir = position; vec4 p = projectionMatrix * mat4(mat3(viewMatrix)) * vec4(position * 900.0, 1.0); gl_Position = p.xyww; }`,
      fragmentShader: `uniform vec3 uSun, uFog; uniform float uElev, uDay, uDusk, uAlpha, uTime; uniform sampler2D tBrush; varying vec3 vDir;
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
          return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
        void main(){
          vec3 d = normalize(vDir); float h = max(d.y, 0.0);
          float toward = max(dot(d, normalize(uSun)), 0.0);
          // Clear Nordic blue overhead, pale at the horizon; warm towards a low sun.
          vec3 zenith = mix(vec3(0.10, 0.13, 0.30), vec3(0.24, 0.45, 0.78), uDay);
          // The horizon meets the city's fog colour, so distant buildings and sky join without a seam.
          vec3 horizon = mix(mix(vec3(0.62, 0.42, 0.45), vec3(0.78, 0.84, 0.88), uDay), uFog, 0.55);
          vec3 col = mix(horizon, zenith, pow(h, 0.55));
          col = mix(col, vec3(1.0, 0.62, 0.36), uDusk * pow(toward, 3.0) * (1.0 - h) * 0.9);
          col += vec3(1.0, 0.9, 0.7) * pow(toward, 900.0) * smoothstep(-1.0, 1.0, uElev) * 1.4;
          col += vec3(1.0, 0.8, 0.55) * pow(toward, 24.0) * 0.25 * smoothstep(-2.0, 2.0, uElev);
          // Brushed streaks: long horizontal strokes and soft cloud banks, in the painting's hand.
          vec2 q = vec2(atan(d.z, d.x) * 6.0, d.y * 22.0);
          float stroke = noise(q * vec2(1.0, 3.0) + vec2(uTime * 0.004, 0.0)) * 0.6 + noise(q * vec2(3.0, 9.0)) * 0.4;
          float cloud = smoothstep(0.55, 0.85, noise(vec2(atan(d.z, d.x) * 2.5 + uTime * 0.003, d.y * 6.0)) ) * smoothstep(0.02, 0.25, h) * (1.0 - smoothstep(0.55, 0.9, h));
          col = mix(col, mix(vec3(0.95, 0.94, 0.92), vec3(0.98, 0.7, 0.55), uDusk), cloud * 0.35 * (0.4 + 0.6 * uDay + uDusk * 0.5));
          col *= 0.94 + 0.12 * stroke;
          col = mix(col, uFog, smoothstep(0.02, -0.06, d.y));
          gl_FragColor = vec4(col, uAlpha);
        }`,
      // Opaque pass, drawn right after the night sky and before the city, but alpha-blended over it.
      // (A transparent material would be drawn after the city and cover it.)
      transparent: false,
      blending: 5, // CustomBlending
      blendEquation: 100, // AddEquation
      blendSrc: 204, // SrcAlphaFactor
      blendDst: 205, // OneMinusSrcAlphaFactor
      depthTest: false,
      depthWrite: false,
      side: 2,
    });
    const mesh = new engine.Mesh(geometry, material);
    mesh.frustumCulled = false;
    mesh.renderOrder = -90;
    return {
      mesh,
      set(dir, elevation, day, dusk, alpha) {
        uniforms.uSun.value.copy(dir);
        uniforms.uElev.value = elevation;
        uniforms.uDay.value = day;
        uniforms.uDusk.value = dusk;
        uniforms.uAlpha.value = alpha;
        mesh.visible = alpha > 0.01;
      },
    };
  }

  atmosphere("breakthrough");
  const helpers = { builder, localBox, ellipsoid, line, mesh, paint, colors };
  return {
    atmosphere,
    helpers,
    /** Sun direction in map space (x east, y up, z south) and elevation in degrees. */
    setSun(x, y, z, elevation) {
      sun.dir.set(x, y, z).normalize();
      sun.elevation = elevation;
      applyDaylight();
    },
    getLight: () => lightState,
    update() {
      // Headlight and lit windows follow the light: off in daylight, on from dusk.
      shared.uHeadPower.value = engine.state.state === "ride" ? 1.6 * (1 - lightState.day) : 0;
      shared.uGlow.value = 0.7 - 0.62 * lightState.day;
      aurora.update();
    },
  };
}
