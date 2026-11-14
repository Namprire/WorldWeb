import {
  mapData,
  districtProbe,
  districtBuildings,
  collisionBuildings,
  districtBounds,
} from "./helsinki-geography.js";
import { createFoliagePainter } from "./oil-paint/foliage.js";
export function installHelsinkiMap(engine, helpers, brushAtlas) {
  const { builder, mesh, ellipsoid, line, colors: c } = helpers;
  engine.legacyWorld.group.visible = false;
  engine.legacyWorld.retarget =
    engine.legacyWorld.work =
    engine.legacyWorld.cull =
      () => {};
  engine.useMetricCoordinates();
  engine.ground = engine.player.groundAt = () => 0;
  engine.player.probe = districtProbe;
  engine.player.shut = (x, z, r) =>
    districtProbe(x, z, engine.player.y, r).blocked;
  engine.player.centreInLane = () => {};
  engine.player.y = 0;
  engine.player.syncWorld();
  engine.hills.group.visible = false;
  engine.shared.uFogRange.value.set(240, 850);
  const root = new engine.Group();
  root.name = "Helsinki · OpenStreetMap";
  engine.scene.add(root);
  const groups = [];
  function finish(b, bounds, range = 650) {
    if (!b.nv) return;
    const m = mesh(b, root);
    groups.push({ m, bounds, range });
    return m;
  }
  function tri(b, a, d, e, y) {
    const cross = (d[0] - a[0]) * (e[1] - a[1]) - (d[1] - a[1]) * (e[0] - a[0]);
    if (cross > 0) [d, e] = [e, d];
    b.tri(
      b.pl(a[0], y, a[1]),
      b.pl(d[0], y, d[1]),
      b.pl(e[0], y, e[1]),
      a[0],
      a[1],
      d[0],
      d[1],
      e[0],
      e[1],
    );
  }
  function polygon(b, feature, y, color, kind, seed = 0.43) {
    b.color(color).data(kind, seed, 1, 0);
    const points = feature.rings.flat();
    for (const t of feature.triangles)
      tri(b, points[t[0]], points[t[1]], points[t[2]], y);
  }
  function quad(b, a, d, y, width) {
    const dx = d[0] - a[0],
      dz = d[1] - a[1],
      len = Math.hypot(dx, dz) || 1,
      nx = ((-dz / len) * width) / 2,
      nz = ((dx / len) * width) / 2;
    tri(
      b,
      [a[0] + nx, a[1] + nz],
      [d[0] + nx, d[1] + nz],
      [d[0] - nx, d[1] - nz],
      y,
    );
    tri(
      b,
      [a[0] + nx, a[1] + nz],
      [d[0] - nx, d[1] - nz],
      [a[0] - nx, a[1] - nz],
      y,
    );
  }
  // Ground is level for this prototype; geographic X/Z positions are never warped.
  const b = builder(),
    B = districtBounds;
  b.color([0.5, 0.49, 0.43]).data(engine.kinds.PAVING, 0.4, 1, 0);
  for (let x = B.west; x < B.east; x += 80)
    for (let z = B.north; z < B.south; z += 80) {
      const X = Math.min(B.east, x + 80),
        Z = Math.min(B.south, z + 80);
      tri(b, [x, z], [X, z], [X, Z], -0.05);
      tri(b, [x, z], [X, Z], [x, Z], -0.05);
    }
  finish(b, [B.west, B.north, B.east, B.south], 1e6);
  for (const w of mapData.water) {
    const b = builder();
    polygon(b, w, 0.01, [0.11, 0.34, 0.43], engine.kinds.WATER);
    finish(b, w.bounds);
  }
  // Batch parks and roads by map tile, rather than one draw call per OSM way.
  const batches = new Map();
  function batch(x, z) {
    const key = `${Math.floor(x / 150)},${Math.floor(z / 150)}`;
    if (!batches.has(key))
      batches.set(key, { b: builder(), bounds: [x, z, x, z] });
    const v = batches.get(key);
    v.bounds[0] = Math.min(v.bounds[0], x);
    v.bounds[1] = Math.min(v.bounds[1], z);
    v.bounds[2] = Math.max(v.bounds[2], x);
    v.bounds[3] = Math.max(v.bounds[3], z);
    return v;
  }
  for (const p of mapData.parks) {
    const q = batch(p.bounds[0], p.bounds[1]);
    polygon(q.b, p, 0.03, [0.3, 0.4, 0.18], engine.kinds.GRASS);
    q.bounds[2] = Math.max(q.bounds[2], p.bounds[2]);
    q.bounds[3] = Math.max(q.bounds[3], p.bounds[3]);
  }
  for (const road of mapData.roads) {
    const foot = [
        "footway",
        "path",
        "pedestrian",
        "steps",
        "cycleway",
      ].includes(road.kind),
      tram = road.kind === "tram";
    for (let i = 1; i < road.points.length; i++) {
      const a = road.points[i - 1],
        d = road.points[i],
        q = batch((a[0] + d[0]) / 2, (a[1] + d[1]) / 2);
      q.bounds[0] = Math.min(q.bounds[0], a[0], d[0]);
      q.bounds[1] = Math.min(q.bounds[1], a[1], d[1]);
      q.bounds[2] = Math.max(q.bounds[2], a[0], d[0]);
      q.bounds[3] = Math.max(q.bounds[3], a[1], d[1]);
      q.b
        .color(tram ? c.ink : foot ? [0.62, 0.59, 0.5] : [0.25, 0.28, 0.28])
        .data(
          tram
            ? engine.kinds.PLAIN
            : foot
              ? engine.kinds.PAVING
              : engine.kinds.ROAD,
          0.3,
          1,
          0,
        );
      quad(
        q.b,
        a,
        d,
        tram ? 0.09 : foot ? 0.07 : 0.05,
        tram ? 0.16 : road.width,
      );
    }
  }
  for (const q of batches.values()) finish(q.b, q.bounds);
  for (const building of collisionBuildings) {
    const b = builder(),
      seed = (Number(building.id.split("/")[1]) % 997) / 997;
    const wall =
      building.type === "cathedral"
        ? [0.88, 0.86, 0.76]
        : seed < 0.33
          ? [0.76, 0.65, 0.48]
          : seed < 0.66
            ? [0.63, 0.42, 0.32]
            : [0.73, 0.72, 0.64];
    const bottom = building.minHeight || 0,
      roofH = Math.min(building.roofHeight || 0, building.h - bottom),
      top = building.h - roofH;
    for (const ring of building.rings) {
      let along = 0;
      for (let i = 0; i < ring.length; i++) {
        const a = ring[i],
          d = ring[(i + 1) % ring.length],
          length = Math.hypot(d[0] - a[0], d[1] - a[1]);
        b.color(wall).data(
          building.type === "cathedral"
            ? engine.kinds.PLAIN
            : engine.kinds.WALL,
          seed,
          Math.max(1, (top - bottom) / 3.2),
          .16 + seed * .42,
        );
        b.quad(
          b.pl(d[0], bottom, d[1]),
          b.pl(a[0], bottom, a[1]),
          b.pl(a[0], top, a[1]),
          b.pl(d[0], top, d[1]),
          (along + length) / 3,
          0,
          along / 3,
          (top - bottom) / 3.2,
        );
        along += length;
        if (length > 2)
          line(
            b,
            [a[0], top - 0.2, a[1]],
            [d[0], top - 0.2, d[1]],
            0.13,
            c.cream,
          );
      }
    }
    if (roofH > 0.05 && building.rings.length === 1) {
      const ring = building.rings[0],
        cx = ring.reduce((s, p) => s + p[0], 0) / ring.length,
        cz = ring.reduce((s, p) => s + p[1], 0) / ring.length;
      const rounded = ["dome", "onion", "round"].includes(building.roofShape),
        steps = rounded ? 8 : 1;
      b.color(c.copper).data(engine.kinds.ROOF, seed, 1, 0);
      for (let j = 0; j < steps; j++) {
        const t = j / steps,
          T = (j + 1) / steps,
          r = rounded ? Math.cos((t * Math.PI) / 2) : 1 - t,
          R = rounded ? Math.cos((T * Math.PI) / 2) : 1 - T;
        const y = top + roofH * (rounded ? Math.sin((t * Math.PI) / 2) : t),
          Y = top + roofH * (rounded ? Math.sin((T * Math.PI) / 2) : T);
        for (let i = 0; i < ring.length; i++) {
          const a = ring[i],
            d = ring[(i + 1) % ring.length];
          b.quad(
            b.pl(cx + (a[0] - cx) * r, y, cz + (a[1] - cz) * r),
            b.pl(cx + (a[0] - cx) * R, Y, cz + (a[1] - cz) * R),
            b.pl(cx + (d[0] - cx) * R, Y, cz + (d[1] - cz) * R),
            b.pl(cx + (d[0] - cx) * r, y, cz + (d[1] - cz) * r),
            0,
            j,
            1,
            j + 1,
          );
        }
      }
    } else polygon(b, building, building.h, c.copper, engine.kinds.ROOF, seed);
    finish(b, building.bounds);
  }
  const trees = new Map();
  const foliage = createFoliagePainter(engine, brushAtlas);
  for (let i = 0; i < mapData.trees.length; i++) {
    const [x, z] = mapData.trees[i],
      key = `${Math.floor(x / 100)},${Math.floor(z / 100)}`;
    if (!trees.has(key))
      trees.set(key, {
        b: builder(),
        paint: foliage.batch(),
        bounds: [x - 100, z - 100, x + 100, z + 100],
      });
    const tile = trees.get(key);
    const b = tile.b;
    foliage.tree(tile.paint, x, z, i);
    line(b, [x, 0, z], [x, 5, z], 0.18, c.bark);
    ellipsoid(
      b,
      x,
      5.5,
      z,
      1.65,
      2.1,
      1.65,
      i % 3 ? c.leaf : c.green,
      engine.kinds.LEAF,
    );
  }
  for (const t of trees.values()) {
    finish(t.b, t.bounds, 220);
    const m = foliage.mesh(t.paint);
    root.add(m);
    groups.push({ m, bounds: t.bounds, range: 220 });
  }
  engine.setMapProbe(districtProbe, (ctx) => {
    const P = engine.player,
      visible = (bb) =>
        bb[0] < P.gx + 320 &&
        bb[2] > P.gx - 320 &&
        bb[1] < P.gz + 320 &&
        bb[3] > P.gz - 320;
    function fill(feature, color) {
      if (!visible(feature.bounds)) return;
      ctx.fillStyle = color;
      ctx.beginPath();
      for (const r of feature.rings) {
        r.forEach(([x, z], i) => ctx[i ? "lineTo" : "moveTo"](x, z));
        ctx.closePath();
      }
      ctx.fill("evenodd");
    }
    ctx.fillStyle = "#c8c3b4";
    ctx.fillRect(B.west, B.north, B.east - B.west, B.south - B.north);
    for (const w of mapData.water) fill(w, "#518b9b");
    for (const p of mapData.parks) fill(p, "#7d9162");
    for (const r of mapData.roads) {
      if (!visible(r.bounds)) continue;
      ctx.strokeStyle = r.kind === "tram" ? "#4b5a56" : "#90958b";
      ctx.lineWidth = r.width;
      ctx.beginPath();
      r.points.forEach(([x, z], i) => ctx[i ? "lineTo" : "moveTo"](x, z));
      ctx.stroke();
    }
    for (const f of districtBuildings) fill(f, "#846c58");
  });
  // Give the actual northern sky room in the title's live painting.
  engine.setEntrance(30, 230, 65, -0.06);
  return {
    name: "Central Helsinki · OpenStreetMap",
    buildings: districtBuildings,
    locations: mapData.locations,
    routes: mapData.routes,
    update() {
      for (const { m, bounds: b, range } of groups) {
        const x = Math.max(b[0], Math.min(b[2], engine.camera.position.x)),
          z = Math.max(b[1], Math.min(b[3], engine.camera.position.z));
        m.visible =
          Math.hypot(x - engine.camera.position.x, z - engine.camera.position.z) < range;
      }
    },
  };
}
