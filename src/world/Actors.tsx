import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { MathUtils } from 'three';
import type { Group } from 'three';
import { variation } from './layout';

type Mood = 'calm' | 'panic' | 'excited';

function Box({ at, size, color, lit = false, angle = 0 }: {
  at: [number, number, number];
  size: [number, number, number];
  color: string;
  lit?: boolean;
  angle?: number;
}) {
  return <mesh position={at} rotation={[0, 0, angle]}>
    <boxGeometry args={size} />
    {lit ? <meshBasicMaterial color={color} toneMapped={false} /> : <meshStandardMaterial color={color} roughness={0.64} metalness={0.25} />}
  </mesh>;
}

export function Human({ hero = false, tint = '#695478', speed }: { hero?: boolean; tint?: string; speed: () => number }) {
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);
  const armLeft = useRef<Group>(null);
  const armRight = useRef<Group>(null);
  const hips = useRef<Group>(null);
  const stride = useRef(0);
  useFrame((_, dt) => {
    const rate = speed();
    stride.current += dt * rate * 2.25;
    const weight = Math.min(rate * 0.6, 1);
    const swing = Math.sin(stride.current) * 0.59 * weight;
    if (left.current && right.current && armLeft.current && armRight.current && hips.current) {
      left.current.rotation.x = swing;
      right.current.rotation.x = -swing;
      armLeft.current.rotation.x = -swing * 0.68;
      armRight.current.rotation.x = swing * 0.68;
      hips.current.position.y = (1 - Math.cos(stride.current * 2)) * weight * 0.018;
    }
  });
  const jacket = hero ? '#12121d' : tint;
  const skin = hero ? '#ddaa8e' : '#b88b79';
  return <group ref={hips} scale={hero ? 1.11 : 0.91}>
    <Box at={[0, 1.11, 0]} size={[0.59, 0.71, 0.34]} color={jacket} />
    <Box at={[0, 0.77, 0]} size={[0.49, 0.14, 0.34]} color="#232233" />
    <Box at={[0, 1.48, 0]} size={[0.17, 0.16, 0.16]} color={skin} />
    <mesh position={[0, 1.68, 0.007]} scale={[1, 1.12, 0.9]}>
      <sphereGeometry args={[0.23, 10, 8]} /><meshStandardMaterial color={skin} roughness={0.76} />
    </mesh>
    <mesh position={[0, 1.802, 0.018]} scale={[1.04, 0.57, 0.98]}>
      <sphereGeometry args={[0.24, 11, 8]} /><meshStandardMaterial color={hero ? '#c3c7d2' : '#382b40'} roughness={0.71} />
    </mesh>
    {hero && <>
      <Box at={[-0.196, 1.741, 0.057]} size={[0.066, 0.16, 0.21]} color="#a0a7b5" />
      <Box at={[0.196, 1.741, 0.057]} size={[0.066, 0.16, 0.21]} color="#a0a7b5" />
      <Box at={[0, 1.727, 0.178]} size={[0.27, 0.21, 0.056]} color="#9aa1b0" />
      <Box at={[0, 1.701, -0.21]} size={[0.08, 0.025, 0.03]} color="#171322" />
      {[-1, 1].map(side => <group key={side}>
        <Box at={[side * 0.106, 1.694, -0.209]} size={[0.155, 0.105, 0.035]} color="#1b1725" />
        <Box at={[side * 0.106, 1.697, -0.229]} size={[0.113, 0.064, 0.008]} color="#a4c4db" />
        <Box at={[side * 0.189, 1.7, -0.114]} size={[0.025, 0.02, 0.16]} color="#221e2b" />
        <Box at={[side * 0.155, 1.365, -0.185]} size={[0.077, 0.25, 0.028]} color="#353341" angle={side * -0.4} />
      </group>)}
      <Box at={[0, 1.12, -0.179]} size={[0.025, 0.48, 0.018]} color="#575564" />
      <Box at={[0, 1.35, 0.178]} size={[0.31, 0.035, 0.018]} color="#393748" />
    </>}
    <group ref={armLeft} position={[-0.355, 1.38, 0]}>
      <Box at={[0, -0.22, 0]} size={[0.16, 0.46, 0.22]} color={jacket} angle={-0.1} />
      <Box at={[-0.025, -0.48, 0]} size={[0.13, 0.1, 0.15]} color={skin} />
    </group>
    <group ref={armRight} position={[0.355, 1.38, 0]}>
      <Box at={[0, -0.22, 0]} size={[0.16, 0.46, 0.22]} color={jacket} angle={0.1} />
      <Box at={[0.025, -0.48, 0]} size={[0.13, 0.1, 0.15]} color={skin} />
    </group>
    <group ref={left} position={[-0.139, 0.77, 0]}>
      <Box at={[0, -0.33, 0]} size={[0.21, 0.65, 0.245]} color="#282936" />
      <Box at={[0, -0.692, -0.06]} size={[0.235, 0.145, 0.36]} color="#13131d" />
    </group>
    <group ref={right} position={[0.139, 0.77, 0]}>
      <Box at={[0, -0.33, 0]} size={[0.21, 0.65, 0.245]} color="#282936" />
      <Box at={[0, -0.692, -0.06]} size={[0.235, 0.145, 0.36]} color="#13131d" />
    </group>
  </group>;
}

