/* A presentation skin on the original rider rig: physics, root transforms,
   lean, pitch, spins, flips, parked vehicle and wing animation remain original. */
export function installStudent(engine, h) {
  const { Group, rider, player, kinds } = engine;
  const { builder, localBox: box, ellipsoid: ball, mesh, paint } = h;
  const c = {
    teal: [0.08, 0.25, 0.22],
    light: [0.16, 0.36, 0.3],
    cream: [0.84, 0.79, 0.64],
    skin: [0.65, 0.38, 0.21],
    hair: [0.1, 0.065, 0.04],
    pants: [0.085, 0.12, 0.13],
    pack: [0.52, 0.23, 0.085],
    stitch: [0.77, 0.48, 0.22],
    rubber: [0.025, 0.038, 0.035],
    metal: [0.17, 0.23, 0.21],
    mint: [0.27, 0.49, 0.37],
  };
  const oldChildren = [...rider.tilt.children];
  for (const child of oldChildren) child.visible = false;
  const person = new Group(),
    vehicle = new Group();
  person.name = "Helsinki student · helmet and canvas backpack";
  vehicle.name = "Standing electric scooter";
  rider.tilt.add(person, vehicle);
  function tube(b, a, z, r, color) {
    b.color(color).data(kinds.FIGURE, 0.45, 0.7, 0);
    engine.tube(
      b,
      a,
      z,
      [
        [0, r * 0.9],
        [0.25, r],
        [0.78, r * 0.92],
        [1, r * 0.8],
      ],
      10,
    );
  }
  const torso = builder();
  ball(torso, -0.04, 1.18, 0, 0.23, 0.32, 0.25, c.teal);
  ball(torso, -0.07, 1.47, 0, 0.2, 0.1, 0.22, c.cream);
  // Zip and drawstrings, a collar, canvas pocket and shoulder straps.
  box(torso, 0.183, 1.02, 0, 0.018, 0.38, 0.018, c.cream, kinds.FIGURE);
  for (const side of [-1, 1]) {
    tube(
      torso,
      [0.12, 1.48, side * 0.08],
      [0.19, 1.28, side * 0.095],
      0.012,
      c.cream,
    );
    tube(
      torso,
      [-0.07, 1.45, side * 0.22],
      [0.15, 1.06, side * 0.19],
      0.035,
      c.pack,
    );
  }
  ball(torso, -0.32, 1.17, 0, 0.13, 0.31, 0.245, c.pack);
  box(torso, -0.38, 1.0, 0, 0.11, 0.28, 0.39, c.pack, kinds.FIGURE);
  box(torso, -0.442, 1.02, 0, 0.018, 0.15, 0.27, c.stitch, kinds.FIGURE);
  box(torso, -0.45, 1.3, 0, 0.02, 0.05, 0.12, c.cream, kinds.FIGURE);
  for (const side of [-1, 1])
    box(
      torso,
      -0.43,
      1.05,
      side * 0.16,
      0.015,
      0.25,
      0.012,
      c.stitch,
      kinds.FIGURE,
    );
  mesh(torso, person);
  const head = new Group();
  head.position.set(0.01, 1.67, 0);
  person.add(head);
  const face = builder();
  ball(face, 0, 0, 0, 0.15, 0.19, 0.15, c.skin);
  ball(face, -0.045, 0.09, 0, 0.14, 0.11, 0.154, c.hair);
  ball(face, 0.145, -0.015, 0, 0.035, 0.04, 0.04, c.skin);
  for (const side of [-1, 1]) {
    ball(face, 0.136, 0.042, side * 0.065, 0.015, 0.018, 0.022, c.hair);
    tube(
      face,
      [-0.06, 0.07, side * 0.15],
      [0.065, -0.13, side * 0.1],
      0.012,
      c.metal,
    );
  }
  ball(face, -0.016, 0.135, 0, 0.18, 0.115, 0.18, c.cream);
  for (const side of [-1, 0, 1])
    box(face, -0.02, 0.225, side * 0.065, 0.12, 0.012, 0.017, c.metal);
  mesh(face, head);
  const arms = [],
    legs = [];
  for (const side of [-1, 1]) {
    const arm = new Group();
    arm.position.set(0.01, 1.37, side * 0.22);
    person.add(arm);
    const b = builder();
    tube(b, [0, 0, 0], [0.18, -0.23, side * 0.025], 0.075, c.teal);
    ball(b, 0.18, -0.23, side * 0.025, 0.077, 0.078, 0.077, c.teal);
    tube(
      b,
      [0.18, -0.23, side * 0.025],
      [0.44, -0.24, side * 0.04],
      0.065,
      c.teal,
    );
    ball(b, 0.45, -0.24, side * 0.04, 0.06, 0.06, 0.065, c.skin);
    mesh(b, arm);
    arms.push(arm);
    const leg = new Group();
    leg.position.set(0, 0.98, side * 0.11);
    person.add(leg);
    const b2 = builder(),
      x = side > 0 ? 0.1 : -0.12;
    tube(b2, [0, 0, 0], [x + 0.06, -0.37, 0], 0.088, c.pants);
    tube(b2, [x + 0.06, -0.37, 0], [x, -0.74, 0], 0.073, c.pants);
    ball(b2, x + 0.06, -0.8, 0, 0.16, 0.075, 0.082, c.cream);
    box(b2, x + 0.05, -0.86, 0, 0.28, 0.035, 0.15, c.rubber);
    mesh(b2, leg);
    legs.push(leg);
  }
  const deck = builder();
  box(deck, 0, 0.125, 0, 0.97, 0.09, 0.29, c.metal);
  box(deck, 0, 0.218, 0, 0.78, 0.012, 0.23, c.rubber);
  for (let i = -3; i <= 3; i++)
    box(deck, i * 0.1, 0.233, 0, 0.016, 0.004, 0.21, c.mint);
  box(deck, -0.5, 0.23, 0, 0.13, 0.06, 0.18, c.metal);
  box(deck, -0.56, 0.26, 0, 0.02, 0.035, 0.13, [0.72, 0.12, 0.055]);
  mesh(deck, vehicle);
  const front = new Group();
  front.position.x = 0.53;
  vehicle.add(front);
  const stem = builder();
  tube(stem, [0, 0.17, 0], [-0.08, 1.12, 0], 0.033, c.metal);
  tube(stem, [-0.02, 0.35, 0], [-0.055, 0.73, 0], 0.036, c.mint);
  tube(stem, [-0.08, 1.12, -0.32], [-0.08, 1.12, 0.32], 0.026, c.rubber);
  box(stem, -0.08, 1.12, 0, 0.07, 0.025, 0.1, c.metal);
  box(stem, -0.08, 1.146, 0, 0.045, 0.003, 0.064, [0.22, 0.61, 0.46]);
  ball(stem, -0.04, 1.09, 0, 0.044, 0.035, 0.05, c.cream);
  mesh(stem, front);
  const wheels = [];
  for (const [x, parent] of [
    [-0.51, vehicle],
    [0, front],
  ]) {
    const wheel = new Group();
    wheel.position.set(x, 0.16, 0);
    parent.add(wheel);
    const b = builder();
    ball(b, 0, 0, 0, 0.16, 0.16, 0.055, c.rubber, kinds.PLAIN);
    ball(b, 0, 0, 0, 0.095, 0.095, 0.06, c.metal, kinds.PLAIN);
    for (const side of [-1, 1]) {
      ball(b, 0, 0, side * 0.062, 0.033, 0.033, 0.006, c.mint, kinds.PLAIN);
      for (let n = 0; n < 6; n++) {
        const a = (n * Math.PI) / 3;
        tube(
          b,
          [Math.cos(a) * 0.04, Math.sin(a) * 0.04, side * 0.063],
          [Math.cos(a) * 0.085, Math.sin(a) * 0.085, side * 0.063],
          0.007,
          c.mint,
        );
      }
    }
    mesh(b, wheel);
    wheels.push(wheel);
  }
  // Reuse the original articulated flight wings and animation, on the new body.
  rider.flightWings.forEach((wing, index) => {
    person.add(wing);
    wing.position.set(-0.12, 1.27, index ? 0.12 : -0.12);
  });
  let walk = 0;
  return function updateStudent(dt) {
    walk += (Number(player.walking) - walk) * Math.min(1, dt * 8);
    person.position.y = -0.13 * walk - player.squash * 0.04;
    vehicle.position.copy(rider.vehicle.position);
    vehicle.quaternion.copy(rider.vehicle.quaternion);
    front.rotation.y = rider.steer.rotation.y;
    wheels.forEach((w) => {
      w.rotation.z = -player.wheel * 2.1;
    });
    head.rotation.y = player.steer * 0.12;
    const stride = player.stride || 0;
    legs.forEach((leg, i) => {
      leg.rotation.z =
        Math.sin(stride + i * Math.PI) *
        0.48 *
        walk *
        Math.min(1, player.speed);
    });
    arms.forEach((arm, i) => {
      arm.rotation.z =
        walk *
        (-0.9 -
          Math.sin(stride + i * Math.PI) * 0.32 * Math.min(1, player.speed));
    });
    // The original engine still computes these hidden parts for posing and parking.
    for (const child of oldChildren) child.visible = false;
  };
}
