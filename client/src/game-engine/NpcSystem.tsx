import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { WORLD_LIMITS } from '@webworld/shared';
import { SIDEWALK_BLOCKS, resolveCityCollision } from './cityLayout';
import {
  loadMan,
  styleAsStreetPedestrian,
  type PedestrianPalette,
} from './figure/man';
import { useGameStore } from '../state/gameStore';
import { playerTelemetry } from '../state/playerTelemetry';

interface CitizenAgent {
  x: number;
  z: number;
  vx: number;
  vz: number;
  yaw: number;
  retargetTimer: number;
  palette: PedestrianPalette;
  mixer?: THREE.AnimationMixer;
  actions?: {
    walk: THREE.AnimationAction;
    jog: THREE.AnimationAction;
    run: THREE.AnimationAction;
  };
  activeMode?: 'walk' | 'jog' | 'run';
  object?: THREE.Group;
}

interface RobotAgent {
  x: number;
  z: number;
  yaw: number;
  state: 'patrol' | 'chase';
  targetX: number;
  targetZ: number;
  scale: number;
  phase: number;
  stateTimer: number;
}

const CITIZEN_COUNT = 12;

const PEDESTRIAN_PALETTES: readonly PedestrianPalette[] = [
  { topHex: '#cbd5e1', bottomHex: '#1e293b', skinHex: '#e0ac69', hairHex: '#27272a', shoeHex: '#f8fafc' },
  { topHex: '#1d4ed8', bottomHex: '#334155', skinHex: '#8d5524', hairHex: '#18181b', shoeHex: '#111827' },
  { topHex: '#991b1b', bottomHex: '#1f2937', skinHex: '#f1c27d', hairHex: '#78350f', shoeHex: '#e2e8f0' },
  { topHex: '#3f6212', bottomHex: '#292524', skinHex: '#c68642', hairHex: '#1c1917', shoeHex: '#18181b' },
  { topHex: '#334155', bottomHex: '#475569', skinHex: '#ffdbac', hairHex: '#92400e', shoeHex: '#0f172a' },
  { topHex: '#d97706', bottomHex: '#1e293b', skinHex: '#c68642', hairHex: '#27272a', shoeHex: '#f1f5f9' },
];

const SAFE_SPAWN_RING: readonly [number, number][] = [
  [-8.5, -7.5],
  [8.5, -7.5],
  [-8.5, 7.5],
  [8.5, 7.5],
  [-19, -8.5],
  [19, -8.5],
  [-19, 8.5],
  [19, 8.5],
  [-8.5, -20],
  [8.5, -20],
  [-8.5, 20],
  [8.5, 20],
  [-21, -24],
  [21, -24],
  [-21, 24],
  [21, 24],
];

function groundYAt(x: number, z: number): number {
  for (const blk of SIDEWALK_BLOCKS) {
    if (Math.abs(x - blk.x) <= blk.width * 0.5 && Math.abs(z - blk.z) <= blk.depth * 0.5) {
      return 0.16;
    }
  }
  return 0.0;
}

