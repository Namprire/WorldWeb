export const LOCATION_IDS = ['plaza', 'compute', 'exchange', 'relay', 'depot', 'arcade'] as const;

export type LocationId = (typeof LOCATION_IDS)[number];

export const LOCATIONS = {
  plaza: { x: 0, z: 4, label: 'Central Plaza' },
  compute: { x: 10, z: -8, label: 'Compute Works' },
  exchange: { x: -10, z: -10, label: 'GPU Exchange' },
  relay: { x: 0, z: -23, label: 'Relay Tower' },
  depot: { x: -13, z: 12, label: 'Freight Depot' },
  arcade: { x: 13, z: 10, label: 'Neon Arcade' },
} satisfies Record<LocationId, { x: number; z: number; label: string }>;

export const SPAWN = { x: 0, z: 14 };
export const INTERACTION_RADIUS = 2.6;
