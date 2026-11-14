import { mapData } from "./helsinki-geography.js";
const pedestrianRoutes = mapData.routes;
import { districtProbe } from "./helsinki-geography.js";

export function installCitizens(engine, helpers) {
  const { builder, localBox: box, ellipsoid, paint, colors: c } = helpers;
  const root = new engine.Group();
  root.name = "Helsinki pedestrians";
  engine.scene.add(root);
  const outfits = [
    [0.18, 0.34, 0.36],
    [0.64, 0.25, 0.16],
    [0.23, 0.3, 0.48],
    [0.62, 0.5, 0.23],
    [0.35, 0.25, 0.41],
    [0.34, 0.42, 0.24],
  ];
  const skins = [
    [0.76, 0.53, 0.36],
    [0.42, 0.25, 0.16],
    [0.87, 0.67, 0.49],
  ];
  const bodies = outfits.map((coat, i) => {
    const b = builder();
    box(b, 0, 0.75, 0, 0.48, 0.65, 0.28, coat);
    ellipsoid(b, 0, 1.65, 0, 0.2, 0.24, 0.19, skins[i % 3], engine.kinds.PLAIN);
    ellipsoid(
      b,
      0,
      1.82,
      -0.025,
      0.21,
      0.11,
      0.2,
      i % 2 ? c.ink : c.wood,
      engine.kinds.PLAIN,
    );
    for (const x of [-0.32, 0.32]) {
      box(b, x, 0.8, 0, 0.13, 0.53, 0.18, coat);
      ellipsoid(b, x, 0.77, 0.01, 0.075, 0.09, 0.075, skins[i % 3]);
    }
    if (i % 2) box(b, 0, 0.95, -0.22, 0.36, 0.46, 0.18, c.gold);
    return b.build();
  });
  const b = builder();
  box(b, 0, -0.66, 0, 0.17, 0.66, 0.2, c.ink);
  box(b, 0, -0.73, 0.045, 0.19, 0.1, 0.3, c.ink);
  const legs = b.build();
  const greetings = [
    "Moi! Nice day for a ride.",
    "I’m heading to the library.",
    "The harbour is along the eastern quay.",
    "Taking the long way home today.",
    "See you around the square.",
    "There’s a park walk south of the station.",
  ];
  const citizens = [];
  pedestrianRoutes.forEach((route, ri) => {
    for (let j = 0; j < 2; j++) {
      const id = ri * 2 + j,
        group = new engine.Group();
      group.add(new engine.Mesh(bodies[id % 6], paint));
      const feet = [-1, 1].map((side) => {
        const m = new engine.Mesh(legs, paint);
        m.position.set(side * 0.14, 0.75, 0);
        group.add(m);
        return m;
      });
      root.add(group);
      citizens.push({
        group,
        feet,
        route,
        phase: (j / 2) * 2,
        speed: 0.75 + (id % 5) * 0.13,
        text: greetings[id % 6],
        gx: route[0][0],
        gz: route[0][1],
      });
    }
  });
  function update(dt) {
    for (const p of citizens) {
      const [[ax, az], [bx, bz]] = p.route,
        length = Math.hypot(bx - ax, bz - az);
      const nearby = Math.hypot(
        p.gx - engine.player.gx,
        p.gz - engine.player.gz,
      );
      const walking = nearby > 1.5;
      if (walking) p.phase = (p.phase + (dt * p.speed) / length) % 2;
      const f = p.phase < 1 ? p.phase : 2 - p.phase,
        x = ax + (bx - ax) * f,
        z = az + (bz - az) * f;
      if (!districtProbe(x, z, 0, 0.3).blocked) {
        p.gx = x;
        p.gz = z;
      }
      p.group.visible = nearby < 115;
      if (!p.group.visible) continue;
      p.group.position.set(
        engine.worldX(p.gx, p.gz),
        0,
        engine.worldZ(p.gx, p.gz),
      );
      const direction = p.phase < 1 ? 1 : -1;
      p.group.rotation.y = Math.atan2(
        engine.worldX(
          p.gx + ((bx - ax) / length) * direction,
          p.gz + ((bz - az) / length) * direction,
        ) - engine.worldX(p.gx, p.gz),
        engine.worldZ(
          p.gx + ((bx - ax) / length) * direction,
          p.gz + ((bz - az) / length) * direction,
        ) - engine.worldZ(p.gx, p.gz),
      );
      p.feet.forEach(
        (leg, i) =>
          (leg.rotation.x = walking
            ? Math.sin(p.phase * length * 7 + i * Math.PI) * 0.32
            : 0),
      );
    }
  }
  update(0);
  return {
    count: citizens.length,
    update,
    speaker() {
      return citizens.find(
        (p) =>
          p.group.visible &&
          Math.hypot(p.gx - engine.player.gx, p.gz - engine.player.gz) < 9,
      );
    },
  };
}
