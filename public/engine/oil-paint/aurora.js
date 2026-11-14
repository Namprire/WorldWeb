import { createShared, COMMON } from "./reference/common.js";
import { NIGHT } from "./reference/paint.js";
import { createSky } from "./reference/sky.js";
import { Vector3, Vector4 } from "./reference/three.js";

// The reference's sky runs inside the existing scene and its frame loop.
// Only the apparent sky distance is shortened to fit WEBWORLD's camera far plane.
export function installAurora(engine, atlas) {
  const shared = createShared();
  shared.tBrush.value = atlas;
  shared.uSunDir.value.set(-.44,.5,-.75).normalize();
  shared.uHaze.value.setRGB(.016,.041,.063);
  shared.uHazeSun.value.setRGB(.035,.08,.11);
  shared.uHazeGlow.value.setRGB(.02,.025,.04);
  shared.uGlow = { value: new Vector3(1,0,0) };
  shared.uWarm = { value: [new Vector4(),new Vector4(),new Vector4()] };
  shared.uRoom = { value: new Vector4(0,0,-1,-1) };
  engine.shared.uMoonDir.value.copy(shared.uSunDir.value);
  // Preserve the engine's fullscreen projection and camera updates.
  Object.assign(engine.sky.material.uniforms, shared);
  engine.sky.material.fragmentShader = `
    ${COMMON}
    ${NIGHT}
    varying vec3 vDir;
    void main() { gl_FragColor = vec4(nightSky(normalize(vDir)),1.); }
  `;
  engine.sky.material.depthTest = false;
  engine.sky.mesh.renderOrder = -100;
  engine.sky.material.needsUpdate = true;
  const sky = createSky(shared);
  sky.group.name = "Patch / original painted northern lights";
  engine.scene.add(sky.group);
  // This frame has no MSAA target, so use a stable alpha cutout on opaque dabs.
  // Additive rays remain in the sky's fixed draw order, before city geometry.
  sky.group.traverse((object) => {
    if (!object.material) return;
    object.material.alphaToCoverage = false;
  });
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let gain = 1, darkness = 1;
  return {
    setMood(mode) { gain = mode === "emergency" ? .78 : mode === "market" ? .9 : 1.12; },
    /** 1 in full darkness, 0 in daylight: the aurora and stars only show when the sky is dark. */
    setDarkness(value) {
      darkness = value;
      sky.group.visible = value > 0.02;
      engine.sky.mesh.visible = value > 0.02;
    },
    update() {
      shared.uTime.value = reduced.matches ? 48 : engine.state.time + 48;
      shared.uPixel.value = engine.shared.uPixel.value;
      shared.uGlow.value.x = darkness * gain * (reduced.matches ? 1 : .94 + .09*Math.sin(shared.uTime.value*.13));
    },
  };
}
