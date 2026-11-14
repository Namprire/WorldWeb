import { Billboard } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import { Color } from 'three';
import type { AmbientLight, Fog, Group, HemisphereLight, PointLight } from 'three';
import { useGameStore } from '../game/state';
import { LOCATIONS } from '../shared/locations';
import type { MissionStep } from '../shared/schema';
import { Actors } from './Actors';
import { City } from './City';
import { Player } from './Player';
import { Label } from './Label';

const themes = {
  calm: { sky: '#161329', fog: '#1a1530', rim: '#c094ff', fill: '#86c8ff', accent: '#ce9fff', strength: 65 },
  emergency: { sky: '#320e20', fog: '#3f142a', rim: '#ff4663', fill: '#ffa5a8', accent: '#ff5f7e', strength: 195 },
  market: { sky: '#2e1625', fog: '#361626', rim: '#ff7366', fill: '#ff9880', accent: '#ff795f', strength: 155 },
  breakthrough: { sky: '#0c263b', fog: '#123654', rim: '#66eaff', fill: '#8ed5ff', accent: '#63edff', strength: 220 },
};

function Atmosphere({ theme, emergency }: { theme: typeof themes.calm; emergency: boolean }) {
  const fog = useRef<Fog>(null);
  const hemisphere = useRef<HemisphereLight>(null);
  const ambient = useRef<AmbientLight>(null);
  const beacon = useRef<PointLight>(null);
  const palette = useMemo(() => ({
    sky: new Color(theme.sky),
    fog: new Color(theme.fog),
    rim: new Color(theme.rim),
    fill: new Color(theme.fill),
  }), [theme]);
  useFrame(({ scene, clock }, dt) => {
    const blend = 1 - Math.exp(-dt * 1.7);
    if (scene.background instanceof Color) scene.background.lerp(palette.sky, blend);
    fog.current?.color.lerp(palette.fog, blend);
    hemisphere.current?.color.lerp(palette.fill, blend);
    ambient.current?.color.lerp(palette.fill, blend);
    if (beacon.current) {
      beacon.current.color.lerp(palette.rim, blend);
      const strength = theme.strength * (emergency ? 1 + Math.sin(clock.elapsedTime * 6.5) * 0.23 : 1);
      beacon.current.intensity += (strength - beacon.current.intensity) * blend;
    }
  });
  return <>
    <color attach="background" args={[themes.calm.sky]} />
    <fog ref={fog} attach="fog" args={[themes.calm.fog, 18, 79]} />
    <hemisphereLight ref={hemisphere} args={['#9cbeff', '#55407b', 1.65]} />
    <ambientLight ref={ambient} color="#a19fff" intensity={0.56} />
    <directionalLight color="#b9b3f6" position={[3, 12, 8]} intensity={1.55} />
    <pointLight ref={beacon} position={[0, 7.2, -1.9]} color={themes.calm.rim} intensity={65} distance={52} decay={2} />
    <pointLight position={[5.6, 3.5, 11]} color="#4378ff" intensity={43} distance={20} decay={2} />
    <pointLight position={[-6, 3.5, 11]} color="#de5ee8" intensity={42} distance={18} decay={2} />
  </>;
}

function ObjectiveProp({ action }: { action: MissionStep['action'] }) {
  if (action === 'collect') return <group rotation-y={0.35}>
    <mesh position={[0, 0.23, 0]}>
      <boxGeometry args={[0.74, 0.46, 0.56]} />
      <meshStandardMaterial color="#515b70" metalness={0.65} roughness={0.42} />
    </mesh>
    {[-0.23, 0.23].map((x) => <mesh key={x} position={[x, 0.466, 0]}>
      <boxGeometry args={[0.075, 0.02, 0.57]} /><meshBasicMaterial color="#ffe193" />
    </mesh>)}
    <mesh position={[0, 0.26, 0.283]}>
      <planeGeometry args={[0.33, 0.1]} /><meshBasicMaterial color="#c1f7ee" />
    </mesh>
  </group>;

  const color = action === 'deliver' ? '#b8ffb4' : '#9aeaff';
  return <group>
    <mesh position={[0, 0.08, 0]}>
      <boxGeometry args={[0.62, 0.16, 0.57]} /><meshStandardMaterial color="#4c5269" />
    </mesh>
    <mesh position={[0, 0.38, 0]}>
      <boxGeometry args={[0.31, 0.65, 0.33]} /><meshStandardMaterial color="#292f42" />
    </mesh>
    <group position={[0, 0.8, 0]} rotation-x={-0.47}>
      <mesh><boxGeometry args={[0.66, 0.38, 0.15]} /><meshStandardMaterial color="#49526c" /></mesh>
      <mesh position={[0, 0.015, 0.081]}>
        <planeGeometry args={[0.52, 0.24]} /><meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
    </group>
  </group>;
}

