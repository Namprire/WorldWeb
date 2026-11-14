import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { WORLD_LIMITS } from '@webworld/shared';
import { useGameStore } from '../state/gameStore';
import { DRIVABLE_CARS, playerTelemetry } from '../state/playerTelemetry';

interface TrafficCarSpec {
  axis: 'ns' | 'ew';
  laneCoord: number;
  dir: 1 | -1;
  pos: number;
  baseSpeed: number;
  paintHex: string;
  trim: 'sedan' | 'suv' | 'taxi' | 'police';
  phase: number;
  wheelSpin: number;
}

interface SkyDroneSpec {
  orbitRadius: number;
  altitude: number;
  angle: number;
  speed: number;
  scale: number;
}

const WHEEL_OFFSETS: readonly [number, number, boolean][] = [
  [-0.84, 1.24, true],
  [0.84, 1.24, true],
  [-0.84, -1.22, false],
  [0.84, -1.22, false],
];

/**
 * Multi-mesh clearcoat PBR GTA V vehicle with 4 3D tires/alloy rims, tinted greenhouse,
 * mirrors, grille, headlights, and taillights.
 */
function RealisticVehicleModel({
  paintHex,
  stripeHex,
  sport = false,
  trim = 'sedan',
  wheelRefs,
  steerRefs,
  brakeMatRef,
}: {
  paintHex: string;
  stripeHex?: string;
  sport?: boolean;
  trim?: 'sedan' | 'suv' | 'taxi' | 'police';
  wheelRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  steerRefs?: React.MutableRefObject<(THREE.Group | null)[]>;
  brakeMatRef?: React.RefObject<THREE.MeshStandardMaterial | null>;
}) {
  const cabinHeight = trim === 'suv' ? 0.56 : sport ? 0.36 : 0.44;
  const cabinLength = trim === 'suv' ? 2.25 : sport ? 1.68 : 1.85;
  const bodyHeight = trim === 'suv' ? 0.56 : sport ? 0.42 : 0.48;

  return (
    <group>
      {/* Sculpted Lower Automotive Clearcoat Body */}
      <mesh position={[0, 0.44, 0]} castShadow receiveShadow>
        <boxGeometry args={[1.82, bodyHeight, 4.15]} />
        <meshPhysicalMaterial
          color={paintHex}
          metalness={0.55}
          roughness={0.18}
          clearcoat={1.0}
          clearcoatRoughness={0.07}
          envMapIntensity={1.65}
        />
      </mesh>

      {/* Optional Supercar Racing Stripe */}
      {sport && stripeHex && (
        <mesh position={[0, 0.66, 0.1]}>
          <boxGeometry args={[0.36, 0.02, 3.9]} />
          <meshPhysicalMaterial color={stripeHex} roughness={0.22} clearcoat={1.0} />
        </mesh>
      )}

      {/* Sloped Aerodynamic Front Hood Bevel */}
      <mesh position={[0, 0.62, 1.32]} rotation={[0.12, 0, 0]} castShadow>
        <boxGeometry args={[1.74, 0.12, 1.3]} />
        <meshPhysicalMaterial
          color={paintHex}
          metalness={0.55}
          roughness={0.18}
          clearcoat={1.0}
          clearcoatRoughness={0.07}
          envMapIntensity={1.65}
        />
      </mesh>

      {/* Tinted Reflective Cabin Greenhouse */}
      <mesh position={[0, 0.68 + cabinHeight * 0.45, -0.16]} castShadow>
        <boxGeometry args={[1.52, cabinHeight, cabinLength]} />
        <meshPhysicalMaterial
          color="#0f172a"
          metalness={0.25}
          roughness={0.06}
          clearcoat={1.0}
          envMapIntensity={1.8}
        />
      </mesh>

      {/* Painted Roof Panel */}
      <mesh position={[0, 0.69 + cabinHeight * 0.92, -0.18]} castShadow>
        <boxGeometry args={[1.46, 0.06, cabinLength - 0.28]} />
        <meshPhysicalMaterial
          color={trim === 'police' ? '#f8fafc' : paintHex}
          metalness={0.5}
          roughness={0.2}
          clearcoat={1.0}
        />
      </mesh>

      {/* Taxi Roof Sign or Police Lightbar */}
      {trim === 'taxi' && (
        <mesh position={[0, 1.24, -0.15]}>
          <boxGeometry args={[0.52, 0.16, 0.24]} />
          <meshBasicMaterial color="#fef08a" />
        </mesh>
      )}
      {trim === 'police' && (
        <group position={[0, 1.24, -0.15]}>
          <mesh position={[-0.28, 0, 0]}>
            <boxGeometry args={[0.48, 0.11, 0.22]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
          <mesh position={[0.28, 0, 0]}>
            <boxGeometry args={[0.48, 0.11, 0.22]} />
            <meshBasicMaterial color="#3b82f6" />
          </mesh>
        </group>
      )}

      {/* Supercar Carbon Rear Wing & Front Splitter */}
      {sport && (
        <>
          <mesh position={[0, 0.88, -1.92]} castShadow>
            <boxGeometry args={[1.76, 0.05, 0.32]} />
            <meshStandardMaterial color="#18181b" metalness={0.5} roughness={0.32} />
          </mesh>
          <mesh position={[-0.58, 0.75, -1.9]}>
            <boxGeometry args={[0.06, 0.24, 0.22]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0.58, 0.75, -1.9]}>
            <boxGeometry args={[0.06, 0.24, 0.22]} />
            <meshStandardMaterial color="#18181b" />
          </mesh>
          <mesh position={[0, 0.22, 2.1]}>
            <boxGeometry args={[1.84, 0.06, 0.18]} />
            <meshStandardMaterial color="#18181b" roughness={0.4} />
          </mesh>
        </>
      )}

      {/* Front Dark Radiator Grille + Xenon Projector Headlights */}
      <mesh position={[0, 0.38, 2.08]}>
        <boxGeometry args={[1.05, 0.22, 0.04]} />
        <meshStandardMaterial color="#09090b" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[-0.64, 0.48, 2.08]}>
        <boxGeometry args={[0.34, 0.13, 0.04]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>
      <mesh position={[0.64, 0.48, 2.08]}>
        <boxGeometry args={[0.34, 0.13, 0.04]} />
        <meshBasicMaterial color="#f8fafc" />
      </mesh>

      {/* Rear Taillights + License Plate */}
      <mesh position={[-0.62, 0.5, -2.08]}>
        <boxGeometry args={[0.42, 0.13, 0.04]} />
        {brakeMatRef ? (
          <meshStandardMaterial
            ref={brakeMatRef}
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={1.2}
          />
        ) : (
          <meshBasicMaterial color="#dc2626" />
        )}
      </mesh>
      <mesh position={[0.62, 0.5, -2.08]}>
        <boxGeometry args={[0.42, 0.13, 0.04]} />
        {brakeMatRef ? (
          <meshStandardMaterial
            color="#dc2626"
            emissive="#ef4444"
            emissiveIntensity={1.2}
          />
        ) : (
          <meshBasicMaterial color="#dc2626" />
        )}
      </mesh>
      <mesh position={[0, 0.36, -2.08]}>
        <boxGeometry args={[0.38, 0.16, 0.03]} />
        <meshStandardMaterial color="#f1f5f9" roughness={0.4} />
      </mesh>

      {/* 4 3D Rubber Tires & Brushed Alloy Rims */}
      {WHEEL_OFFSETS.map(([wx, wz, isFront], wIdx) => (
        <group
          key={wIdx}
          position={[wx, 0.33, wz]}
          ref={(el) => {
            if (isFront && steerRefs) steerRefs.current[wIdx] = el;
          }}
        >
          <group
            ref={(el) => {
              if (wheelRefs) wheelRefs.current[wIdx] = el;
            }}
          >
            {/* Rubber Tire */}
            <mesh rotation={[0, 0, Math.PI / 2]} castShadow>
              <cylinderGeometry args={[0.33, 0.33, 0.26, 18]} />
              <meshStandardMaterial color="#18181b" roughness={0.85} />
            </mesh>
            {/* Alloy Rim */}
            <mesh rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.21, 0.21, 0.27, 12]} />
              <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        </group>
      ))}
    </group>
  );
}

