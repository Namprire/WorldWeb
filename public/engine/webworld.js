import { installCitizens } from "./helsinki-citizens.js";
/* Startup City scene adapter. Uses the original renderer, terrain and frame loop. */
import { installHelsinki } from "./helsinki.js";
import { installHelsinkiMap } from "./helsinki-real-map.js";
import { installStudent } from "./student-scooter.js";
import { installOilPaint } from "./oil-paint/surface.js";
import {
  mapData,
  districtProbe,
  collisionBuildings,
  inPolygon,
} from "./helsinki-geography.js";

export function installWebworld(engine) {
  const oilPaint = installOilPaint(engine);
  const visuals = installHelsinki(engine, oilPaint);
  const district = installHelsinkiMap(engine, visuals.helpers, oilPaint.atlas);
  const citizens = installCitizens(engine, visuals.helpers);
  const updateStudent = installStudent(engine, visuals.helpers);
  const subscribers = new Set();
  const frameCallbacks = new Set();
  visuals.atmosphere("breakthrough");

  function snapshot() {
    const p = engine.player;
    return {
      state: engine.state.state,
      presentation: "helsinki-aurora",
      district: district.name,
      buildings: district.buildings.length,
      pedestrians: citizens.count,
      vehicle: "student-scooter",
      camera: {
        x: engine.camera.position.x,
        y: engine.camera.position.y,
        z: engine.camera.position.z,
        fov: engine.camera.fov,
      },
      gx: p.gx,
      gz: p.gz,
      y: p.y,
      heading: p.heading,
      speed: p.speed,
      walking: p.walking,
      flying: p.flying,
      drawCalls: engine.renderer.info.render.calls,
    };
  }
  let lastNotify = 0;
  engine.state.director = (dt) => {
    const t = engine.state.time;
    visuals.update();
    engine.hideLegacyMapDecorations();
    // Scene extensions run first so the map culls against the final camera.
    for (const fn of frameCallbacks) fn(dt, t);
    district.update();
    citizens.update(dt);
    updateStudent(dt);
    if (t - lastNotify > 0.1) {
      lastNotify = t;
      const s = snapshot();
      for (const fn of subscribers) fn(s);
    }
  };
  window.__webworldEngine = {
    engine,
    district,
    visuals,
    geography: { mapData, districtProbe, collisionBuildings, inPolygon },
    getGraphics: oilPaint.getStats,
    getSnapshot: snapshot,
    subscribe(callback) {
      subscribers.add(callback);
      return () => subscribers.delete(callback);
    },
    /** Runs every rendered frame, after the engine has posed its own camera. */
    onFrame(callback) {
      frameCallbacks.add(callback);
      return () => frameCallbacks.delete(callback);
    },
  };
  window.dispatchEvent(new Event("webworld-ready"));
}
