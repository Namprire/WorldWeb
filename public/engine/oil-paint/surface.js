/* Patch oil-paint adaptation. See NOTICE.md and LICENSE beside this file.
   Uses the existing engine's UVs, animated vertices, lighting and depth pipeline. */
import { createBrushSheet } from "./brush.js";

const atlasGLSL = /* glsl */ `
uniform sampler2D tOilBrush;
uniform float uAutumn;
uniform sampler2D tCanopyShade;
uniform vec4 uCanopyBounds;
// Each mark has a permanent place on its object's surface. No time or screen
// coordinates enter the pattern, so turning the camera never repaints an object.
vec2 oilUV(vec2 q, float cell) {
  return (vec2(mod(cell, 4.0), floor(cell / 4.0)) + clamp(q, .005, .995)) / vec2(4., 2.);
}
vec4 oilMark(vec2 p, vec2 size, float seed, out vec2 grad, out float pigment) {
  vec2 q = p / size;
  float row = floor(q.y);
  q.x += hash11(row * 1.37 + seed * 17.) * 19.;
  vec2 cell = floor(q), f = fract(q);
  float id = hash21(cell + seed * 7.13);
  float id2 = hash21(cell * 1.7 + 3.1 + seed * 3.7);
  vec2 uv = oilUV(vec2(f.y, f.x), floor(id2 * 7.999));
  // Explicit derivatives ignore the discontinuity between adjacent atlas cells.
  vec2 dx = dFdx(p.yx / size.yx) / vec2(4., 2.);
  vec2 dy = dFdy(p.yx / size.yx) / vec2(4., 2.);
  vec3 mark = textureGrad(tOilBrush, uv, dx, dy).rgb;
  vec2 e = vec2(1.5 / 512., 0.);
  float hu = textureGrad(tOilBrush, uv + e.xy, dx, dy).r - textureGrad(tOilBrush, uv - e.xy, dx, dy).r;
  float hv = textureGrad(tOilBrush, uv + e.yx, dx, dy).r - textureGrad(tOilBrush, uv - e.yx, dx, dy).r;
  grad = vec2(hv, hu);
  pigment = mark.b;
  return vec4(id, id2, mark.g, mark.r);
}
`;

const dabGLSL = /* glsl */ `
Dab dab(vec2 p, vec2 size, float seed) {
  vec2 q = p / size;
  float row = floor(q.y);
  float ro = hash11(row * 1.37 + seed * 17.) * 19.;
  q.x += ro;
  vec2 cell = floor(q), f = fract(q), gradient;
  float pigment;
  vec4 mark = oilMark(p, size, seed, gradient, pigment);
  Dab d;
  d.id = mark.x; d.id2 = mark.y;
  d.mask = smoothstep(.08, .65, mark.z);
  d.across = gradient.y * 3.5;
  d.along = .5 + gradient.x * 3.5;
  d.center = vec2((cell.x + .5 - ro) * size.x, (row + .5) * size.y);
  d.pigment = pigment;
  d.thickness = mark.w;
  return d;
}
`;

