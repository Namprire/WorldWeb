import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import type { Group } from 'three';
import { useGameStore } from '../game/state';
import { SPAWN } from '../shared/locations';
import { Human } from './Actors';
import { canWalk } from './layout';

const movement = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowLeft', 'ArrowDown', 'ArrowRight', 'ShiftLeft', 'ShiftRight']);

export function Player() {
  const canvas = useThree(state => state.gl.domElement);
  const updatePosition = useGameStore(state => state.updatePosition);
  const setCameraHeading = useGameStore(state => state.setCameraHeading);
  const resetCount = useGameStore(state => state.resetCount);
  const player = useRef<Group>(null);
  const keys = useRef(new Set<string>());
  const look = useRef({ yaw: 0, pitch: 0.26, drag: false });
  const speed = useRef(0);
  const playerPosition = useRef(new Vector3(SPAWN.x, 0.025, SPAWN.z));
  const cameraGoal = useRef(new Vector3());
  const cameraFocus = useRef(new Vector3());
  const firstFrame = useRef(true);
  const previousHeading = useRef(0);
  const sideOffset = 1.55;

  useEffect(() => {
    const clearKeys = () => {
      keys.current.clear();
      look.current.drag = false;
    };
    const keydown = (event: KeyboardEvent) => {
      if (!movement.has(event.code)) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.matches('input, textarea, select') || target.isContentEditable)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      event.preventDefault();
      keys.current.add(event.code);
    };
    const keyup = (event: KeyboardEvent) => keys.current.delete(event.code);
    const up = () => { look.current.drag = false; };
    const down = (event: PointerEvent) => {
      if (event.button !== 0) return;
      look.current.drag = true;
      try {
        canvas.setPointerCapture(event.pointerId);
        if (event.pointerType === 'mouse' && document.pointerLockElement !== canvas) {
          void canvas.requestPointerLock?.()?.catch?.(() => undefined);
        }
      } catch {
        // Pointer movement still works while the canvas is being dragged.
      }
    };
    const mousemove = (event: PointerEvent) => {
      if (document.pointerLockElement !== canvas && !look.current.drag) return;
      look.current.yaw += event.movementX * 0.0031;
      look.current.pitch = MathUtils.clamp(look.current.pitch + event.movementY * 0.0031, -0.085, 0.84);
    };
    const preventContextMenu = (event: Event) => event.preventDefault();
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', clearKeys);
    document.addEventListener('visibilitychange', clearKeys);
    document.addEventListener('pointerlockchange', up);
    canvas.addEventListener('pointerdown', down);
    canvas.addEventListener('contextmenu', preventContextMenu);
    window.addEventListener('pointermove', mousemove);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', clearKeys);
      document.removeEventListener('visibilitychange', clearKeys);
      document.removeEventListener('pointerlockchange', up);
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('contextmenu', preventContextMenu);
      window.removeEventListener('pointermove', mousemove);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      if (document.pointerLockElement === canvas) document.exitPointerLock();
    };
  }, [canvas]);

  useEffect(() => {
    playerPosition.current.set(SPAWN.x, 0.025, SPAWN.z);
    look.current.yaw = 0;
    look.current.pitch = 0.26;
    if (player.current) player.current.rotation.y = 0;
    firstFrame.current = true;
    speed.current = 0;
    previousHeading.current = 0;
    keys.current.clear();
    setCameraHeading(0);
  }, [resetCount, setCameraHeading]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.045);
    const yaw = look.current.yaw;
    const p = playerPosition.current;
    const active = keys.current;
    const forward = Number(active.has('KeyW') || active.has('ArrowUp')) - Number(active.has('KeyS') || active.has('ArrowDown'));
    const side = Number(active.has('KeyD') || active.has('ArrowRight')) - Number(active.has('KeyA') || active.has('ArrowLeft'));
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    const rate = active.has('ShiftLeft') || active.has('ShiftRight') ? 7.9 : 4.6;
    let moved = false;
    if (forward || side) {
      const normal = Math.hypot(forward, side);
      const vx = (forward * sin + side * cos) / normal;
      const vz = (-forward * cos + side * sin) / normal;
      const nextX = p.x + vx * dt * rate;
      const nextZ = p.z + vz * dt * rate;
      if (canWalk(nextX, p.z)) p.x = nextX;
      if (canWalk(p.x, nextZ)) p.z = nextZ;
      moved = Math.abs(nextX - p.x) < 0.00001 && Math.abs(vx) > 0.0001 ||
        Math.abs(nextZ - p.z) < 0.00001 && Math.abs(vz) > 0.0001;
      if (moved && player.current) {
        const facing = Math.atan2(-vx, -vz);
        const diff = Math.atan2(Math.sin(facing - player.current.rotation.y), Math.cos(facing - player.current.rotation.y));
        player.current.rotation.y += diff * (1 - Math.exp(-dt * 16));
        updatePosition(p.x, p.z);
      }
    }
    speed.current = MathUtils.damp(speed.current, moved ? rate : 0, 12, dt);
    player.current?.position.copy(p);
    const distance = 5.8 * Math.cos(look.current.pitch);
    cameraGoal.current.set(p.x - sin * distance + cos * sideOffset, 1.68 + 5.8 * Math.sin(look.current.pitch), p.z + cos * distance + sin * sideOffset);

    for (let sample = 1; sample <= 8; sample++) {
      const fraction = sample / 8;
      const x = MathUtils.lerp(p.x, cameraGoal.current.x, fraction);
      const z = MathUtils.lerp(p.z, cameraGoal.current.z, fraction);
      if (canWalk(x, z)) continue;
      const safe = Math.max(0.12, fraction - 0.16);
      cameraGoal.current.x = MathUtils.lerp(p.x, cameraGoal.current.x, safe);
      cameraGoal.current.z = MathUtils.lerp(p.z, cameraGoal.current.z, safe);
      break;
    }
    if (firstFrame.current) {
      camera.position.copy(cameraGoal.current);
      firstFrame.current = false;
    } else {
      camera.position.lerp(cameraGoal.current, 1 - Math.exp(-dt * 12));
    }
    cameraFocus.current.set(p.x + sin * 3.0 + cos * 0.72, 1.65 + (0.26 - look.current.pitch) * 2.0, p.z - cos * 3.0 + sin * 0.72);
    camera.lookAt(cameraFocus.current);
    if (Math.abs(previousHeading.current - yaw) > 0.015) {
      previousHeading.current = yaw;
      setCameraHeading(Math.atan2(sin, cos));
    }
  });

  return <group ref={player} position={[SPAWN.x, 0.025, SPAWN.z]}>
    <mesh position={[0, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.75, 1, 1]}>
      <circleGeometry args={[0.6, 14]} /><meshBasicMaterial color="#060612" transparent opacity={0.62} depthWrite={false} />
    </mesh>
    <Human hero speed={() => speed.current} />
  </group>;
}
