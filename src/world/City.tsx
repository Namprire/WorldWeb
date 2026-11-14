import { useFrame } from '@react-three/fiber';
import { memo, useLayoutEffect, useMemo, useRef } from 'react';
import { Color, Matrix4 } from 'three';
import type { Group, InstancedMesh, MeshBasicMaterial } from 'three';
import { BUILDINGS, variation } from './layout';
import { Label } from './Label';

const glow = (color: string) => <meshBasicMaterial color={color} toneMapped={false} />;

const Blocks = memo(function Blocks() {
  const windows = useMemo(() => BUILDINGS.flatMap((b, index) => {
    const entries: { x: number; y: number; z: number; angle: number; tint: string; brightness: number }[] = [];
    for (let floor = 1; floor < b.h - 0.8; floor += 1.14) {
      for (const axis of ['x', 'z']) {
        const width = axis === 'x' ? b.d : b.w;
        const columns = Math.floor(width / 0.9);
        for (let col = 0; col < columns; col++) {
          const offset = (col - (columns - 1) / 2) * 0.9;
          for (const face of [-1, 1]) {
            const rand = variation(index * 190 + floor * 17 + col * 3.2 + face);
            entries.push({
              x: b.x + (axis === 'x' ? face * (b.w / 2 + 0.019) : offset),
              z: b.z + (axis === 'x' ? offset : face * (b.d / 2 + 0.019)),
              y: floor + 0.55,
              angle: axis === 'x' ? face * Math.PI / 2 : face < 0 ? Math.PI : 0,
              tint: rand > 0.81 ? '#f5c787' : rand < 0.27 ? '#121a31' : b.trim,
              brightness: rand < 0.27 ? 0.9 : 0.22 + rand * 0.62,
            });
          }
        }
      }
    }
    return entries;
  }), []);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const obj = mesh.current;
    if (!obj) return;
    const matrix = new Matrix4();
    const color = new Color();
    windows.forEach((win, i) => {
      matrix.makeRotationY(win.angle).setPosition(win.x, win.y, win.z);
      obj.setMatrixAt(i, matrix);
      obj.setColorAt(i, color.set(win.tint).multiplyScalar(win.brightness));
    });
    obj.instanceMatrix.needsUpdate = true;
    if (obj.instanceColor) obj.instanceColor.needsUpdate = true;
  }, [windows]);

  return <>
    {BUILDINGS.map((b, i) => <group key={i} position={[b.x, 0, b.z]}>
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[b.w + 0.65, 0.22, b.d + 0.65]} />
        <meshStandardMaterial color="#23253b" roughness={0.83} />
      </mesh>
      <mesh position={[0, b.h / 2, 0]}>
        <boxGeometry args={[b.w, b.h, b.d]} />
        <meshStandardMaterial color={b.tone} roughness={0.81} metalness={0.32} />
      </mesh>
      <mesh position={[0, b.h, 0]}>
        <boxGeometry args={[b.w + 0.21, 0.09, b.d + 0.21]} />{glow(b.trim)}
      </mesh>
      <mesh position={[0, b.h + 0.56, 0]}>
        <boxGeometry args={[b.w * 0.68, 1.06, b.d * 0.66]} />
        <meshStandardMaterial color="#131929" />
      </mesh>
      {i % 3 === 0 && <>
        <mesh position={[0, b.h + 1.45, 0]}>
          <cylinderGeometry args={[0.04, 0.08, 1.8, 5]} /><meshStandardMaterial color="#7282a5" />
        </mesh>
        <mesh position={[0, b.h + 2.38, 0]}><sphereGeometry args={[0.09, 6, 6]} />{glow('#ff6479')}</mesh>
      </>}
    </group>)}
    <instancedMesh ref={mesh} args={[undefined, undefined, windows.length]}>
      <planeGeometry args={[0.61, 0.28]} /><meshBasicMaterial />
    </instancedMesh>
  </>;
});