function Marker({ x, z, label, color, action }: { x: number; z: number; label: string; color: string; action: MissionStep['action'] }) {
  const diamond = useRef<Group>(null);
  const ring = useRef<Group>(null);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    if (diamond.current) {
      diamond.current.rotation.y = t * 0.82;
      diamond.current.position.y = 2.26 + 0.16 * Math.sin(t * 2.4);
    }
    if (ring.current) ring.current.scale.setScalar(1 + Math.sin(t * 2.4) * 0.09);
  });
  return <group position={[x, 0.052, z]}>
    <ObjectiveProp action={action} />
    <group ref={ring}>
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.82, 0.94, 32]} /><meshBasicMaterial color={color} toneMapped={false} />
      </mesh>
      <mesh position={[0, -0.004, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[0.9, 32]} /><meshBasicMaterial color={color} transparent opacity={0.16} depthWrite={false} />
      </mesh>
    </group>
    <mesh position={[0, 0.96, 0]}>
      <cylinderGeometry args={[0.42, 0.79, 1.94, 16, 1, true]} /><meshBasicMaterial color={color} transparent opacity={0.15} depthWrite={false} side={2} />
    </mesh>
    <group ref={diamond} position={[0, 2.25, 0]}>
      <mesh><octahedronGeometry args={[0.41, 0]} /><meshBasicMaterial color={color} toneMapped={false} /></mesh>
      <mesh><octahedronGeometry args={[0.59, 0]} /><meshBasicMaterial color={color} wireframe transparent opacity={0.66} depthWrite={false} /></mesh>
    </group>
    <Billboard position={[0, 3.1, 0]}>
      <Label lines={[label.toUpperCase()]} width={2.85} height={0.43} color={color} background="#131026" fontSize={37} />
    </Billboard>
  </group>;
}

function Scene() {
  const scenario = useGameStore(state => state.scenario);
  const status = useGameStore(state => state.mission.status);
  const step = useGameStore(state => state.mission.steps[state.mission.stepIndex]);
  const active = scenario && status === 'active';
  const world = active ? scenario.worldChanges : null;
  const theme = themes[world?.atmosphere ?? 'calm'];
  const targetLocation = status === 'active' && step ? LOCATIONS[step.location] : undefined;
  return <>
    <Atmosphere theme={theme} emergency={world?.atmosphere === 'emergency'} />
    <City message={world?.billboardText ?? (status === 'complete' ? 'CITY SYSTEMS RESTORED' : 'THE INTERNET IS A CITY')} color={theme.accent} active={Boolean(active)} />
    <Actors mood={world?.npcMood ?? 'calm'} chaos={world?.trafficMode === 'chaos'} robots={world?.spawnRobots ?? 0} drones={world?.spawnDrones ?? 0} />
    {targetLocation && step && <Marker x={targetLocation.x} z={targetLocation.z} label={targetLocation.label} action={step.action} color="#ffe193" />}
    <Player />
  </>;
}

export function World() {
  return <div className="world" style={{ position: 'absolute', inset: 0, touchAction: 'none' }}>
    <Canvas camera={{ fov: 54, near: 0.08, far: 150, position: [1.55, 3.17, 19.6] }}
      dpr={[1, 1.5]} gl={{ alpha: false, antialias: true, powerPreference: 'high-performance' }}>
      <Scene />
    </Canvas>
  </div>;
}
