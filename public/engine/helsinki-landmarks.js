/* Recognizable silhouettes, deliberately compressed for a rideable game map. */
export function buildHelsinkiLandmark(
  b,
  g,
  { box, ellipsoid, line, c, kinds },
) {
  const { x, z, w, d, h } = b;
  if (b.landmark === "cathedral") {
    const white = [0.9, 0.88, 0.76];
    box(g, x, 0, z, w, h, d, white, kinds.PLAIN);
    box(g, x, h, z, w + 1, 0.5, d + 1, white);
    for (let k = -3; k <= 3; k++) {
      box(g, x + k * 4, 0, z + d / 2 + 0.7, 0.85, 12, 0.85, white);
      box(g, x + k * 4, 12, z + d / 2 + 1, 3.8, 0.7, 3, white);
    }
    box(g, x, 4, z + d / 2 + 0.03, 4, 7, 0.12, c.copper);
    box(g, x, h, z, 11, 6, 11, white);
    ellipsoid(g, x, h + 6, z, 8, 7, 8, c.copper, kinds.PLAIN);
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        box(g, x + side * 12, h, z + end * 8, 5, 3, 5, white);
        ellipsoid(
          g,
          x + side * 12,
          h + 3,
          z + end * 8,
          3,
          3,
          3,
          c.copper,
          kinds.PLAIN,
        );
      }
    line(g, [x, h + 12, z], [x, h + 17, z], 0.25, c.gold);
    line(g, [x - 1.4, h + 15, z], [x + 1.4, h + 15, z], 0.25, c.gold);
  } else if (b.landmark === "library") {
    box(g, x, 0, z, w, h, d, [0.16, 0.28, 0.3]);
    // Timber fins and a gently waving canopy evoke Oodi's wood-and-glass facade.
    for (let k = 0; k < 29; k++) {
      const xx = x - w / 2 + k * 2 + 1,
        wave = Math.sin((k / 28) * Math.PI) * 2.5;
      box(g, xx, 0, z + d / 2 + 0.1, 1.5, 4 + wave, 0.5, [0.64, 0.43, 0.22]);
      box(g, xx, h, z, 2.05, 0.6 + wave, d + 3, c.cream);
    }
    for (let k = -12; k <= 12; k++)
      box(g, x + k * 2, h - 5, z + d / 2 + 0.2, 0.08, 5, 0.1, c.cream);
  } else {
    box(g, x, 0, z, w, h, d, [0.58, 0.19, 0.12], kinds.PLAIN);
    box(g, x, h, z, w + 1, 0.5, d + 1, c.copper, kinds.ROOF);
    for (let zz = z - d / 2 + 3; zz < z + d / 2; zz += 5)
      for (const side of [-1, 1]) {
        box(g, x + side * (w / 2 + 0.04), 1, zz, 0.1, 6, 2.5, c.cream);
        box(g, x + side * (w / 2 + 0.12), 1.3, zz, 0.12, 5.4, 1.9, c.copper);
      }
    for (const side of [-1, 1]) {
      box(g, x, 0, z + side * (d / 2 + 0.05), 5, 6, 0.2, c.copper);
      box(g, x, 8, z + side * (d / 2 + 0.1), w + 1, 0.7, 0.4, c.cream);
      box(g, x - 8, 0, z + (side * d) / 2, 1, h + 3, 1, c.cream);
      box(g, x + 8, 0, z + (side * d) / 2, 1, h + 3, 1, c.cream);
    }
  }
}
export function buildHarbour({
  builder,
  box,
  ellipsoid,
  line,
  c,
  finish,
  kinds,
}) {
  // Market stalls, produce crates and orange canvas beside the promenade.
  for (const z of [36, 52, 68, 84])
    for (const x of [174, 191]) {
      const g = builder();
      box(g, x, 0.25, z, 5, 1, 3, c.wood);
      for (const dx of [-2.5, 2.5])
        for (const dz of [-1.5, 1.5])
          line(g, [x + dx, 0, z + dz], [x + dx, 3.2, z + dz], 0.09, c.wood);
      box(g, x, 3.1, z, 5.8, 0.18, 3.8, [0.87, 0.35, 0.09], kinds.CLOTH);
      for (let i = -2; i <= 2; i++)
        ellipsoid(
          g,
          x + i * 0.75,
          1.5,
          z,
          0.34,
          0.28,
          0.4,
          i % 2 ? c.gold : c.green,
          kinds.PLAIN,
        );
      finish(g);
    }
  // Boats beyond the quay are scenery, never mistaken for rideable streets.
  for (const [x, z] of [
    [244, -25],
    [253, 50],
    [250, 150],
    [285, 90],
  ]) {
    const g = builder();
    ellipsoid(g, x, -0.2, z, 3, 1.3, 10, c.copper, kinds.PLAIN);
    box(g, x, 0.4, z, 4, 1.4, 7, c.cream);
    box(g, x, 1.8, z, 3.3, 0.3, 6, c.wood);
    line(g, [x, 0, z], [x, 14, z], 0.16, c.cream);
    for (let k = 0; k < 10; k++)
      box(
        g,
        x + 1 + k * 0.2,
        3 + k,
        z,
        2 + k * 0.4,
        0.8,
        0.08,
        c.cream,
        kinds.CLOTH,
      );
    finish(g);
  }
  // Street lamps, bicycle parking and a second tram line along the south boulevard.
  const g = builder();
  for (let x = -190; x < 200; x += 4)
    for (const z of [106, 107.5]) box(g, x, 0.06, z, 4, 0.03, 0.07, c.ink);
  for (let x = -180; x <= 180; x += 30) {
    line(g, [x, 0, 117], [x, 6, 117], 0.12, c.ink);
    ellipsoid(g, x, 6.2, 117, 0.45, 0.3, 0.45, c.cream, kinds.PLAIN);
    for (let k = 0; k < 3; k++) {
      line(g, [x + k * 1.2, 0, 160], [x + k * 1.2, 1, 160], 0.07, c.ink);
      line(g, [x + k * 1.2, 1, 160], [x + k * 1.2, 1, 162], 0.07, c.ink);
      line(g, [x + k * 1.2, 1, 162], [x + k * 1.2, 0, 162], 0.07, c.ink);
    }
  }
  finish(g);
}
