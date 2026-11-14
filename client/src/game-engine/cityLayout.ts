import { CITY_LANDMARKS, WORLD_LIMITS, type LandmarkId } from '@webworld/shared';

export interface BuildingSpec {
  id: string;
  x: number;
  z: number;
  width: number;
  depth: number;
  height: number;
  bodyColor: string;
  trimColor: string;
  landmarkId?: LandmarkId;
  roofSpire?: boolean;
}

export interface BillboardSpec {
  id: string;
  position: [number, number, number];
  rotationY: number;
  width: number;
  height: number;
  variant: 'headline' | 'ticker' | 'brand';
}

export interface SidewalkBlock {
  x: number;
  z: number;
  width: number;
  depth: number;
}

export const SIDEWALK_BLOCKS: readonly SidewalkBlock[] = [
  // Center Founders Plaza
  { x: 0, z: 0, width: 21, depth: 21 },
  // North row blocks
  { x: -33, z: -32, width: 31, depth: 29 },
  { x: 0, z: -32, width: 21, depth: 29 },
  { x: 33, z: -32, width: 31, depth: 29 },
  // Middle outer blocks
  { x: -33, z: 0, width: 31, depth: 21 },
  { x: 33, z: 0, width: 31, depth: 21 },
  // South row blocks
  { x: -33, z: 32, width: 31, depth: 29 },
  { x: 0, z: 32, width: 21, depth: 29 },
  { x: 33, z: 32, width: 31, depth: 29 },
];

export const CITY_BUILDINGS: readonly BuildingSpec[] = [
  // Landmark 1: NVIDIA Tensor Spire (North Center — Glass Curtain-Wall Headquarters)
  {
    id: 'b-nvidia-spire',
    x: CITY_LANDMARKS.nvidia_tower.position[0],
    z: CITY_LANDMARKS.nvidia_tower.position[2],
    width: 13,
    depth: 13,
    height: 36,
    bodyColor: '#cfd8e3',
    trimColor: '#76b900',
    landmarkId: 'nvidia_tower',
    roofSpire: true,
  },
  // Landmark 2: OmniMind AI Lab (North East — Modern Anodized Steel Tower)
  {
    id: 'b-ai-hq',
    x: CITY_LANDMARKS.ai_headquarters.position[0],
    z: CITY_LANDMARKS.ai_headquarters.position[2],
    width: 12,
    depth: 12,
    height: 29,
    bodyColor: '#c7d2de',
    trimColor: '#38bdf8',
    landmarkId: 'ai_headquarters',
    roofSpire: true,
  },
  // Landmark 3: Silicon Stock Exchange (North West — Limestone Financial Tower)
  {
    id: 'b-stock-exchange',
    x: CITY_LANDMARKS.wall_street_exchange.position[0],
    z: CITY_LANDMARKS.wall_street_exchange.position[2],
    width: 12,
    depth: 12,
    height: 27,
    bodyColor: '#dcd3c4',
    trimColor: '#f59e0b',
    landmarkId: 'wall_street_exchange',
    roofSpire: false,
  },
  // Landmark 4: Keynote Convention Center (South Center)
  {
    id: 'b-keynote-dome',
    x: CITY_LANDMARKS.keynote_arena.position[0],
    z: CITY_LANDMARKS.keynote_arena.position[2],
    width: 14,
    depth: 12,
    height: 20,
    bodyColor: '#d1d8e0',
    trimColor: '#0ea5e9',
    landmarkId: 'keynote_arena',
    roofSpire: false,
  },
  // Landmark 5: Data Center Vault 07 (South East — Architectural Concrete & Bronze)
  {
    id: 'b-server-farm',
    x: CITY_LANDMARKS.server_farm_7.position[0],
    z: CITY_LANDMARKS.server_farm_7.position[2],
    width: 13,
    depth: 11,
    height: 22,
    bodyColor: '#c4bdb3',
    trimColor: '#f97316',
    landmarkId: 'server_farm_7',
    roofSpire: true,
  },
  // Landmark 6: Del Perro Quantum Promenade Tower (South West)
  {
    id: 'b-quantum-harbor',
    x: CITY_LANDMARKS.quantum_harbor.position[0],
    z: CITY_LANDMARKS.quantum_harbor.position[2],
    width: 11,
    depth: 11,
    height: 25,
    bodyColor: '#cbd5e1',
    trimColor: '#38bdf8',
    landmarkId: 'quantum_harbor',
    roofSpire: true,
  },
  // Downtown Los Silicon High-Rises
  {
    id: 'b-east-1',
    x: 26,
    z: -4,
    width: 10,
    depth: 9,
    height: 26,
    bodyColor: '#d6cfc2',
    trimColor: '#94a3b8',
    roofSpire: true,
  },
  {
    id: 'b-east-2',
    x: 40,
    z: 4,
    width: 11,
    depth: 10,
    height: 32,
    bodyColor: '#c2cdd9',
    trimColor: '#cbd5e1',
  },
  {
    id: 'b-west-1',
    x: -26,
    z: 4,
    width: 10,
    depth: 9,
    height: 24,
    bodyColor: '#cfc8bc',
    trimColor: '#94a3b8',
    roofSpire: true,
  },
  {
    id: 'b-west-2',
    x: -40,
    z: -4,
    width: 11,
    depth: 10,
    height: 31,
    bodyColor: '#c5d1de',
    trimColor: '#e2e8f0',
  },
  {
    id: 'b-ne-back',
    x: 41,
    z: -39,
    width: 11,
    depth: 11,
    height: 38,
    bodyColor: '#bcc8d6',
    trimColor: '#94a3b8',
    roofSpire: true,
  },
  {
    id: 'b-nw-back',
    x: -41,
    z: -39,
    width: 11,
    depth: 11,
    height: 35,
    bodyColor: '#d9d0c1',
    trimColor: '#d6d3d1',
  },
  {
    id: 'b-se-back',
    x: 41,
    z: 39,
    width: 11,
    depth: 11,
    height: 30,
    bodyColor: '#c8d2dc',
    trimColor: '#94a3b8',
  },
  {
    id: 'b-sw-back',
    x: -41,
    z: 39,
    width: 11,
    depth: 11,
    height: 33,
    bodyColor: '#d2cabd',
    trimColor: '#cbd5e1',
    roofSpire: true,
  },
];