const Street = memo(function Street() {
  const stripes = useMemo(() => {
    const result: [number, number, number, number, number][] = [];
    for (let i = 0; i < 20; i++) {
      const z = 19 - i * 2.5;
      result.push([-4.7, 0.013, z, 0.062, 0.86], [4.7, 0.013, z, 0.062, 0.86]);
    }
    for (const z of [-9, 10.5]) {
      for (let i = 0; i < 12; i++) result.push([-3.85 + i * 0.7, 0.015, z, 0.36, 0.95]);
    }
    return result;
  }, []);
  const mesh = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const matrix = new Matrix4();
    stripes.forEach(([x, y, z, w, d], i) => {
      mesh.current?.setMatrixAt(i, matrix.makeScale(w, 1, d).setPosition(x, y, z));
    });
    if (mesh.current) mesh.current.instanceMatrix.needsUpdate = true;
  }, [stripes]);
  return <>
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.014, 0]}>
      <planeGeometry args={[250, 250]} />
      <meshStandardMaterial color="#161723" roughness={0.68} metalness={0.38} />
    </mesh>
    <mesh position={[0, -0.01, -5]}>
      <boxGeometry args={[8, 0.023, 53]} /><meshStandardMaterial color="#27273a" roughness={0.58} metalness={0.52} />
    </mesh>
    {[-1, 1].map(side => <group key={side}>
      <mesh position={[side * 5.92, 0.014, -5]}>
        <boxGeometry args={[1.8, 0.026, 53]} /><meshStandardMaterial color="#2d3042" roughness={0.67} />
      </mesh>
      <mesh position={[side * 5.12, 0.031, -5]}>
        <boxGeometry args={[0.035, 0.009, 53]} />{glow(side < 0 ? '#8851cd' : '#2d82ac')}
      </mesh>
    </group>)}
    <instancedMesh ref={mesh} args={[undefined, undefined, stripes.length]}>
      <boxGeometry args={[1, 0.012, 1]} /><meshBasicMaterial color="#70657f" />
    </instancedMesh>
    {[1, -1].flatMap(side => [16.8, 7.3, -2.8, -13.4, -22.4].map((z, i) => <group key={side + ':' + z} position={[side * 6.35, 0, z]}>
      <mesh position={[0, 1.35, 0]}>
        <cylinderGeometry args={[0.055, 0.105, 2.7, 5]} /><meshStandardMaterial color="#42445a" metalness={0.55} roughness={0.48} />
      </mesh>
      <mesh position={[-side * 0.37, 2.67, 0]}>
        <boxGeometry args={[0.79, 0.087, 0.19]} />{glow(i % 2 ? '#ce84ff' : '#74d7ff')}
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-side * 0.45, 0.039, 0]}>
        <circleGeometry args={[1.1, 15]} /><meshBasicMaterial color={i % 2 ? '#7d44d4' : '#418db7'} transparent opacity={0.14} depthWrite={false} />
      </mesh>
    </group>))}
    <group position={[0, 0, 4]}>
      <mesh position={[0, 0.022, 0]}><cylinderGeometry args={[2.9, 2.9, 0.045, 12]} /><meshStandardMaterial color="#282742" metalness={0.49} roughness={0.48} /></mesh>
      {[1.65, 2.7].map((radius, i) => <mesh key={radius} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.054, 0]}>
        <ringGeometry args={[radius, radius + 0.042, 12]} />{glow(i ? '#9661cf' : '#439bb5')}
      </mesh>)}
    </group>
  </>;
});

const Backdrop = memo(function Backdrop() {
  return <>
    {Array.from({ length: 35 }, (_, i) => {
      const a = i * Math.PI * 2 / 35;
      const radius = 45 + variation(i) * 13;
      const height = 6 + variation(i + 105) * 23;
      const width = 2.5 + variation(i + 22) * 4.5;
      return <group key={i} position={[Math.cos(a) * radius, 0, Math.sin(a) * radius]}>
        <mesh position={[0, height / 2, 0]}>
          <boxGeometry args={[width, height, width]} /><meshBasicMaterial color={i % 2 ? '#13172d' : '#17182c'} />
        </mesh>
        <mesh position={[0, height + 0.02, 0]}>
          <boxGeometry args={[width + 0.07, 0.05, width + 0.07]} /><meshBasicMaterial color={i % 3 ? '#3a2b65' : '#285873'} />
        </mesh>
      </group>;
    })}
    <mesh position={[-25, 26, -87]}><sphereGeometry args={[4.8, 24, 16]} /><meshBasicMaterial color="#a680da" fog={false} /></mesh>
    <mesh position={[-25, 26, -87]}><sphereGeometry args={[5.7, 24, 16]} /><meshBasicMaterial color="#8b61db" fog={false} transparent opacity={0.07} depthWrite={false} /></mesh>
  </>;
});