// This factory is installed once before the scene is assembled. Every caller
// (including new mission actors) receives the same atlas and material treatment.
export function installOilPaint(engine) {
  engine.shared.uAutumn = { value: 0 };
  engine.shared.uPaintTime = { value: 0 };
  engine.shared.tCanopyShade = { value: null };
  engine.shared.uCanopyBounds = { value: [0,0,1,1] };
  const atlas = createBrushSheet(engine.Texture);
  const original = engine.paintMaterial;
  let materialCount = 0;
  engine.paintMaterial = () => {
    const material = original();
    material.name = "WEBWORLD / Patch oil paint";
    material.uniforms.tOilBrush = { value: atlas };
    material.uniforms.uAutumn = engine.shared.uAutumn;
    material.uniforms.tCanopyShade = engine.shared.tCanopyShade;
    material.uniforms.uCanopyBounds = engine.shared.uCanopyBounds;
    let shader = material.fragmentShader;
    shader = shader.replace("struct Dab {", `${atlasGLSL}\nstruct Dab {\n  float pigment;\n  float thickness;`);
    shader = shader.replace(/Dab dab\(vec2 p, vec2 size, float seed\) \{[\s\S]*?\n\}/, dabGLSL);
    // Fixed world-size levels fade only at their coverage boundaries. Keep
    // distant roofs/roads legible instead of growing metre-wide polka dots.
    shader = shader.replace("float lod = log2(max(vDist / uStrokeDist, 0.5));", `
      size *= kind == 14.0 ? 1.5 : 2.0;
      float lod = clamp(log2(max(vDist / uStrokeDist, .5)), -1., 2.5);`);
    shader = shader.replace("vec3 under = mix(hueShift(base, -0.25) * 0.60, base * 0.94, soft) * dPix;",
      `vec3 under = base * dPix * .89;`);
    // A stable shadow glaze anchors the trees without another scene render.
    shader = shader.replace("col += (1.0 - alpha) * under;", `
      col += (1.0 - alpha) * under;
      if (uAutumn > .5 && vWorld.y < .2 && N.y > .5) {
        vec2 shadeUv = (vWorld.xz-uCanopyBounds.xy)/uCanopyBounds.zw;
        float canopy = texture2D(tCanopyShade,vec2(shadeUv.x,1.-shadeUv.y)).r;
        col *= mix(vec3(.50,.46,.60),vec3(1.),canopy);
      }`);
    shader = shader.replace("float furrow = sin(d.across * 7.0 + d.id * 40.0);", "float furrow = 0.0;");
    // Autumn earth uses the reference's ochre / sienna / plum pigment family.
    // Windows, roads, roofs and landmarks keep their semantic materials.
    shader = shader.replace("float lod = clamp(log2", `
      if (uAutumn > .5 && gIndoor < .5) {
        if (kind == 5. || kind == 13.) {
          float earthMix = vnoise(vWorld.xz * .065);
          base = mix(vec3(.23,.14,.13),vec3(.48,.30,.10),earthMix);
          base = mix(base,vec3(.30,.34,.15),smoothstep(.62,.84,earthMix)*.6);
          accentCol = vec3(.82,.53,.13); accent = .28;
        }
        gloss *= .5;
      }
      float lod = clamp(log2`);
    // Helsinki's ordinary facades have pale window surrounds and blue-grey
    // daylight glass, rather than the night village's coloured shutters.
    shader = shader.replace("base = mix(base, shCol, sh * step(hash11(seed * 7.0), 0.75));",
      "base = mix(base, base * .82, sh * .18);");
    shader = shader.replace("base = mix(base, vec3(0.012, 0.020, 0.050), inside);",
      "base = mix(base, mix(vec3(.075,.13,.17),vec3(.24,.33,.37),f.y) * (.85 + .3*r3), inside);");
    // Quiet the old violet night accents on paving and grass.
    shader = shader.replace("if (d.id2 < accent) a = mix(a, accentCol, 0.65);",
      "if (d.id2 < accent) a = mix(a, accentCol, .22);");
    // Three pigment mixes: warm light, native midtone and cool shade. This
    // retains the existing semantic facade/window/roof colours and lamp cues.
    shader = shader.replace("vec3 a = base * (1.0 + (d.id - 0.5) * valVar);", `
      float sunTone = dot(N, uMoonDir) * .5 + .5;
      vec3 shadeMix = base * vec3(.72, .80, .98) + vec3(.018, .012, .025);
      vec3 lightMix = base * vec3(1.08, 1.04, .91) + vec3(.025, .018, .005);
      vec3 a = sunTone < .48 ? mix(shadeMix, base, smoothstep(.1,.48,sunTone))
                             : mix(base, lightMix, smoothstep(.48,.95,sunTone));
      a *= 1.0 + (d.id - .5) * valVar * .65;`);
    shader = shader.replace("vec3 c = a * L * (0.88 + 0.22 * bristle) + sDab * gloss * (0.35 + 0.9 * d.id) * (0.35 + a * 2.2);", `
      vec3 loaded = mix(a, a * vec3(1.15,1.10,1.02), smoothstep(.52,.78,d.pigment));
      float rake = .5 * d.across - .7 * (d.along - .5);
      vec3 c = loaded * L * mix(.95,1.04,d.thickness) * (1. + rake * .65);
      c += vec3(1.,.97,.9) * pow(max(rake,0.),2.) * .18;
      c += sDab * gloss * .12;`);
    shader = shader.replace("(r * rim * 0.9)", "(r * rim * 0.28)");
    material.fragmentShader = shader;
    materialCount++;
    return material;
  };

  // Keep the game's bloom, depth, entry dissolve and reduced-motion handling.
  // Only replace the finish with the reference's subtle, stationary linen.
  const post = engine.post.composite;
  post.fragmentShader = post.fragmentShader.replace("void main() {", `
    float oilWeave(vec2 p) {
      vec2 q = p / 2.6;
      float n = vnoise(p / 310.);
      return sin(q.x * 3.14159) * sin(q.y * 3.14159 + floor(q.x) * 3.14159) * (.3 + 1.4*n*n);
    }
    void main() {`)
    .replace("col *= 1.0 + tooth * 0.045;", `
      float weave = oilWeave(gl_FragCoord.xy);
      float wx = oilWeave(gl_FragCoord.xy + vec2(1.,0.)) - weave;
      float wy = oilWeave(gl_FragCoord.xy + vec2(0.,1.)) - weave;
      col *= 1. + (.6*wx - .8*wy)*.022 + weave*.006;`)
    .replace("hash21(gl_FragCoord.xy + fract(uTime) * 61.0)", "hash21(gl_FragCoord.xy)");
  post.needsUpdate = true;
  return {
    atlas,
    atlasGLSL,
    getStats: () => ({ style: "patch-oil-paint", materials: materialCount, brushMarks: 8 }),
  };
}
