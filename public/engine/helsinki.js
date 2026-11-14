/* Moonlit Helsinki materials; the geographic layout stays in helsinki-real-map.js. */
import { installAurora } from "./oil-paint/aurora.js";
import { ENVIRONMENTS, initialEnvironment, applyEnvironment } from "./oil-paint/environment.js";
export const helsinkiSurfacePalette = `
  // Helsinki plaster, oxidised copper and pale granite, under the original paint strokes.
  if (gIndoor < 0.5) {
    if (kind == 1.0) {
      vec3 plaster = seed < .30 ? vec3(.78,.61,.34) : seed < .60 ? vec3(.70,.43,.34) : vec3(.80,.74,.57);
      base = mix(base, plaster, .88);
    } else if (kind == 2.0) {
      vec3 roof = seed < .24 ? vec3(.18,.23,.26) : seed < .43 ? vec3(.32,.20,.14) : vec3(.12,.28,.25);
      base = mix(base,roof,.88);
    }
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
    shared.uFogColor.value.setRGB(...t.fog);
    shared.uMoonCol.value.setRGB(...t.sun);
    shared.uWarmCol.value.setRGB(...t.warm);
    aurora.setMood(mode);
  }
  atmosphere("breakthrough");
  let environment = initialEnvironment();
  function setEnvironment(mode) {
    if (!applyEnvironment(engine, mode)) return false;
    environment = mode;
    aurora.setEnvironment(mode);
    return true;
  }
  setEnvironment(environment);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const helpers = { builder, localBox, ellipsoid, line, mesh, paint, colors };
  return {
    atmosphere,
    setEnvironment,
    getEnvironment: () => environment,
    getFogRange: () => ENVIRONMENTS[environment].fogRange,
    helpers,
    update() {
      shared.uPaintTime.value = reduced.matches ? 0 : engine.state.time;
      // The legacy score lighting resets on entry; the selected painting owns it.
      shared.uGlow.value = ENVIRONMENTS[environment].glow;
      shared.uHeadPower.value = engine.state.state === "ride" && environment === "aurora" ? 1.6 : 0;
      aurora.update();
    },
  };
}