const SIGNS = [
  { x: -12, z: 7.76, y: 4.2, text: 'NEURAL EXCHANGE', tint: '#efa3ff' },
  { x: 12, z: 6.26, y: 4.05, text: 'THE PIXEL ARCADE', tint: '#94f7ff' },
  { x: -12.5, z: -1.22, y: 5.5, text: 'GPU EXCHANGE', tint: '#ff89b6' },
  { x: 12.5, z: -11.72, y: 3.65, text: 'COMPUTE HQ', tint: '#a2f4ff' },
  { x: -11.6, z: 14.58, y: 3.65, text: 'HARDWARE DEPOT', tint: '#ffab91', reverse: true },
  { x: 0, z: -27.61, y: 4.25, text: 'SIGNAL RELAY', tint: '#91ebff' },
];

export function City({ message, color, active }: { message: string; color: string; active: boolean }) {
  const scanner = useRef<Group>(null);
  const board = useRef<MeshBasicMaterial>(null);
  const desired = useMemo(() => new Color(color), [color]);
  useFrame(({ clock }, dt) => {
    if (scanner.current) scanner.current.position.y = Math.sin(clock.elapsedTime * 1.55) * 0.98;
    board.current?.color.lerp(desired, 1 - Math.exp(-dt * 3));
  });
  return <>
    <Backdrop />
    <Street />
    <Blocks />
    {SIGNS.map(sign => <group key={sign.text} position={[sign.x, sign.y, sign.z]} rotation={[0, sign.reverse ? Math.PI : 0, 0]}>
      <mesh><boxGeometry args={[6.65, 0.94, 0.15]} /><meshBasicMaterial color="#1a1c32" /></mesh>
      <mesh position={[0, -0.45, 0.08]}><boxGeometry args={[6.65, 0.038, 0.045]} />{glow(sign.tint)}</mesh>
      <group position={[0, 0.015, 0.095]}><Label lines={[sign.text]} fontSize={64} width={6.35} height={0.72} color={sign.tint} /></group>
    </group>)}
    <group position={[0, 8.25, -16.5]}>
      {[-4.5, 4.5].map(x => <mesh key={x} position={[x, 0, -0.35]}>
        <boxGeometry args={[0.18, 4.2, 0.27]} /><meshStandardMaterial color="#656275" metalness={0.72} roughness={0.54} />
      </mesh>)}
      <mesh><boxGeometry args={[9.17, 3.1, 0.4]} /><meshStandardMaterial color="#38364c" metalness={0.8} roughness={0.47} /></mesh>
      <mesh position={[0, 0, 0.21]}><planeGeometry args={[8.92, 2.86]} /><meshBasicMaterial color="#111124" /></mesh>
      <mesh position={[0, -1.38, 0.24]}><boxGeometry args={[8.87, 0.057, 0.04]} /><meshBasicMaterial ref={board} color="#ca88ff" toneMapped={false} /></mesh>
      <group ref={scanner}>
        <mesh position={[0, 0, 0.235]}><planeGeometry args={[8.85, 0.18]} /><meshBasicMaterial color={color} transparent opacity={0.115} depthWrite={false} /></mesh>
      </group>
      <group position={[0, 0.96, 0.25]}><Label lines={[active ? '●  CITY BROADCAST' : '●  NEON DISTRICT // 01']} fontSize={31} width={8.2} height={0.42} color={color} left /></group>
      <group position={[0, -0.04, 0.25]}><Label lines={[message]} fontSize={message.length > 28 ? 65 : 83} width={8.15} height={1.58} color="#f1e7ff" maxLines={2} /></group>
      <group position={[0, -1.05, 0.25]}><Label lines={['WEBWORLD NETWORK  /  PUBLIC FEED']} fontSize={23} width={8.2} height={0.29} color="#9082aa" left /></group>
    </group>
  </>;
}