function DrivableSupercarInstance({ index }: { index: number }) {
  const car = DRIVABLE_CARS[index];
  const groupRef = useRef<THREE.Group>(null);
  const wheelRefs = useRef<(THREE.Group | null)[]>([]);
  const steerRefs = useRef<(THREE.Group | null)[]>([]);
  const brakeMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const promptWrapRef = useRef<HTMLDivElement>(null);

  useFrame(() => {
    const grp = groupRef.current;
    if (!grp) return;
    grp.position.set(car.x, car.y, car.z);
    grp.rotation.set(0, car.yaw, 0);

    for (let w = 0; w < 4; w++) {
      const steerGrp = steerRefs.current[w];
      if (steerGrp) steerGrp.rotation.y = car.steerAngle;
      const spinGrp = wheelRefs.current[w];
      if (spinGrp) spinGrp.rotation.x = car.wheelSpin;
    }

    if (brakeMatRef.current) {
      brakeMatRef.current.emissiveIntensity = car.braking ? 3.5 : 1.0;
    }

    if (promptWrapRef.current) {
      const show =
        !playerTelemetry.inVehicleId &&
        playerTelemetry.nearbyVehicleName === car.name;
      promptWrapRef.current.style.display = show ? 'block' : 'none';
    }
  });

  return (
    <group ref={groupRef} position={[car.x, car.y, car.z]} rotation={[0, car.yaw, 0]}>
      <RealisticVehicleModel
        paintHex={car.paintHex}
        stripeHex={car.stripeHex}
        sport
        wheelRefs={wheelRefs}
        steerRefs={steerRefs}
        brakeMatRef={brakeMatRef}
      />

      {/* Diegetic GTA V Vehicle Entry Prompt */}
      <Html position={[0, 1.75, 0]} center distanceFactor={14} zIndexRange={[10, 0]}>
        <div
          ref={promptWrapRef}
          style={{ display: 'none' }}
          className="pointer-events-none whitespace-nowrap rounded bg-zinc-950/92 px-2.5 py-1 text-xs font-bold text-white shadow-xl border border-zinc-700"
        >
          Press <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] font-black text-zinc-950">F</span> to drive{' '}
          <span className="text-lime-400">{car.name}</span>
        </div>
      </Html>
    </group>
  );
}