const walkTints = ['#7757af', '#327b92', '#885070', '#6e638e', '#a46448'];

function Pedestrian({ index, mood }: { index: number; mood: Mood }) {
  const group = useRef<Group>(null);
  const progress = useRef(index * 6.72);
  const pace = useRef(0);
  const side = index % 2 ? 1 : -1;
  useFrame((_, dt) => {
    pace.current = mood === 'panic' ? 3.2 + index % 3 * 0.44 : mood === 'excited' ? 1.95 : 1.04 + variation(index) * 0.33;
    progress.current = (progress.current + dt * pace.current) % 80;
    const track = progress.current < 40 ? progress.current : 80 - progress.current;
    if (group.current) {
      group.current.position.set(side * (5.75 + 0.54 * Math.sin(progress.current * 0.23 + index)), 0.037, 16 - track);
      group.current.rotation.y = progress.current < 40 ? 0 : Math.PI;
    }
  });
  return <group ref={group}><Human tint={walkTints[index % walkTints.length]} speed={() => pace.current} /></group>;
}

function Hovercar({ index, chaos }: { index: number; chaos: boolean }) {
  const group = useRef<Group>(null);
  const distance = useRef((index * 14 + 3) % 53);
  const speed = useRef(3.5);
  const side = index % 2 ? 1 : -1;
  const tint = ['#744996', '#326b96', '#944664', '#445992', '#4e8488'][index % 5];
  useFrame(({ clock }, dt) => {
    speed.current += ((chaos ? 10.5 + index * 0.65 : 3.1 + index * 0.33) - speed.current) * Math.min(1, dt * 2.8);
    distance.current = (distance.current + dt * speed.current) % 53;
    if (group.current) {
      const steer = chaos ? Math.sin(clock.elapsedTime * 3.6 + index) * 0.66 : 0;
      group.current.position.set(side * 2.65 + steer, 0.09 + 0.065 * Math.sin(clock.elapsedTime * 3.2 + index), side > 0 ? 22 - distance.current : -31 + distance.current);
      group.current.rotation.y = (side > 0 ? 0 : Math.PI) + steer * 0.16;
      group.current.rotation.z = steer * 0.13;
    }
  });
  return <group ref={group}>
    <mesh rotation={[-Math.PI / 2, 0, 0]} scale={[1, 2.2, 1]}>
      <circleGeometry args={[0.74, 12]} /><meshBasicMaterial color="#a067ff" transparent opacity={0.17} depthWrite={false} />
    </mesh>
    <Box at={[0, 0.29, 0]} size={[1.41, 0.38, 2.38]} color={tint} />
    <Box at={[0, 0.57, 0.21]} size={[1.12, 0.36, 1.17]} color="#282b48" />
    <Box at={[0, 0.765, 0.24]} size={[0.94, 0.055, 0.97]} color={tint} />
    {[-1, 1].map(s => <group key={s}>
      <Box at={[s * 0.43, 0.335, -1.204]} size={[0.36, 0.11, 0.06]} color="#b5f5ff" lit />
      <Box at={[s * 0.44, 0.36, 1.2]} size={[0.37, 0.092, 0.06]} color="#ff466e" lit />
      <Box at={[s * 0.72, 0.255, 0]} size={[0.03, 0.045, 1.96]} color="#af82ff" lit />
    </group>)}
  </group>;
}