export function NpcSystem() {
  const { scene } = useThree();
  const npcMood = useGameStore((s) => s.worldChanges.npc_mood);
  const spawnRobots = useGameStore((s) => s.worldChanges.spawn_robots);

  const robotRefs = useRef<(THREE.Group | null)[]>([]);
  const legLeftRefs = useRef<(THREE.Mesh | null)[]>([]);
  const legRightRefs = useRef<(THREE.Mesh | null)[]>([]);
  const armLeftRefs = useRef<(THREE.Mesh | null)[]>([]);
  const armRightRefs = useRef<(THREE.Mesh | null)[]>([]);

  const citizens = useMemo<CitizenAgent[]>(() => {
    return Array.from({ length: CITIZEN_COUNT }, (_, i) => {
      const [sx, sz] = SAFE_SPAWN_RING[i % SAFE_SPAWN_RING.length];
      const angle = (i * 1.7) % (Math.PI * 2);
      return {
        x: sx,
        z: sz,
        vx: Math.cos(angle),
        vz: Math.sin(angle),
        yaw: Math.atan2(Math.cos(angle), Math.sin(angle)),
        retargetTimer: 2.0 + (i % 4) * 0.8,
        palette: PEDESTRIAN_PALETTES[i % PEDESTRIAN_PALETTES.length],
      };
    });
  }, []);

  // Mount CC0 rigged mocap street pedestrians (`threejs-gltf-loading` SkeletonUtils.clone)
  useEffect(() => {
    let cancelled = false;
    const pedGroup = new THREE.Group();
    pedGroup.name = 'RiggedStreetPedestrians';
    scene.add(pedGroup);

    void (async () => {
      for (let i = 0; i < citizens.length; i++) {
        const man = await loadMan('/figure/');
        if (cancelled) return;

        const c = citizens[i];
        styleAsStreetPedestrian(man.object, c.palette);
        man.object.position.set(c.x, groundYAt(c.x, c.z), c.z);
        man.object.rotation.y = c.yaw;
        pedGroup.add(man.object);

        const mixer = new THREE.AnimationMixer(man.object);
        const walk = mixer.clipAction(man.clips.Walk);
        const jog = mixer.clipAction(man.clips.Jog);
        const run = mixer.clipAction(man.clips.Run);

        walk.play();
        walk.setEffectiveWeight(1);
        walk.time = (i * 0.37) % man.clips.Walk.duration;

        jog.play();
        jog.setEffectiveWeight(0);
        run.play();
        run.setEffectiveWeight(0);

        c.object = man.object;
        c.mixer = mixer;
        c.actions = { walk, jog, run };
        c.activeMode = 'walk';
      }
    })();

    return () => {
      cancelled = true;
      scene.remove(pedGroup);
      for (const c of citizens) {
        c.mixer?.stopAllAction();
        c.object = undefined;
        c.mixer = undefined;
        c.actions = undefined;
      }
    };
  }, [citizens, scene]);

  const robots = useMemo<RobotAgent[]>(() => {
    return Array.from({ length: WORLD_LIMITS.MAX_ROBOTS }, (_, i) => {
      const [sx, sz] = SAFE_SPAWN_RING[(i + 3) % SAFE_SPAWN_RING.length];
      return {
        x: sx * 1.04,
        z: sz * 1.04,
        yaw: 0,
        state: 'patrol',
        targetX: -sx,
        targetZ: -sz,
        scale: 0.01,
        phase: i * 1.1,
        stateTimer: 0,
      };
    });
  }, []);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 0.05);

    // 1. Update Rigged Street Pedestrians with mocap gait matching
    const wantMode: 'walk' | 'jog' | 'run' =
      npcMood === 'panic'
        ? 'run'
        : npcMood === 'celebrate' || npcMood === 'protest'
          ? 'jog'
          : 'walk';

    const citizenSpeed =
      wantMode === 'run' ? 5.2 : wantMode === 'jog' ? 3.4 : 1.48;

    for (let i = 0; i < citizens.length; i++) {
      const c = citizens[i];
      c.retargetTimer -= dt;

      if (c.retargetTimer <= 0) {
        c.retargetTimer =
          npcMood === 'panic' ? 1.2 + Math.random() * 1.4 : 3.2 + Math.random() * 3.0;
        const angle = Math.random() * Math.PI * 2;
        c.vx = Math.cos(angle);
        c.vz = Math.sin(angle);
      }

      const nextX = c.x + c.vx * citizenSpeed * dt;
      const nextZ = c.z + c.vz * citizenSpeed * dt;
      const [rx, rz] = resolveCityCollision(nextX, nextZ, 0.45);

      if (Math.abs(rx - nextX) > 0.01 || Math.abs(rz - nextZ) > 0.01) {
        c.vx = -c.vx;
        c.vz = -c.vz;
      }

      c.x = rx;
      c.z = rz;
      const targetYaw = Math.atan2(c.vx, c.vz);
      const dyaw = Math.atan2(Math.sin(targetYaw - c.yaw), Math.cos(targetYaw - c.yaw));
      c.yaw += dyaw * (1 - Math.exp(-8 * dt));

      if (c.object && c.mixer && c.actions) {
        const gy = groundYAt(c.x, c.z);
        c.object.position.x = c.x;
        c.object.position.z = c.z;
        c.object.position.y = THREE.MathUtils.lerp(c.object.position.y, gy, 1 - Math.exp(-14 * dt));
        c.object.rotation.y = c.yaw;

        // Smooth mocap clip weight blend
        for (const key of ['walk', 'jog', 'run'] as const) {
          const act = c.actions[key];
          const w = act.getEffectiveWeight();
          act.setEffectiveWeight(
            THREE.MathUtils.lerp(w, key === wantMode ? 1 : 0, 1 - Math.exp(-6 * dt))
          );
        }
        c.mixer.update(dt);
      }
    }

    // 2. Update Articulated Autonomous Security Androids (`game-ai` FSM with hysteresis)
    const blips = playerTelemetry.entityBlips;
    blips.length = 0;

    for (let i = 0; i < robots.length; i++) {
      const r = robots[i];
      const active = i < spawnRobots;
      const grp = robotRefs.current[i];
      if (!grp) continue;

      const targetScale = active ? 1 : 0.001;
      r.scale = THREE.MathUtils.lerp(r.scale, targetScale, 1 - Math.exp(-8 * dt));
      grp.visible = r.scale > 0.03;
      if (!grp.visible) continue;

      grp.scale.setScalar(r.scale);
      r.stateTimer += dt;

      const dxPlayer = playerTelemetry.x - r.x;
      const dzPlayer = playerTelemetry.z - r.z;
      const distSqPlayer = dxPlayer * dxPlayer + dzPlayer * dzPlayer;

      if (r.state === 'patrol' && distSqPlayer < 225 && r.stateTimer > 0.5) {
        r.state = 'chase';
        r.stateTimer = 0;
      } else if (r.state === 'chase' && distSqPlayer > 484 && r.stateTimer > 0.5) {
        r.state = 'patrol';
        r.stateTimer = 0;
      }

      let goalX = r.targetX;
      let goalZ = r.targetZ;
      let speed = 3.4;

      if (r.state === 'chase') {
        goalX = playerTelemetry.x;
        goalZ = playerTelemetry.z;
        speed = 5.4;
      } else {
        const dGoal = Math.hypot(r.targetX - r.x, r.targetZ - r.z);
        if (dGoal < 2.0) {
          const pick = SAFE_SPAWN_RING[Math.floor(Math.random() * SAFE_SPAWN_RING.length)];
          r.targetX = pick[0];
          r.targetZ = pick[1];
        }
      }

      const toX = goalX - r.x;
      const toZ = goalZ - r.z;
      const distGoal = Math.hypot(toX, toZ);
      let moving = false;

      if (distGoal > 2.1) {
        moving = true;
        const dirX = toX / distGoal;
        const dirZ = toZ / distGoal;
        const [rx, rz] = resolveCityCollision(
          r.x + dirX * speed * dt,
          r.z + dirZ * speed * dt,
          0.55
        );
        r.x = rx;
        r.z = rz;
        r.yaw = Math.atan2(dirX, dirZ);
      }

      r.phase += dt * (moving ? speed * 2.4 : 1.5);
      const swing = moving ? Math.sin(r.phase) * 0.55 : 0;

      if (legLeftRefs.current[i]) legLeftRefs.current[i]!.rotation.x = swing;
      if (legRightRefs.current[i]) legRightRefs.current[i]!.rotation.x = -swing;
      if (armLeftRefs.current[i]) armLeftRefs.current[i]!.rotation.x = -swing * 0.7;
      if (armRightRefs.current[i]) armRightRefs.current[i]!.rotation.x = swing * 0.7;

      const gy = groundYAt(r.x, r.z);
      grp.position.set(r.x, gy, r.z);
      grp.rotation.y = r.yaw;

      blips.push({ x: r.x, z: r.z, kind: 'robot' });
    }
  });

  return (
    <group name="AutonomousAndroidPopulation">
      {/* Articulated Titanium/White Humanoid Security Androids */}
      {robots.map((r, idx) => (
        <group
          key={`bot-${idx}`}
          ref={(el) => {
            robotRefs.current[idx] = el;
          }}
          position={[r.x, 0.16, r.z]}
          visible={false}
        >
          {/* Legs */}
          <mesh
            ref={(el) => {
              legLeftRefs.current[idx] = el;
            }}
            position={[-0.14, 0.45, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.075, 0.65, 4, 8]} />
            <meshPhysicalMaterial
              color="#334155"
              metalness={0.85}
              roughness={0.22}
              clearcoat={0.6}
            />
          </mesh>
          <mesh
            ref={(el) => {
              legRightRefs.current[idx] = el;
            }}
            position={[0.14, 0.45, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.075, 0.65, 4, 8]} />
            <meshPhysicalMaterial
              color="#334155"
              metalness={0.85}
              roughness={0.22}
              clearcoat={0.6}
            />
          </mesh>

          {/* White/Titanium Armored Android Torso */}
          <mesh position={[0, 1.16, 0]} castShadow>
            <boxGeometry args={[0.46, 0.58, 0.28]} />
            <meshPhysicalMaterial
              color="#e2e8f0"
              metalness={0.65}
              roughness={0.18}
              clearcoat={0.85}
            />
          </mesh>

          {/* Articulated Arms */}
          <mesh
            ref={(el) => {
              armLeftRefs.current[idx] = el;
            }}
            position={[-0.31, 1.12, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.06, 0.52, 4, 8]} />
            <meshPhysicalMaterial color="#475569" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh
            ref={(el) => {
              armRightRefs.current[idx] = el;
            }}
            position={[0.31, 1.12, 0]}
            castShadow
          >
            <capsuleGeometry args={[0.06, 0.52, 4, 8]} />
            <meshPhysicalMaterial color="#475569" metalness={0.85} roughness={0.25} />
          </mesh>

          {/* Chest Status Core */}
          <mesh position={[0, 1.2, 0.145]}>
            <circleGeometry args={[0.07, 16]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>

          {/* Sleek Android Helmet + Crimson Sensor Visor */}
          <mesh position={[0, 1.62, 0]} castShadow>
            <sphereGeometry args={[0.15, 16, 14]} />
            <meshPhysicalMaterial
              color="#f8fafc"
              metalness={0.7}
              roughness={0.15}
              clearcoat={1.0}
            />
          </mesh>
          <mesh position={[0, 1.63, 0.125]}>
            <boxGeometry args={[0.21, 0.06, 0.05]} />
            <meshStandardMaterial
              color="#ef4444"
              emissive="#ef4444"
              emissiveIntensity={2.8}
            />
          </mesh>
        </group>
      ))}
    </group>
  );
}
