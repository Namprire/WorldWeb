/**
 * Mutable high-frequency telemetry shared across 60Hz R3F `useFrame` loops and
 * the 2D GTA V radar / HUD without triggering React component re-renders every frame.
 */
export interface EntityBlip {
  x: number;
  z: number;
  kind: 'robot' | 'drone' | 'car';
}

export interface DrivableCarState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  speed: number;
  steerAngle: number;
  wheelSpin: number;
  paintHex: string;
  stripeHex: string;
  braking: boolean;
}

export const DRIVABLE_CARS: DrivableCarState[] = [
  {
    id: 'car-silicon-gt',
    name: 'NVIDIA Tensor GT',
    x: -7.2,
    y: 0,
    z: 9.5,
    yaw: Math.PI,
    speed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    paintHex: '#65a30d',
    stripeHex: '#111827',
    braking: false,
  },
  {
    id: 'car-vinewood-s',
    name: 'Vinewood Comet R',
    x: 8.6,
    y: 0,
    z: -9.8,
    yaw: 0,
    speed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    paintHex: '#dc2626',
    stripeHex: '#f8fafc',
    braking: false,
  },
  {
    id: 'car-founder-exec',
    name: 'Founder Roadster V12',
    x: 11.4,
    y: 0,
    z: 8.2,
    yaw: -Math.PI / 2,
    speed: 0,
    steerAngle: 0,
    wheelSpin: 0,
    paintHex: '#e2e8f0',
    stripeHex: '#0f172a',
    braking: false,
  },
];

export const playerTelemetry = {
  x: 0,
  y: 0.16,
  z: 6.5,
  yaw: Math.PI,
  speed: 0,
  stamina: 1.0,
  health: 1.0,
  armor: 1.0,
  isSprinting: false,
  isGrounded: true,
  inVehicleId: null as string | null,
  vehicleName: null as string | null,
  nearbyVehicleName: null as string | null,
  firstPerson: false,
  characterLoaded: false,
  cameraYaw: Math.PI,
  trauma: 0,
  /** Timestamp (performance.now() / 1000) of last world transformation shockwave */
  lastShockwaveAt: -100,
  entityBlips: [] as EntityBlip[],
};

export function addCameraTrauma(amount: number): void {
  playerTelemetry.trauma = Math.max(0, Math.min(1, playerTelemetry.trauma + amount));
}

export function triggerWorldShockwave(traumaAmount = 0.75): void {
  playerTelemetry.lastShockwaveAt =
    typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
  addCameraTrauma(traumaAmount);
}
