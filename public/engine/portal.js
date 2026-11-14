/* A framed view of the actual painted 3D city, continuous with the camera dive.
   The underlying riding/chase camera and original camera dive remain unchanged. */
export const reducedPortalMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = (a, b, x) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
let elements;
export function updatePortal(state, compositor) {
  if (!elements) {
    const gallery = document.getElementById("gallery");
    elements = {
      gallery,
      wall: document.getElementById("wall"),
      frame: document.getElementById("frame"),
      lip: document.getElementById("frame-lip"),
      shadow: document.getElementById("frame-shadow"),
    };
  }
  const { gallery, wall, frame, lip, shadow } = elements;
  const active = ["title", "dive", "rise"].includes(state.state);
  const t = state.state === "title" ? 0 : state.diveT;
  const progress = active ? ease(0, 3.4, t) : 1;
  const { W, H, hole } = state.view;
  // Enough overscan to leave no gallery wall at any aspect ratio, including phones.
  const cover = Math.max(W / hole.w, H / hole.h) * 1.16;
  const scale = 1 + (cover - 1) * progress;
  const dx = (W / 2 - hole.cx) * progress;
  const dy = (H / 2 - hole.cy) * progress;
  // The framed painting IS the rendered city. No unrelated image overlays the scene.
  // Keep the compositor aperture at the base rectangle; its photo branch stays disabled.
  compositor.uniforms.uHole.value.set(
    (hole.cx - hole.w / 2) / W,
    1 - (hole.cy + hole.h / 2) / H,
    (hole.cx + hole.w / 2) / W,
    1 - (hole.cy - hole.h / 2) / H,
  );
  state.titleMix = 0;
  gallery.dataset.presentation = "live-scene";
  gallery.classList.toggle("gone", !active || t >= 4);
  gallery.classList.toggle("leaving", state.state !== "title");
  gallery.inert = state.state !== "title";
  gallery.dataset.portalProgress = progress.toFixed(4);
  gallery.dataset.paintingMix = state.titleMix.toFixed(4);
  const transform = `translate(${dx}px,${dy}px) scale(${scale})`;
  wall.style.transformOrigin = `${hole.cx}px ${hole.cy}px`;
  for (const part of [wall, frame, lip, shadow])
    part.style.transform = transform;
  // Keep the frame fully present as it passes the viewport; only the plaque fades.
  if (state.state === "title") {
    const enter = document.getElementById("enter");
    if (gallery.dataset.wasEntering === "true")
      enter.focus({ preventScroll: true });
    gallery.dataset.wasEntering = "false";
  } else gallery.dataset.wasEntering = "true";
}