export function TrafficAndDrones() {
  const trafficMode = useGameStore((s) => s.worldChanges.traffic_mode);
  const spawnDrones = useGameStore((s) => s.worldChanges.spawn_drones);

  const carRefs = useRef<(THREE.Group | null)[]>([]);
  const droneRefs = useRef<(THREE.Group | null)[]>([]);

  const cars = useMemo<TrafficCarSpec[]>(() => {
    const lanes: { axis: 'ns' | 'ew'; laneCoord: number; dir: 1 | -1 }[] = [
      { axis: 'ns', laneCoord: -15.6, dir: 1 },
      { axis: 'ns', laneCoord: -12.4, dir: -1 },
      { axis: 'ns', laneCoord: 12.4, dir: 1 },
      { axis: 'ns', laneCoord: 15.6, dir: -1 },
      { axis: 'ew', laneCoord: -15.6, dir: 1 },
      { axis: 'ew', laneCoord: -12.4, dir: -1 },
      { axis: 'ew', laneCoord: 12.4, dir: 1 },
      { axis: 'ew', laneCoord: 15.6, dir: -1 },
    ];
    const paints = [
      { hex: '#f8fafc', trim: 'sedan' as const },
      { hex: '#1e293b', trim: 'suv' as const },
      { hex: '#eab308', trim: 'taxi' as const },
      { hex: '#b91c1c', trim: 'sedan' as const },
      { hex: '#111827', trim: 'police' as const },
      { hex: '#64748b', trim: 'suv' as const },
      { hex: '#1d4ed8', trim: 'sedan' as const },
    ];

    return Array.from({ length: 14 }, (_, idx) => {
      const l = lanes[idx % lanes.length];
      const p = paints[idx % paints.length];
      return {
        axis: l.axis,
        laneCoord: l.laneCoord,
        dir: l.dir,
        pos: -50 + ((idx * 17) % 100),
        baseSpeed: 9.5 + (idx % 3) * 1.8,
        paintHex: p.hex,
        trim: p.trim,
        phase: idx * 0.9,
        wheelSpin: 0,
      };
    });
  }, []);

  const drones = useMemo<SkyDroneSpec[]>(() => {
    return Array.from({ length: WORLD_LIMITS.MAX_DRONES }, (_, i) => ({
      orbitRadius: 11 + (i % 5) * 6.5,
      altitude: 11.5 + (i % 4) * 2.5,
      angle: (i / WORLD_LIMITS.MAX_DRONES) * Math.PI * 2,
      speed: (0.42 + (i % 3) * 0.16) * (i % 2 === 0 ? 1 : -1),
      scale: 0.001,
    }));
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const t = clock.getElapsedTime();

    const speedMult =
      trafficMode === 'chaos'
        ? 2.2
        : trafficMode === 'hyperloop'
          ? 1.75
          : trafficMode === 'gridlock'
            ? 0.22
            : 1.0;

    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const stepDist = c.dir * c.baseSpeed * speedMult * dt;
      c.pos += stepDist;
      if (c.pos > 54) c.pos = -54;
      if (c.pos < -54) c.pos = 54;

      const swerve =
        trafficMode === 'chaos' ? Math.sin(t * 7.5 + c.phase) * 0.85 : 0;

      const grp = carRefs.current[i];
      if (!grp) continue;

      if (c.axis === 'ns') {
        grp.position.set(c.laneCoord + swerve, 0, c.pos);
        grp.rotation.y = c.dir === 1 ? 0 : Math.PI;
        grp.rotation.z = trafficMode === 'chaos' ? Math.sin(t * 9 + c.phase) * 0.04 : 0;
      } else {
        grp.position.set(c.pos, 0, c.laneCoord + swerve);
        grp.rotation.y = c.dir === 1 ? Math.PI / 2 : -Math.PI / 2;
        grp.rotation.z = trafficMode === 'chaos' ? Math.sin(t * 9 + c.phase) * 0.04 : 0;
      }
    }

    // Autonomous Quad-Rotor News / Surveillance Drones
    for (let i = 0; i < drones.length; i++) {
      const d = drones[i];
      const active = i < spawnDrones;
      const grp = droneRefs.current[i];
      if (!grp) continue;

      d.scale = THREE.MathUtils.lerp(d.scale, active ? 1 : 0.001, 1 - Math.exp(-6 * dt));
      grp.visible = d.scale > 0.04;
      if (!grp.visible) continue;

      grp.scale.setScalar(d.scale);
      d.angle += d.speed * dt;
      const dx = Math.cos(d.angle) * d.orbitRadius;
      const dz = Math.sin(d.angle) * d.orbitRadius;
      const dy = d.altitude + Math.sin(t * 2.4 + i) * 0.45;

      grp.position.set(dx, dy, dz);
      grp.rotation.y = -d.angle;

      playerTelemetry.entityBlips.push({ x: dx, z: dz, kind: 'drone' });
    }

    // Add parked/drivable GTA supercars onto radar blips
    for (const sc of DRIVABLE_CARS) {
      if (sc.id !== playerTelemetry.inVehicleId) {
        playerTelemetry.entityBlips.push({ x: sc.x, z: sc.z, kind: 'car' });
      }
    }
  });

  return (
    <group name="RealisticTrafficAndSupercars">
      {/* 3 Parked & Drivable GTA V Supercars (`F` to Enter/Exit) */}
      {DRIVABLE_CARS.map((sc, idx) => (
        <DrivableSupercarInstance key={sc.id} index={idx} />
      ))}

      {/* Autonomous Boulevard Traffic Vehicles */}
      {cars.map((c, idx) => (
        <group
          key={`traffic-${idx}`}
          ref={(el) => {
            carRefs.current[idx] = el;
          }}
        >
          <RealisticVehicleModel paintHex={c.paintHex} trim={c.trim} />
        </group>
      ))}

      {/* Quad-Rotor Aerial News / Security Drones */}
      {drones.map((_, idx) => (
        <group
          key={`drone-${idx}`}
          ref={(el) => {
            droneRefs.current[idx] = el;
          }}
          visible={false}
        >
          {/* Carbon-Fiber Quadcopter Fuselage */}
          <mesh castShadow>
            <boxGeometry args={[0.55, 0.18, 0.75]} />
            <meshStandardMaterial color="#1e293b" metalness={0.75} roughness={0.3} />
          </mesh>
          {/* 4 Rotor Booms + Rotor Discs */}
          {[
            [-0.48, -0.48],
            [0.48, -0.48],
            [-0.48, 0.48],
            [0.48, 0.48],
          ].map(([rx, rz], rIdx) => (
            <group key={rIdx} position={[rx, 0.06, rz]}>
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.18, 0.25, 16]} />
                <meshBasicMaterial color="#94a3b8" side={THREE.DoubleSide} />
              </mesh>
            </group>
          ))}
          {/* Gimbal Spotlight Cone */}
          <mesh position={[0, -5.2, 0]}>
            <coneGeometry args={[2.0, 10.4, 16, 1, true]} />
            <meshBasicMaterial
              color="#fef9c3"
              transparent
              opacity={0.09}
              side={THREE.DoubleSide}
              depthWrite={false}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
