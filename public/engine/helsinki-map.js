import { neighbourhoodBuildings } from "./helsinki-neighbourhoods.js";
import { buildHelsinkiLandmark, buildHarbour } from "./helsinki-landmarks.js";
/* A compressed, hand-authored Helsinki district. Metres are gameplay coordinates,
   not surveyed geography. Rendering and collision share the same building records. */
export const districtBounds = {
  west: -420,
  east: 220,
  north: -380,
  south: 380,
};
export const districtBuildings = [
  ...neighbourhoodBuildings,
  ...[
    [-175, -105],
    [-175, -60],
    [-175, -15],
    [-125, -65],
    [-125, -20],
    [-65, -170],
    [-25, -170],
    [20, -170],
    [80, -115],
    [50, -120],
  ].map(([x, z], i) => ({
    x,
    z,
    w: 22,
    d: 24,
    h: 13 + (i % 4) * 3,
    shop: i % 3 === 0 ? "local" : undefined,
  })),
  ...[
    [-65, 90],
    [-25, 90],
    [75, 90],
  ].map(([x, z], i) => ({ x, z, w: 18, d: 18, h: 12 + i * 3 })),
  { x: 150, z: -90, w: 34, d: 26, h: 18, landmark: "cathedral" },
  { x: -130, z: -120, w: 58, d: 25, h: 12, landmark: "library" },
  { x: 155, z: 155, w: 24, d: 52, h: 10, landmark: "market" },
  ...[-175, -130, 125].flatMap((x, i) =>
    [35, 85].map((z, j) => ({ x, z, w: 26, d: 25, h: 13 + ((i + j) % 3) * 3 })),
  ),
  ...[-170, -115, -55, 30, 80].map((x, i) => ({
    x,
    z: 180,
    w: 28,
    d: 24,
    h: 13 + (i % 3) * 3,
  })),
  ...[-170, -105, 75, 135].map((x, i) => ({
    x,
    z: -170,
    w: 30,
    d: 23,
    h: 12 + (i % 3) * 4,
  })),
  { x: 0, z: -91, w: 56, d: 18, h: 13, station: true },
  { x: -36, z: -91, w: 12, d: 16, h: 30, tower: true },
  ...[-54, -22, 32, 65].map((z, i) => ({
    x: -45,
    z,
    w: 23,
    d: 22,
    h: 12 + (i % 2) * 3,
  })),
  { x: 45, z: 34, w: 23, d: 24, h: 14 },
  { x: 45, z: 66, w: 23, d: 23, h: 17 },
  { x: -76, z: -17, w: 20, d: 22, h: 10, shop: "grocery" },
  { x: 76, z: -17, w: 20, d: 22, h: 10, shop: "cafe" },
];
export function districtProbe(x, z, y, radius = 0, out = {}) {
  Object.assign(out, {
    floor: 0,
    ceil: Infinity,
    blocked: false,
    roof: false,
    hall: null,
  });
  for (const b of districtBuildings) {
    if (
      Math.abs(x - b.x) < b.w / 2 + radius &&
      Math.abs(z - b.z) < b.d / 2 + radius
    ) {
      if (y >= b.h - 0.35) {
        out.floor = Math.max(out.floor, b.h);
        out.roof = true;
      } else out.blocked = true;
    }
  }
  // Low perimeter walls bound riding, while flight can pass over them.
  if (
    (x < districtBounds.west + radius ||
      x > districtBounds.east - radius ||
      z > districtBounds.south - radius ||
      z < districtBounds.north + radius) &&
    y < 1.5
  )
    out.blocked = true;
  return out;
}
export function installHelsinkiMap(engine, helpers) {
  const { builder, localBox: box, ellipsoid, line, mesh, colors: c } = helpers;
  engine.legacyWorld.group.visible = false;
  engine.legacyWorld.retarget =
    engine.legacyWorld.work =
    engine.legacyWorld.cull =
      () => {};
  engine.ground = () => 0;
  engine.player.groundAt = () => 0;
  engine.player.probe = districtProbe;
  engine.player.shut = (x, z, r) =>
    districtProbe(x, z, engine.player.y, r).blocked;
  engine.player.centreInLane = () => {}; // Old village lane snapping does not describe this square.
  engine.player.y = 0;
  engine.setMapProbe(districtProbe, (ctx) => {
    function rect(x, z, w, d, color) {
      ctx.fillStyle = color;
      ctx.beginPath();
      [
        [x - w / 2, z - d / 2],
        [x + w / 2, z - d / 2],
        [x + w / 2, z + d / 2],
        [x - w / 2, z + d / 2],
      ].forEach(([gx, gz], i) =>
        ctx[i ? "lineTo" : "moveTo"](
          engine.worldX(gx, gz),
          engine.worldZ(gx, gz),
        ),
      );
      ctx.closePath();
      ctx.fill();
    }
    rect(-100, 0, 640, 760, "#d2c9ac");
    rect(280, 0, 120, 760, "#458ca0");
    rect(5, 130, 300, 36, "#809459");
    for (const x of [-200, -90, 100, 205]) rect(x, 10, 12, 420, "#777f77");
    for (const z of [-145, 4, 110]) rect(0, z, 440, 12, "#777f77");
    rect(48, -49, 57, 62, "#809459");
    rect(0, 34, 18, 128, "#777f77");
    rect(0, 4, 207, 14, "#777f77");
    for (const x of [-360, -300, -240]) rect(x, 0, 12, 760, "#777f77");
    for (const z of [-320, -260, -200, 220, 280, 340])
      rect(-100, z, 640, 12, "#777f77");
    for (const b of districtBuildings)
      rect(b.x, b.z, b.w, b.d, b.station || b.tower ? "#805d44" : "#af8e68");
  });
  const root = new engine.Group();
  root.name = "Helsinki · station district";
  engine.scene.add(root);
  // Build in logical coordinates and transform every vertex, including long pavement strips.
  function finish(b) {
    const m = mesh(b, root),
      p = m.geometry.attributes.position;
    m.geometry.computeBoundingBox();
    const bounds = m.geometry.boundingBox;
    const cx = (bounds.min.x + bounds.max.x) / 2,
      cz = (bounds.min.z + bounds.max.z) / 2;
    m.userData.mapRange = {
      x: cx,
      z: cz,
      r: Math.hypot(bounds.max.x - cx, bounds.max.z - cz),
    };
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j),
        z = p.getZ(j);
      p.setXYZ(j, engine.worldX(x, z), p.getY(j), engine.worldZ(x, z));
    }
    p.needsUpdate = true;
    m.geometry.computeVertexNormals();
    m.geometry.computeBoundingSphere();
    return m;
  }
  function surface(x, z, w, d, color, kind, y = -0.035) {
    let b = builder();
    for (let xx = x - w / 2; xx < x + w / 2; xx += 4)
      for (let zz = z - d / 2; zz < z + d / 2; zz += 4) {
        if (b.nv > 22000) {
          finish(b);
          b = builder();
        }
        box(
          b,
          xx + Math.min(4, x + w / 2 - xx) / 2,
          y,
          zz + Math.min(4, z + d / 2 - zz) / 2,
          Math.min(4, x + w / 2 - xx),
          0.03,
          Math.min(4, z + d / 2 - zz),
          color,
          kind,
        );
      }
    finish(b);
  }
  surface(-100, 0, 640, 760, [0.36, 0.43, 0.28], engine.kinds.GRASS, -0.12);
  surface(-100, 0, 640, 760, [0.49, 0.48, 0.43], engine.kinds.COBBLE);
  surface(48, -49, 57, 62, [0.31, 0.43, 0.18], engine.kinds.GRASS, 0.005);
  surface(0, 34, 18, 128, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.012);
  surface(0, 4, 207, 14, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.015);
  surface(0, -51, 62, 55, [0.64, 0.61, 0.51], engine.kinds.PAVING, 0.018);
  surface(48, -49, 8, 62, [0.65, 0.59, 0.43], engine.kinds.PAVING, 0.04);
  surface(48, -49, 57, 7, [0.65, 0.59, 0.43], engine.kinds.PAVING, 0.04);
  surface(290, 0, 140, 800, [0.12, 0.38, 0.46], engine.kinds.WATER, -0.25);
  for (const x of [-200, -90, 100, 205])
    surface(x, 10, 12, 420, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.018);
  for (const z of [-145, 4, 110])
    surface(0, z, 440, 12, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.02);
  surface(5, 140, 300, 38, [0.31, 0.43, 0.18], engine.kinds.GRASS, 0.025);
  surface(5, 140, 300, 8, [0.64, 0.6, 0.47], engine.kinds.PAVING, 0.06);
  surface(150, -56, 66, 35, [0.67, 0.65, 0.55], engine.kinds.PAVING, 0.03);
  surface(182, 65, 34, 66, [0.64, 0.6, 0.47], engine.kinds.PAVING, 0.03);
  for (const x of [-360, -300, -240])
    surface(x, 0, 12, 760, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.025);
  for (const z of [-320, -260, -200, 220, 280, 340])
    surface(-100, z, 640, 12, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.025);
  for (const x of [-180, -120, -60, 0, 60, 120, 180])
    for (const [z, d] of [
      [-290, 180],
      [300, 160],
    ])
      surface(x, z, 12, d, [0.23, 0.26, 0.25], engine.kinds.ROAD, 0.026);
  for (const b of districtBuildings) {
    const g = builder(),
      wall =
        b.station || b.tower
          ? [0.59, 0.43, 0.32]
          : b.shop
            ? [0.75, 0.64, 0.41]
            : [0.78, 0.65, 0.48];
    if (b.landmark) {
      buildHelsinkiLandmark(b, g, {
        box,
        ellipsoid,
        line,
        c,
        kinds: engine.kinds,
      });
      finish(g);
      continue;
    }
    box(g, b.x, 0, b.z, b.w, b.h, b.d, wall, engine.kinds.WALL);
    box(
      g,
      b.x,
      b.h,
      b.z,
      b.w + 0.5,
      0.48,
      b.d + 0.5,
      c.copper,
      engine.kinds.ROOF,
    );
    for (const y of [1, b.h - 1])
      box(g, b.x, y, b.z, b.w + 0.18, 0.3, b.d + 0.18, c.cream);
    for (let y = 3; y < b.h - 2; y += 3.2)
      for (let x = b.x - b.w / 2 + 2; x < b.x + b.w / 2 - 1; x += 3.3)
        for (const side of [-1, 1]) {
          box(g, x, y, b.z + side * (b.d / 2 + 0.04), 1.55, 2, 0.08, c.cream);
          box(
            g,
            x,
            y + 0.15,
            b.z + side * (b.d / 2 + 0.1),
            1.25,
            1.65,
            0.08,
            [0.13, 0.26, 0.27],
          );
          box(
            g,
            x,
            y + 0.15,
            b.z + side * (b.d / 2 + 0.16),
            0.07,
            1.65,
            0.06,
            c.cream,
          );
        }
    // Side windows matter at street level, not just in the entrance view.
    for (let y = 3; y < b.h - 2; y += 3.2)
      for (let z = b.z - b.d / 2 + 2; z < b.z + b.d / 2 - 1; z += 3.3)
        for (const side of [-1, 1]) {
          box(g, b.x + side * (b.w / 2 + 0.04), y, z, 0.08, 2, 1.55, c.cream);
          box(
            g,
            b.x + side * (b.w / 2 + 0.1),
            y + 0.15,
            z,
            0.08,
            1.65,
            1.25,
            [0.13, 0.26, 0.27],
          );
        }
    if (b.station) {
      box(g, 0, 0, -81.8, 18, 9, 0.3, c.copper);
      for (let x = -7; x <= 7; x += 3.5)
        box(g, x, 0.3, -81.5, 2.4, 7, 0.3, [0.09, 0.18, 0.18]);
      ellipsoid(g, 0, 10, -81.6, 8, 3, 0.25, c.cream, engine.kinds.STONE);
      ellipsoid(
        g,
        0,
        10,
        -81.2,
        6.8,
        2.3,
        0.1,
        [0.14, 0.27, 0.28],
        engine.kinds.PLAIN,
      );
      for (const x of [-13, 13]) {
        box(g, x, 0, -79, 1.4, 5, 1.4, wall);
        ellipsoid(g, x, 5.4, -79, 0.8, 0.8, 0.8, c.cream);
      }
    }
    if (b.tower) {
      box(g, b.x, b.h, b.z, 9, 3, 12, c.copper, engine.kinds.ROOF);
      ellipsoid(
        g,
        b.x,
        25,
        b.z + b.d / 2 + 0.2,
        2.6,
        2.6,
        0.15,
        c.cream,
        engine.kinds.PLAIN,
      );
      line(g, [b.x, 25, -82.5], [b.x, 26.9, -82.5], 0.15, c.ink);
      line(g, [b.x, 25, -82.5], [b.x + 1.3, 24.3, -82.5], 0.15, c.ink);
    }
    if (b.shop) {
      for (let i = -4; i <= 4; i++)
        box(
          g,
          b.x + i * 0.8,
          3.4,
          b.z + b.d / 2 + 0.8,
          0.8,
          0.2,
          2,
          i % 2 ? c.cream : c.copper,
          engine.kinds.CLOTH,
        );
      box(g, b.x, 0, b.z + b.d / 2 + 0.12, 3, 3.2, 0.15, c.copper);
    }
    finish(g);
  }
  // Park birches, street trees and benches leave both cross streets clear.
  for (const [x, z] of [
    [26, -72],
    [68, -72],
    [26, -28],
    [68, -28],
    [27, -58],
    [68, -58],
    [27, -40],
    [68, -40],
    [-24, 24],
    [-24, 55],
    [24, 24],
    [24, 55],
    [-24, -45],
    ...Array.from({ length: 13 }, (_, i) => [-140 + i * 23, 125]),
    ...Array.from({ length: 13 }, (_, i) => [-140 + i * 23, 155]),
    ...Array.from({ length: 9 }, (_, i) => [215, -160 + i * 42]),
    ...Array.from({ length: 6 }, (_, i) => [-210, -155 + i * 55]),
  ]) {
    const b = builder();
    line(b, [x, 0, z], [x, 7, z], 0.22, c.bark);
    for (let j = 0; j < 7; j++)
      box(b, x, 1 + j * 0.7, z, 0.24, 0.13, 0.24, c.ink);
    for (let j = 0; j < 6; j++) {
      const a = j * 2.4;
      ellipsoid(
        b,
        x + Math.cos(a) * 1.2,
        6 + (j % 3) * 0.6,
        z + Math.sin(a) * 1.2,
        1.8,
        1.8,
        1.5,
        j % 2 ? c.leaf : c.green,
        engine.kinds.LEAF,
      );
    }
    box(b, x + 3, 0.6, z, 2.8, 0.2, 0.75, c.wood);
    for (const s of [-1, 1]) box(b, x + 3 + s, 0.1, z, 0.12, 0.6, 0.6, c.ink);
    finish(b);
  }
  const props = builder();
  for (let z = -78; z < 90; z += 3)
    for (const x of [13, 14.5]) box(props, x, 0.05, z, 0.07, 0.035, 3, c.ink);
  // Parked green tram and a readable platform; kept outside the main scooter route.
  box(props, 13.75, 0.4, -20, 2.5, 1.3, 10, c.copper);
  box(props, 13.75, 1.7, -20, 2.5, 1.1, 10, c.cream);
  for (let z = -24; z <= -16; z += 1.6)
    for (const x of [12.48, 15.02])
      box(props, x, 1.85, z, 0.04, 0.8, 1.2, [0.12, 0.25, 0.26]);
  box(props, 13.75, 2.8, -20, 2.7, 0.18, 10.2, c.copper);
  for (let z = 22; z < 80; z += 13)
    box(props, 0, 0.06, z, 0.16, 0.015, 3, c.cream);
  // The old district walls are gone; the outer quay is the new riding boundary.
  for (let z = districtBounds.north; z < districtBounds.south; z += 4)
    for (const x of [districtBounds.west - 1, districtBounds.east + 1])
      box(props, x, 0, z, 2, 1.5, 4, c.cream, engine.kinds.STONE);
  for (let x = districtBounds.west; x < districtBounds.east; x += 4)
    for (const z of [districtBounds.north - 1, districtBounds.south + 1])
      box(props, x, 0, z, 4, 1.5, 2, c.cream, engine.kinds.STONE);
  finish(props);
  buildHarbour({
    builder,
    box,
    ellipsoid,
    line,
    c,
    finish,
    surface,
    kinds: engine.kinds,
  });
  engine.setEntrance(0, 114, 44, -0.28);
  return {
    name: "Greater Helsinki",
    buildings: districtBuildings,
    update() {
      for (const m of root.children) {
        const r = m.userData.mapRange;
        if (r)
          m.visible =
            Math.hypot(engine.player.gx - r.x, engine.player.gz - r.z) <
            300 + r.r;
      }
    },
  };
}
