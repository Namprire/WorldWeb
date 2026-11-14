/* Presentation only. Never moves the player or changes geographic geometry. */
export const ENVIRONMENTS = {
  aurora: {
    label: "Northern lights", fog: [.018,.055,.075], fogRange: [240,850],
    sun: [.17,.26,.35], ambient: [.075,.13,.20], bounce: [.025,.045,.065],
    exposure: .72, glow: .7, vignette: .21,
  },
  autumn: {
    label: "Autumn wood", fog: [.49,.46,.40], fogRange: [110,650],
    sun: [1.05,.82,.48], ambient: [.28,.32,.42], bounce: [.17,.10,.14],
    exposure: .82, glow: .025, vignette: .13,
  },
};
export function initialEnvironment() {
  const requested = new URLSearchParams(location.search).get("environment");
  if (Object.hasOwn(ENVIRONMENTS, requested)) return requested;
  try {
    const saved = localStorage.getItem("webworld-environment-v1");
    if (Object.hasOwn(ENVIRONMENTS, saved)) return saved;
  } catch {}
  return "autumn";
}
export function applyEnvironment(engine, mode) {
  if (!Object.hasOwn(ENVIRONMENTS, mode)) return false;
  const preset = ENVIRONMENTS[mode];
  engine.shared.uAutumn.value = mode === "autumn" ? 1 : 0;
  engine.shared.uFogColor.value.setRGB(...preset.fog);
  engine.shared.uMoonCol.value.setRGB(...preset.sun);
  engine.shared.uAmbSky.value.setRGB(...preset.ambient);
  engine.shared.uAmbGround.value.setRGB(...preset.bounce);
  engine.shared.uGlow.value = preset.glow;
  engine.shared.uWarmCol.value.setRGB(1,.66,.28);
  engine.post.composite.uniforms.uExposure.value = preset.exposure;
  engine.post.composite.uniforms.uVignette.value = preset.vignette;
  engine.state.titleStillReady = false;
  document.documentElement.dataset.environment = mode;
  try { localStorage.setItem("webworld-environment-v1",mode); } catch {}
  return true;
}
