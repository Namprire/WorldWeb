import * as THREE from 'three';

export interface PbrMaterialMaps {
  map: THREE.CanvasTexture;
  normalMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

function seededRandom(seedStart: number): () => number {
  let s = seedStart % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Converts a grayscale heightfield buffer (0..1) into a tangent-space normal map CanvasTexture.
 * Normal maps MUST remain in linear NoColorSpace (`threejs-materials-lighting`).
 */
function heightToNormalTexture(
  heights: Float32Array,
  width: number,
  height: number,
  strength: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  const sample = (x: number, y: number) => {
    const wx = ((x % width) + width) % width;
    const wy = ((y % height) + height) % height;
    return heights[wy * width + wx];
  };

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const hL = sample(x - 1, y);
      const hR = sample(x + 1, y);
      const hU = sample(x, y - 1);
      const hD = sample(x, y + 1);

      const dx = (hL - hR) * strength;
      const dy = (hU - hD) * strength;
      const dz = 1.0;
      const invLen = 1 / Math.hypot(dx, dy, dz);

      const idx = (y * width + x) * 4;
      data[idx] = Math.round(((dx * invLen) * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round(((dy * invLen) * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round(((dz * invLen) * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

function scalarToLinearTexture(
  values: Float32Array,
  width: number,
  height: number,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const data = img.data;

  for (let i = 0; i < width * height; i++) {
    const v = Math.max(0, Math.min(255, Math.round(values[i] * 255)));
    const idx = i * 4;
    data[idx] = v;
    data[idx + 1] = v;
    data[idx + 2] = v;
    data[idx + 3] = 255;
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.anisotropy = 8;
  return tex;
}

let cachedAsphalt: PbrMaterialMaps | null = null;
export function getAsphaltMaps(): PbrMaterialMaps {
  if (cachedAsphalt) return cachedAsphalt;

  const W = 256;
  const H = 256;
  const rand = seededRandom(4091);
  const heights = new Float32Array(W * H);
  const rough = new Float32Array(W * H);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const grain = rand();
      const coarse =
        Math.sin(x * 0.08 + y * 0.05) * 0.5 +
        Math.cos(x * 0.03 - y * 0.09) * 0.5;
      const wear = 0.5 + 0.5 * Math.sin((x / W) * Math.PI * 4);
      const h = grain * 0.72 + coarse * 0.14 + 0.14;
      heights[i] = h;
      // Tire-worn strips are slightly smoother/shinier than rough aggregate shoulders
      rough[i] = Math.max(0.32, Math.min(0.92, 0.76 - wear * 0.22 + (grain - 0.5) * 0.18));

      const base = 44 + (grain - 0.5) * 22 + coarse * 5 - wear * 4;
      const speck = grain > 0.94 ? 22 : grain < 0.05 ? -10 : 0;
      const c = Math.max(24, Math.min(92, Math.round(base + speck)));
      const idx = i * 4;
      img.data[idx] = c;
      img.data[idx + 1] = c + 1;
      img.data[idx + 2] = c + 4;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(28, 28);
  map.anisotropy = 8;

  cachedAsphalt = {
    map,
    normalMap: heightToNormalTexture(heights, W, H, 1.9, 28, 28),
    roughnessMap: scalarToLinearTexture(rough, W, H, 28, 28),
  };
  return cachedAsphalt;
}

let cachedSidewalk: PbrMaterialMaps | null = null;
export function getSidewalkMaps(): PbrMaterialMaps {
  if (cachedSidewalk) return cachedSidewalk;

  const W = 256;
  const H = 256;
  const rand = seededRandom(8821);
  const heights = new Float32Array(W * H);
  const rough = new Float32Array(W * H);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);

  const tile = 64;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const gx = x % tile;
      const gy = y % tile;
      const joint = gx < 2 || gy < 2 || gx === tile - 1 || gy === tile - 1;
      const bevel = gx < 4 || gy < 4 || gx > tile - 3 || gy > tile - 3;
      const tileHash = (((Math.floor(x / tile) * 31 + Math.floor(y / tile) * 17) % 9) - 4) * 2.2;
      const grain = rand();

      heights[i] = joint ? 0.12 : bevel ? 0.45 : 0.78 + (grain - 0.5) * 0.16;
      rough[i] = joint ? 0.95 : 0.78 + (grain - 0.5) * 0.14;

      const base = (joint ? 104 : bevel ? 148 : 172 + tileHash) + (grain - 0.5) * 14;
      const idx = i * 4;
      img.data[idx] = Math.max(70, Math.min(215, Math.round(base + 3)));
      img.data[idx + 1] = Math.max(70, Math.min(215, Math.round(base + 1)));
      img.data[idx + 2] = Math.max(70, Math.min(215, Math.round(base - 3)));
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 6);
  map.anisotropy = 8;

  cachedSidewalk = {
    map,
    normalMap: heightToNormalTexture(heights, W, H, 2.4, 6, 6),
    roughnessMap: scalarToLinearTexture(rough, W, H, 6, 6),
  };
  return cachedSidewalk;
}

let cachedLeather: PbrMaterialMaps | null = null;
export function getLeatherJacketMaps(): PbrMaterialMaps {
  if (cachedLeather) return cachedLeather;

  const W = 128;
  const H = 128;
  const rand = seededRandom(1993);
  const heights = new Float32Array(W * H);
  const rough = new Float32Array(W * H);

  // Cellular pebble centers for authentic lambskin/calfskin biker jacket grain
  const cellCount = 96;
  const cells: [number, number][] = [];
  for (let c = 0; c < cellCount; c++) {
    cells.push([rand() * W, rand() * H]);
  }

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const ctx = colorCanvas.getContext('2d')!;
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      let d1 = 1e9;
      let d2 = 1e9;
      for (let c = 0; c < cellCount; c++) {
        let dx = Math.abs(x - cells[c][0]);
        let dy = Math.abs(y - cells[c][1]);
        if (dx > W * 0.5) dx = W - dx;
        if (dy > H * 0.5) dy = H - dy;
        const d = dx * dx + dy * dy;
        if (d < d1) {
          d2 = d1;
          d1 = d;
        } else if (d < d2) {
          d2 = d;
        }
      }
      const edge = Math.min(1, (Math.sqrt(d2) - Math.sqrt(d1)) / 5.5);
      const pebble = Math.pow(edge, 0.55);
      const i = y * W + x;
      heights[i] = pebble;
      rough[i] = 0.28 + (1 - pebble) * 0.28;

      const v = Math.round(18 + pebble * 13);
      const idx = i * 4;
      img.data[idx] = v;
      img.data[idx + 1] = v + 1;
      img.data[idx + 2] = v + 3;
      img.data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(14, 14);

  cachedLeather = {
    map,
    normalMap: heightToNormalTexture(heights, W, H, 1.8, 14, 14),
    roughnessMap: scalarToLinearTexture(rough, W, H, 14, 14),
  };
  return cachedLeather;
}

export interface FacadeTextures {
  map: THREE.CanvasTexture;
  emissiveMap: THREE.CanvasTexture;
  roughnessMap: THREE.CanvasTexture;
}

export type FacadeStyle = 'curtain_blue' | 'curtain_bronze' | 'limestone_deco' | 'modern_charcoal';

const FACADE_STYLES: readonly FacadeStyle[] = [
  'curtain_blue',
  'limestone_deco',
  'curtain_bronze',
  'modern_charcoal',
];

export function createRealisticSkyscraperTextures(
  seedOffset: number,
  accentHex: string
): FacadeTextures {
  const style = FACADE_STYLES[seedOffset % FACADE_STYLES.length];
  const W = 512;
  const H = 1024;
  const rand = seededRandom(7100 + seedOffset * 131);

  const colorCanvas = document.createElement('canvas');
  colorCanvas.width = W;
  colorCanvas.height = H;
  const cCtx = colorCanvas.getContext('2d')!;

  const emCanvas = document.createElement('canvas');
  emCanvas.width = W;
  emCanvas.height = H;
  const eCtx = emCanvas.getContext('2d')!;

  const rCanvas = document.createElement('canvas');
  rCanvas.width = W;
  rCanvas.height = H;
  const rCtx = rCanvas.getContext('2d')!;

  // Architectural frame / spandrel base
  const frameColor =
    style === 'limestone_deco'
      ? '#b8afa0'
      : style === 'curtain_bronze'
        ? '#493f36'
        : style === 'modern_charcoal'
          ? '#2c333d'
          : '#384657';

  const spandrelColor =
    style === 'limestone_deco'
      ? '#9b9181'
      : style === 'curtain_bronze'
        ? '#2e2722'
        : style === 'modern_charcoal'
          ? '#1e242c'
          : '#1e2c3d';

  cCtx.fillStyle = frameColor;
  cCtx.fillRect(0, 0, W, H);

  eCtx.fillStyle = '#000000';
  eCtx.fillRect(0, 0, W, H);

  // Mullions are rougher stone/metal (0.68), glass panes are mirror-smooth (0.08)!
  rCtx.fillStyle = style === 'limestone_deco' ? '#c8c8c8' : '#787878';
  rCtx.fillRect(0, 0, W, H);

  const cols = style === 'limestone_deco' ? 8 : 10;
  const rows = 24;
  const cellW = W / cols;
  const cellH = H / rows;
  const mullionX = style === 'limestone_deco' ? 9 : 4;
  const spandrelY = style === 'limestone_deco' ? 12 : 7;

  for (let r = 0; r < rows; r++) {
    // Horizontal floor slab spandrel band
    cCtx.fillStyle = spandrelColor;
    cCtx.fillRect(0, r * cellH, W, spandrelY);

    for (let c = 0; c < cols; c++) {
      const gx = c * cellW + mullionX;
      const gy = r * cellH + spandrelY;
      const gw = cellW - mullionX * 2;
      const gh = cellH - spandrelY - 3;

      const litRoll = rand();
      const blindRatio = rand() > 0.65 ? 0.25 + rand() * 0.45 : 0;

      // Exterior reflective tinted architectural glass gradient
      const glassGrad = cCtx.createLinearGradient(gx, gy, gx, gy + gh);
      if (style === 'curtain_blue') {
        glassGrad.addColorStop(0, '#4f7396');
        glassGrad.addColorStop(0.55, '#2b4560');
        glassGrad.addColorStop(1, '#1d2f42');
      } else if (style === 'curtain_bronze') {
        glassGrad.addColorStop(0, '#786652');
        glassGrad.addColorStop(0.6, '#45392d');
        glassGrad.addColorStop(1, '#29221b');
      } else if (style === 'limestone_deco') {
        glassGrad.addColorStop(0, '#455768');
        glassGrad.addColorStop(1, '#222d38');
      } else {
        glassGrad.addColorStop(0, '#52657a');
        glassGrad.addColorStop(1, '#232d38');
      }
      cCtx.fillStyle = glassGrad;
      cCtx.fillRect(gx, gy, gw, gh);

      // Smooth low-roughness window glass for crisp IBL sky reflection
      rCtx.fillStyle = '#181818';
      rCtx.fillRect(gx, gy, gw, gh);

      // Subtle interior room ceiling / blinds / warm office glow
      if (litRoll > 0.56) {
        const warm =
          litRoll > 0.94
            ? accentHex
            : litRoll > 0.78
              ? '#fff1d0'
              : '#ffdca8';
        cCtx.fillStyle = warm;
        cCtx.globalAlpha = 0.45;
        cCtx.fillRect(gx + 2, gy + 2, gw - 4, gh - 4);
        cCtx.globalAlpha = 1.0;

        eCtx.fillStyle = warm;
        eCtx.globalAlpha = litRoll > 0.85 ? 0.55 : 0.28;
        eCtx.fillRect(gx + 2, gy + 2, gw - 4, gh - 4);
        eCtx.globalAlpha = 1.0;

        // Interior desk/partition silhouette at bottom of window for realistic depth!
        cCtx.fillStyle = 'rgba(20, 26, 36, 0.55)';
        cCtx.fillRect(gx + 2, gy + gh * 0.68, gw - 4, gh * 0.32 - 2);
        eCtx.fillStyle = '#000000';
        eCtx.fillRect(gx + 2, gy + gh * 0.72, gw - 4, gh * 0.28);
      }

      if (blindRatio > 0) {
        cCtx.fillStyle = 'rgba(214, 208, 196, 0.45)';
        cCtx.fillRect(gx + 1, gy + 1, gw - 2, gh * blindRatio);
      }
    }
  }

  const map = new THREE.CanvasTexture(colorCanvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = 8;

  const emissiveMap = new THREE.CanvasTexture(emCanvas);
  emissiveMap.colorSpace = THREE.SRGBColorSpace;
  emissiveMap.anisotropy = 4;

  const roughnessMap = new THREE.CanvasTexture(rCanvas);
  roughnessMap.anisotropy = 4;

  return { map, emissiveMap, roughnessMap };
}
