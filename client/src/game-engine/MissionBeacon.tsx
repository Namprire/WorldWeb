import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { CITY_LANDMARKS } from '@webworld/shared';
import { useGameStore } from '../state/gameStore';

export function MissionBeacon() {
  const activeMission = useGameStore((s) => s.activeMission);
  const cylinderRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (ringRef.current) {
      const pulse = 1 + Math.sin(t * 4.2) * 0.06;
      ringRef.current.scale.set(pulse, pulse, 1);
    }
    if (cylinderRef.current) {
      const mat = cylinderRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.28 + Math.sin(t * 3.5) * 0.08;
    }
  });

  if (!activeMission || activeMission.status !== 'active') {
    return null;
  }

  const landmark = CITY_LANDMARKS[activeMission.spec.target_landmark];
  const [bx, , bz] = landmark.beaconPosition;

  return (
    <group position={[bx, 0.16, bz]} name="ActiveMissionCorona">
      {/* Classic GTA V Glowing Yellow Ground Corona Cylinder */}
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.03, 0]}
      >
        <ringGeometry args={[1.65, 2.15, 40]} />
        <meshBasicMaterial
          color="#facc15"
          transparent
          opacity={0.95}
          side={THREE.DoubleSide}
        />
      </mesh>

      <mesh ref={cylinderRef} position={[0, 1.35, 0]}>
        <cylinderGeometry args={[1.9, 1.9, 2.7, 36, 1, true]} />
        <meshBasicMaterial
          color="#eab308"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Clean GTA V Objective Marker Tag */}
      <Html position={[0, 3.6, 0]} center distanceFactor={18} zIndexRange={[10, 0]}>
        <div className="pointer-events-none whitespace-nowrap rounded bg-zinc-950/90 px-3 py-1 text-center border-l-4 border-yellow-400 shadow-xl">
          <div className="text-[10px] font-extrabold tracking-wider text-yellow-400 uppercase">
            {activeMission.spec.action_label}
          </div>
          <div className="text-xs font-bold text-white">{landmark.name}</div>
        </div>
      </Html>
    </group>
  );
}