export const CITY_BILLBOARDS: readonly BillboardSpec[] = [
  // Facing south onto Central Plaza from NVIDIA Spire
  {
    id: 'bb-north-main',
    position: [0, 11.5, -24.2],
    rotationY: 0,
    width: 11.5,
    height: 4.8,
    variant: 'headline',
  },
  // Facing south-west from OmniMind AI Lab
  {
    id: 'bb-ne-lab',
    position: [21.8, 10.5, -26],
    rotationY: -Math.PI / 2,
    width: 9.5,
    height: 4.2,
    variant: 'ticker',
  },
  // Facing south-east from Silicon Stock Exchange
  {
    id: 'bb-nw-stock',
    position: [-21.8, 10.5, -26],
    rotationY: Math.PI / 2,
    width: 9.5,
    height: 4.2,
    variant: 'ticker',
  },
  // Facing west onto East Avenue
  {
    id: 'bb-east-plaza',
    position: [20.8, 9.5, -4],
    rotationY: -Math.PI / 2,
    width: 8.5,
    height: 4.0,
    variant: 'headline',
  },
  // Facing east onto West Avenue
  {
    id: 'bb-west-plaza',
    position: [-20.8, 9.5, 4],
    rotationY: Math.PI / 2,
    width: 8.5,
    height: 4.0,
    variant: 'headline',
  },
  // Facing north onto Plaza from Keynote Holo-Dome
  {
    id: 'bb-south-dome',
    position: [0, 10.0, 24.8],
    rotationY: Math.PI,
    width: 11,
    height: 4.5,
    variant: 'brand',
  },
];

/**
 * Resolves circle-vs-AABB collision in XZ plane against all city buildings and world boundaries,
 * returning a valid clamped [x, z] coordinate.
 */
export function resolveCityCollision(
  nextX: number,
  nextZ: number,
  radius = 0.65
): [number, number] {
  const limit = WORLD_LIMITS.CITY_HALF_EXTENT - radius;
  let x = Math.max(-limit, Math.min(limit, nextX));
  let z = Math.max(-limit, Math.min(limit, nextZ));

  // Central holo-pedestal radius check (radius 1.6 at [0, 0])
  const distCenter = Math.hypot(x, z);
  const minCenterDist = 1.6 + radius;
  if (distCenter < minCenterDist && distCenter > 0.0001) {
    const push = minCenterDist / distCenter;
    x *= push;
    z *= push;
  }

  for (const b of CITY_BUILDINGS) {
    const halfW = b.width * 0.5;
    const halfD = b.depth * 0.5;
    const closestX = Math.max(b.x - halfW, Math.min(b.x + halfW, x));
    const closestZ = Math.max(b.z - halfD, Math.min(b.z + halfD, z));
    const dx = x - closestX;
    const dz = z - closestZ;
    const distSq = dx * dx + dz * dz;

    if (distSq < radius * radius) {
      if (distSq > 0.00001) {
        const dist = Math.sqrt(distSq);
        const overlap = radius - dist;
        x += (dx / dist) * overlap;
        z += (dz / dist) * overlap;
      } else {
        // Inside AABB: push out along shallowest axis
        const overlapLeft = Math.abs(x - (b.x - halfW));
        const overlapRight = Math.abs(b.x + halfW - x);
        const overlapTop = Math.abs(z - (b.z - halfD));
        const overlapBottom = Math.abs(b.z + halfD - z);
        const minOverlap = Math.min(overlapLeft, overlapRight, overlapTop, overlapBottom);
        if (minOverlap === overlapLeft) x = b.x - halfW - radius;
        else if (minOverlap === overlapRight) x = b.x + halfW + radius;
        else if (minOverlap === overlapTop) z = b.z - halfD - radius;
        else z = b.z + halfD + radius;
      }
    }
  }

  return [x, z];
}
