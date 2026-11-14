import { useEffect, useRef, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { CITY_LANDMARKS, WORLD_LIMITS } from '@webworld/shared';
import RAPIER from './figure/rapier/rapier.mjs';
import { loadMan, styleAsJensenHuang, type LoadedMan } from './figure/man';
import { Animator } from './figure/animator';
import { Player } from './figure/player';
import { FollowCamera } from './figure/camera';
import { Input } from './figure/input';
import { CITY_BUILDINGS, SIDEWALK_BLOCKS, resolveCityCollision } from './cityLayout';
import {
  DRIVABLE_CARS,
  addCameraTrauma,
  playerTelemetry,
} from '../state/playerTelemetry';
import { useGameStore } from '../state/gameStore';

function surfaceHeightAt(x: number, z: number): number {
  for (const blk of SIDEWALK_BLOCKS) {
    if (
      Math.abs(x - blk.x) <= blk.width * 0.5 &&
      Math.abs(z - blk.z) <= blk.depth * 0.5
    ) {
      return 0.16;
    }
  }
  return 0.0;
}

interface RigRuntime {
  man: LoadedMan;
  animator: Animator;
  player: Player;
  follow: FollowCamera;
  input: Input;
  world: InstanceType<typeof RAPIER.World>;
}

export function PlayerController() {
  const { camera, gl, scene } = useThree();
  const compassRef = useRef<THREE.Group>(null);
  const runtimeRef = useRef<RigRuntime | null>(null);
  const [rigLoaded, setRigLoaded] = useState(false);
  const distanceUpdateTimerRef = useRef(0);

  const activeMission = useGameStore((s) => s.activeMission);
  const updateMissionDistance = useGameStore((s) => s.updateMissionDistance);
  const completeActiveMission = useGameStore((s) => s.completeActiveMission);

  useEffect(() => {
    let cancelled = false;
    const input = new Input(gl.domElement, { pads: true });
    const follow = new FollowCamera(camera as THREE.PerspectiveCamera);

    void (async () => {
      await RAPIER.init();
      if (cancelled) return;

      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });

      // 1. Road asphalt ground collider (top at y = 0)
      world.createCollider(
        RAPIER.ColliderDesc.cuboid(80, 0.5, 80).setTranslation(0, -0.5, 0)
      );

      // 2. Sidewalk concrete block colliders (top at y = 0.16 — triggers Rapier autostep & 2-bone foot IK!)
      for (const blk of SIDEWALK_BLOCKS) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(blk.width * 0.5, 0.08, blk.depth * 0.5).setTranslation(
            blk.x,
            0.08,
            blk.z
          )
        );
      }

      // 3. Central Founders Plaza monument collider
      world.createCollider(
        RAPIER.ColliderDesc.cylinder(0.6, 1.85).setTranslation(0, 0.6, 0)
      );

      // 4. City Skyscrapers & Landmarks colliders (blocks player & occludes GTA camera raycasts)
      for (const b of CITY_BUILDINGS) {
        world.createCollider(
          RAPIER.ColliderDesc.cuboid(
            b.width * 0.5,
            b.height * 0.5,
            b.depth * 0.5
          ).setTranslation(b.x, b.height * 0.5, b.z)
        );
      }

      // 5. Outer city boundary colliders
      const lim = WORLD_LIMITS.CITY_HALF_EXTENT;
      world.createCollider(RAPIER.ColliderDesc.cuboid(lim, 6, 0.5).setTranslation(0, 6, -lim));
      world.createCollider(RAPIER.ColliderDesc.cuboid(lim, 6, 0.5).setTranslation(0, 6, lim));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 6, lim).setTranslation(-lim, 6, 0));
      world.createCollider(RAPIER.ColliderDesc.cuboid(0.5, 6, lim).setTranslation(lim, 6, 0));

      const man = await loadMan('/figure/');
      if (cancelled) {
        world.free();
        return;
      }

      styleAsJensenHuang(man);
      scene.add(man.object);

      const animator = new Animator(man);
      const spawnY = surfaceHeightAt(0, 6.5);
      const spawn = new THREE.Vector3(0, spawnY, 6.5);
      const player = new Player({
        RAPIER,
        world,
        man,
        animator,
        spawn,
        yaw: Math.PI,
      });
      world.step();

      runtimeRef.current = { man, animator, player, follow, input, world };
      playerTelemetry.characterLoaded = true;
      setRigLoaded(true);

      Object.assign(window as unknown as Record<string, unknown>, {
        webworldRig: { man, animator, player, follow },
      });
    })();

    return () => {
      cancelled = true;
      input.dispose();
      const rt = runtimeRef.current;
      if (rt) {
        scene.remove(rt.man.object);
        rt.world.free();
        runtimeRef.current = null;
      }
    };
  }, [camera, gl, scene]);

  useFrame((_, delta) => {
    const dt = Math.min(delta, 1 / 20);
    const rt = runtimeRef.current;

    if (playerTelemetry.trauma > 0) {
      playerTelemetry.trauma = Math.max(0, playerTelemetry.trauma - 1.35 * delta);
    }

    if (!rt) return;
    const { man, animator, player, follow, input } = rt;
    const inp = input.read(dt);

    if (inp.toggleView) {
      follow.toggleFirstPerson();
      playerTelemetry.firstPerson = follow.firstPersonTarget;
    }

    // Check vehicle interaction (`F` key / Gamepad Y)
    if (!playerTelemetry.inVehicleId) {
      let nearestCar = null as (typeof DRIVABLE_CARS)[number] | null;
      let nearestDist = 3.4;
      for (const car of DRIVABLE_CARS) {
        const d = Math.hypot(car.x - player.feet.x, car.z - player.feet.z);
        if (d < nearestDist) {
          nearestDist = d;
          nearestCar = car;
        }
      }
      playerTelemetry.nearbyVehicleName = nearestCar ? nearestCar.name : null;

      if (inp.interactVehicle && nearestCar) {
        playerTelemetry.inVehicleId = nearestCar.id;
        playerTelemetry.vehicleName = nearestCar.name;
        playerTelemetry.nearbyVehicleName = null;
        man.object.visible = false;
        follow.yaw = nearestCar.yaw + Math.PI;
        addCameraTrauma(0.22);
      }
    } else {
      const activeCar = DRIVABLE_CARS.find((c) => c.id === playerTelemetry.inVehicleId);
      if (activeCar && inp.interactVehicle) {
        // Step out onto driver-side street
        const exitX = activeCar.x - Math.cos(activeCar.yaw) * 1.95;
        const exitZ = activeCar.z + Math.sin(activeCar.yaw) * 1.95;
        const [safeX, safeZ] = resolveCityCollision(exitX, exitZ, 0.55);
        const groundY = surfaceHeightAt(safeX, safeZ);
        activeCar.speed *= 0.25;
        activeCar.braking = false;
        player.teleport(safeX, groundY, safeZ, activeCar.yaw);
        playerTelemetry.inVehicleId = null;
        playerTelemetry.vehicleName = null;
        man.object.visible = true;
      }
    }

    let focusRoot: THREE.Vector3;
    let activeVehicleYaw: number | undefined;
    let activeVehicleSpeed = 0;

    if (playerTelemetry.inVehicleId) {
      const car = DRIVABLE_CARS.find((c) => c.id === playerTelemetry.inVehicleId)!;
      const throttle = inp.move.y;
      const steerInput = -inp.move.x;

      const maxFwd = inp.sprint ? 26.0 : 20.5;
      const maxRev = -8.5;

      if (inp.brake) {
        car.speed = THREE.MathUtils.lerp(car.speed, 0, 1 - Math.exp(-7.5 * dt));
        car.braking = true;
      } else if (Math.abs(throttle) > 0.04) {
        const targetSpd = throttle > 0 ? throttle * maxFwd : -throttle * maxRev;
        const accelRate = throttle * car.speed < 0 ? 18 : 11;
        car.speed += Math.sign(targetSpd - car.speed) * Math.min(Math.abs(targetSpd - car.speed), accelRate * dt);
        car.braking = throttle * car.speed < -0.5;
      } else {
        car.speed = THREE.MathUtils.lerp(car.speed, 0, 1 - Math.exp(-2.6 * dt));
        car.braking = false;
      }

      const targetSteer = steerInput * 0.52;
      car.steerAngle = THREE.MathUtils.lerp(car.steerAngle, targetSteer, 1 - Math.exp(-12 * dt));

      const turnFactor = Math.min(1, Math.abs(car.speed) / 4.5) * Math.sign(car.speed || 1);
      car.yaw += car.steerAngle * turnFactor * (inp.brake ? 3.1 : 2.15) * dt;

      const vx = Math.sin(car.yaw) * car.speed;
      const vz = Math.cos(car.yaw) * car.speed;
      const nextX = car.x + vx * dt;
      const nextZ = car.z + vz * dt;
      const [rx, rz] = resolveCityCollision(nextX, nextZ, 1.35);

      // Damp speed slightly if scraping a building wall
      if (Math.hypot(rx - nextX, rz - nextZ) > 0.03 && Math.abs(car.speed) > 4) {
        car.speed *= 0.65;
        addCameraTrauma(0.2);
      }

      car.x = rx;
      car.z = rz;
      car.y = surfaceHeightAt(rx, rz);
      car.wheelSpin += (car.speed * dt) / 0.34;

      // Sync player telemetry with car
      playerTelemetry.x = car.x;
      playerTelemetry.y = car.y;
      playerTelemetry.z = car.z;
      playerTelemetry.yaw = car.yaw;
      playerTelemetry.speed = Math.abs(car.speed);
      playerTelemetry.isSprinting = inp.sprint;
      playerTelemetry.isGrounded = true;

      focusRoot = new THREE.Vector3(car.x, car.y, car.z);
      activeVehicleYaw = car.yaw + Math.PI;
      activeVehicleSpeed = car.speed;
    } else {
      // On-foot `blendi/oil-paint` character locomotion + Rapier KCC + 2-bone IK!
      player.update(dt, inp, follow.yaw);

      // Safety respawn if ever out of bounds
      if (player.feet.y < -4) {
        player.teleport(0, surfaceHeightAt(0, 6.5), 6.5, Math.PI);
      }

      const root = player.visualRoot(dt);
      man.object.position.copy(root);
      man.object.rotation.set(0, player.yaw, 0);
      man.object.updateMatrixWorld(true);

      const localVel = player.vel
        .clone()
        .applyAxisAngle(new THREE.Vector3(0, 1, 0), -player.yaw);

      animator.update(dt, {
        speed: player.mode === 'move' ? player.speed : Math.hypot(localVel.x, localVel.z),
        moveAngle: player.moveAngle,
        grounded: player.grounded,
      });
      animator.relaxHands(player.speed);
      animator.uprightTrunk(
        dt,
        player.speed,
        player.grounded && player.mode !== 'jump' && player.mode !== 'air' ? 1 : 0.3
      );

      const lookW =
        player.mode === 'move' || player.mode === 'idleExtra'
          ? THREE.MathUtils.clamp(1 - (player.speed - 1.5) / 2, 0, 1)
          : 0;
      animator.lookToward(dt, camera.getWorldDirection(new THREE.Vector3()), lookW);
      animator.armClearance(dt);

      if (player.mode === 'move' && !player.strafe) {
        animator.leanInto(dt, player.turnRate, player.speed, player.accelF);
      } else {
        animator.leanInto(dt, 0, 0, 0);
      }

      const onGround =
        player.grounded && player.mode !== 'jump' && player.mode !== 'air';
      animator.placeFeet(
        dt,
        (gx, gz, fromY) => player.ground(gx, gz, fromY, 1.4),
        root.y,
        onGround ? 1 : 0
      );
      man.object.updateMatrixWorld(true);

      playerTelemetry.x = root.x;
      playerTelemetry.y = root.y;
      playerTelemetry.z = root.z;
      playerTelemetry.yaw = player.yaw;
      playerTelemetry.speed = player.speed;
      playerTelemetry.stamina = player.stamina;
      playerTelemetry.isSprinting = inp.sprint && player.speed > 5.5;
      playerTelemetry.isGrounded = player.grounded;

      focusRoot = root;
    }

    const fpBlend = follow.update(
      dt,
      focusRoot,
      inp.look,
      inp.zoom,
      (o, d, max) => player.castRay(o, d, max),
      surfaceHeightAt,
      {
        inVehicle: !!playerTelemetry.inVehicleId,
        vehicleYaw: activeVehicleYaw,
        vehicleSpeed: activeVehicleSpeed,
        trauma: playerTelemetry.trauma,
      }
    );

    if (!playerTelemetry.inVehicleId) {
      man.object.visible = fpBlend < 0.52;
    }
    playerTelemetry.cameraYaw = follow.yaw;

    // Mission objective directional GPS chevron & completion trigger
    if (activeMission && activeMission.status === 'active') {
      const landmark = CITY_LANDMARKS[activeMission.spec.target_landmark];
      const [bx, , bz] = landmark.beaconPosition;
      const dx = bx - playerTelemetry.x;
      const dz = bz - playerTelemetry.z;
      const dist = Math.hypot(dx, dz);

      if (compassRef.current) {
        compassRef.current.visible = true;
        compassRef.current.position.set(
          playerTelemetry.x,
          playerTelemetry.y + 0.06,
          playerTelemetry.z
        );
        compassRef.current.rotation.y = Math.atan2(dx, dz);
      }

      distanceUpdateTimerRef.current += dt;
      if (distanceUpdateTimerRef.current >= 0.2) {
        distanceUpdateTimerRef.current = 0;
        updateMissionDistance(dist);
      }

      const triggerRadius = playerTelemetry.inVehicleId ? 4.4 : 3.4;
      if (dist <= triggerRadius) {
        completeActiveMission();
      }
    } else if (compassRef.current) {
      compassRef.current.visible = false;
    }
  });

  return (
    <>
      {/* Subtle loading placeholder for ~80ms while starter-man.glb initializes */}
      {!rigLoaded && (
        <mesh position={[0, 1.0, 6.5]} castShadow>
          <capsuleGeometry args={[0.26, 1.2, 6, 12]} />
          <meshStandardMaterial color="#181a1f" roughness={0.4} />
        </mesh>
      )}

      {/* GTA V Yellow Waypoint Directional Chevron */}
      <group ref={compassRef} visible={false}>
        <mesh position={[0, 0.04, 1.35]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[0.24, 0.52, 3]} />
          <meshBasicMaterial color="#facc15" transparent opacity={0.92} />
        </mesh>
      </group>
    </>
  );
}
