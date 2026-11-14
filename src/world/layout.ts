export const DISTRICT = { minX: -25, maxX: 25, minZ: -32, maxZ: 21 };

export interface BuildingSpec {
  x: number;
  z: number;
  w: number;
  d: number;
  h: number;
  tone: string;
  trim: string;
}

export const BUILDINGS: BuildingSpec[] = [
  { x: -11.6, z: 17.7, w: 7.7, d: 6, h: 9.8, tone: '#17162b', trim: '#fa7b4f' },
  { x: 12, z: 16.9, w: 8.7, d: 6, h: 9, tone: '#19172f', trim: '#b663ff' },
  { x: -12, z: 4.6, w: 8, d: 6, h: 15.5, tone: '#191628', trim: '#bf71ff' },
  { x: 12, z: 3.6, w: 8, d: 5, h: 13.8, tone: '#161c35', trim: '#49e5ff' },
  { x: -12.5, z: -4.2, w: 7.4, d: 5.7, h: 19, tone: '#201a33', trim: '#f078b6' },
  { x: 12.5, z: -14.4, w: 9, d: 5.1, h: 18, tone: '#121d32', trim: '#66f1ff' },
  { x: -11.5, z: -15.6, w: 8.8, d: 5.5, h: 17.1, tone: '#191d37', trim: '#ae77ff' },
  { x: -11.8, z: -24.3, w: 8.2, d: 7.3, h: 20, tone: '#18182d', trim: '#6d92ff' },
  { x: 11.7, z: -24.4, w: 9.5, d: 7.4, h: 15.8, tone: '#171830', trim: '#9d65ff' },
  { x: 0, z: -30, w: 11, d: 4.5, h: 18, tone: '#18182f', trim: '#58dbff' },
  ...Array.from({ length: 6 }, (_, i) => [-1, 1].map(side => ({
    x: side * (21.5 + (i % 2) * 0.5), z: 17 - i * 8.5, w: 5.3, d: 6.4, h: 12 + ((i * 7 + side * 9 + 100) % 18),
    tone: i % 2 ? '#16192d' : '#1a1b34', trim: side < 0 ? '#8761e0' : '#41afd0',
  }))).flat(),
];

export function canWalk(x: number, z: number) {
  const radius = 0.42;
  return x >= DISTRICT.minX && x <= DISTRICT.maxX && z >= DISTRICT.minZ && z <= DISTRICT.maxZ &&
    !BUILDINGS.some(b => Math.abs(b.x - x) < b.w / 2 + radius && Math.abs(b.z - z) < b.d / 2 + radius);
}

export function variation(index: number) {
  const v = Math.sin(index * 71.37 + 8.19) * 43758.5453;
  return v - Math.floor(v);
}