function Robot({ index, visible }: { index: number; visible: boolean }) {
  const group = useRef<Group>(null);
  const feet = useRef<Group>(null);
  const side = index % 2 ? -1 : 1;
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!group.current || (!visible && !group.current.visible)) return;
    const scale = MathUtils.damp(group.current.scale.x, visible ? 1.1 : 0, 4.5, dt);
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.018;
    group.current.position.set(side * (1 + index % 4 * 0.83) + Math.sin(t * 1.42 + index) * 0.85, 0.055 * Math.sin(t * 12 + index), 6 - index * 2.8 + Math.cos(t * 1.05 + index) * 1.6);
    group.current.rotation.y = Math.sin(t * 1.17 + index) * 1.45;
    if (feet.current) feet.current.rotation.x = Math.sin(t * 11 + index) * 0.21;
  });
  return <group ref={group} scale={0} visible={false}>
    <Box at={[0, 0.82, 0]} size={[0.61, 0.49, 0.37]} color="#737287" />
    <Box at={[0, 1.225, 0]} size={[0.48, 0.31, 0.42]} color="#414458" />
    <Box at={[0, 1.226, 0.217]} size={[0.36, 0.078, 0.04]} color="#ff385b" lit />
    <Box at={[0, 0.836, 0.191]} size={[0.28, 0.065, 0.03]} color="#ff5475" lit />
    <Box at={[-0.393, 0.805, 0.07]} size={[0.16, 0.45, 0.19]} color="#686779" angle={-0.23} />
    <Box at={[0.393, 0.805, 0.07]} size={[0.16, 0.45, 0.19]} color="#686779" angle={0.23} />
    <group ref={feet}>
      <Box at={[-0.152, 0.264, 0]} size={[0.21, 0.46, 0.25]} color="#45495c" />
      <Box at={[0.152, 0.264, 0]} size={[0.21, 0.46, 0.25]} color="#45495c" />
      <Box at={[-0.152, 0.07, 0.06]} size={[0.24, 0.14, 0.34]} color="#62677a" />
      <Box at={[0.152, 0.07, 0.06]} size={[0.24, 0.14, 0.34]} color="#62677a" />
    </group>
  </group>;
}

function Drone({ index, visible }: { index: number; visible: boolean }) {
  const group = useRef<Group>(null);
  const rotors = useRef<Group>(null);
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime;
    if (!group.current || (!visible && !group.current.visible)) return;
    const scale = MathUtils.damp(group.current.scale.x, visible ? 1.1 : 0, 4.5, dt);
    group.current.scale.setScalar(scale);
    group.current.visible = scale > 0.018;
    group.current.position.set(Math.sin(t * 0.8 + index * 2.1) * (4.4 + index % 3), 2.8 + index % 4 * 0.85 + Math.cos(t * 2.2 + index) * 0.37, 5 - index * 3.8 + Math.sin(t * 0.94 + index) * 2.1);
    group.current.rotation.set(0.15, t * 1.15 + index, Math.sin(t * 2 + index) * 0.22);
    if (rotors.current) rotors.current.rotation.y = t * 15;
  });
  return <group ref={group} scale={0} visible={false}>
    <Box at={[0, 0, 0]} size={[0.57, 0.2, 0.46]} color="#7787a8" />
    <Box at={[0, -0.11, 0]} size={[0.38, 0.045, 0.28]} color="#66e9ff" lit />
    <group ref={rotors}>
      <Box at={[0, 0.15, 0]} size={[1.34, 0.025, 0.06]} color="#65eaff" lit />
      <Box at={[0, 0.15, 0]} size={[0.06, 0.025, 1.34]} color="#65eaff" lit />
    </group>
  </group>;
}

export function Actors({ mood, chaos, robots, drones }: { mood: Mood; chaos: boolean; robots: number; drones: number }) {
  return <>
    {Array.from({ length: 8 }, (_, index) => <Pedestrian key={index} index={index} mood={mood} />)}
    {Array.from({ length: 5 }, (_, index) => <Hovercar key={index} index={index} chaos={chaos} />)}
    {Array.from({ length: 12 }, (_, index) => <Robot key={index} index={index} visible={index < robots} />)}
    {Array.from({ length: 10 }, (_, index) => <Drone key={index} index={index} visible={index < drones} />)}
  </>;
}
