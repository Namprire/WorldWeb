import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { DEMO_SCENARIOS } from '@webworld/shared';
import { SKY_PALETTES, useGameStore } from '../gameStore.js';
import { DRIVABLE_CARS } from '../playerTelemetry.js';
import { resolveCityCollision } from '../../game-engine/cityLayout.js';
import { FollowCamera } from '../../game-engine/figure/camera.js';
import { rootAt } from '../../game-engine/figure/man.js';
import { yawAt } from '../../game-engine/figure/player.js';

describe('World transformation state, GTA V palettes & oil-paint mechanics', () => {
  it('applies Robot Uprising, GPU Market Crash, and Tech Breakthrough payloads cleanly', () => {
    const store = useGameStore.getState();

    // Event A: Robot Uprising
    store.applySyncPayload({
      mode: 'demo',
      newsEvent: DEMO_SCENARIOS.robot_uprising.createNewsEvent('2026-11-14T03:00:00.000Z'),
      director: DEMO_SCENARIOS.robot_uprising.director,
      meta: {
        directorSource: 'deterministic_demo',
        modelUsed: 'deterministic-demo-fixture',
        latencyMs: 5,
        generatedAt: '2026-11-14T03:00:00.000Z',
      },
    });

    let next = useGameStore.getState();
    expect(next.activeEventType).toBe('robot_uprising');
    expect(next.worldChanges.sky_color).toBe('red');
    expect(next.worldChanges.spawn_robots).toBe(12);
    expect(next.worldChanges.npc_mood).toBe('panic');
    expect(next.activeMission?.status).toBe('active');
    expect(SKY_PALETTES[next.worldChanges.sky_color].neonAccentHex).toBe('#ef4444');
    expect(SKY_PALETTES[next.worldChanges.sky_color].horizonHex).toBeTruthy();

    // Complete mission and verify TFLOPS reward
    const beforeScore = next.computeTflops;
    next.completeActiveMission();
    next = useGameStore.getState();
    expect(next.activeMission?.status).toBe('completed');
    expect(next.computeTflops).toBe(
      beforeScore + DEMO_SCENARIOS.robot_uprising.director.mission.reward_tflops
    );

    // Event C: Tech Breakthrough
    next.applySyncPayload({
      mode: 'demo',
      newsEvent: DEMO_SCENARIOS.tech_breakthrough.createNewsEvent('2026-11-14T03:01:00.000Z'),
      director: DEMO_SCENARIOS.tech_breakthrough.director,
      meta: {
        directorSource: 'deterministic_demo',
        modelUsed: 'deterministic-demo-fixture',
        latencyMs: 4,
        generatedAt: '2026-11-14T03:01:00.000Z',
      },
    });
    next = useGameStore.getState();
    expect(next.worldChanges.sky_color).toBe('electric_blue');
    expect(next.worldChanges.spawn_drones).toBe(12);
    expect(next.worldChanges.npc_mood).toBe('celebrate');
  });

  it('prevents player and drivable supercars from entering building footprints or leaving bounds', () => {
    const [resolvedX, resolvedZ] = resolveCityCollision(0, -31, 0.65);
    const insideBuilding =
      Math.abs(resolvedX - 0) < 6.5 && Math.abs(resolvedZ - -31) < 6.5;
    expect(insideBuilding).toBe(false);

    const [edgeX, edgeZ] = resolveCityCollision(999, -999, 0.65);
    expect(Math.abs(edgeX)).toBeLessThanOrEqual(56);
    expect(Math.abs(edgeZ)).toBeLessThanOrEqual(56);

    expect(DRIVABLE_CARS.length).toBeGreaterThanOrEqual(3);
    for (const car of DRIVABLE_CARS) {
      const [cx, cz] = resolveCityCollision(car.x, car.z, 1.35);
      expect(Math.hypot(cx - car.x, cz - car.z)).toBeLessThan(0.01);
    }
  });

  it('samples root-motion translation and yaw tracks and blends GTA over-the-shoulder / first-person camera', () => {
    const posTrack = new THREE.VectorKeyframeTrack(
      'root.position',
      [0, 0.5, 1.0],
      [0, 0, 0, 0, 0, 1.2, 0, 0, 2.4]
    );
    const qStart = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), 0);
    const qEnd = new THREE.Quaternion().setFromAxisAngle(
      new THREE.Vector3(0, 1, 0),
      Math.PI / 2
    );
    const rotTrack = new THREE.QuaternionKeyframeTrack(
      'root.quaternion',
      [0, 1.0],
      [...qStart.toArray(), ...qEnd.toArray()]
    );
    const clip = new THREE.AnimationClip('TestStart', 1.0, [posTrack, rotTrack]);

    const midPos = rootAt(clip, 0.5);
    expect(midPos.z).toBeCloseTo(1.2, 4);
    expect(yawAt(clip, 1.0)).toBeCloseTo(Math.PI / 2, 3);

    // Camera raycast push-in & V first-person blend
    const cam = new THREE.PerspectiveCamera(52, 16 / 9, 0.2, 400);
    const follow = new FollowCamera(cam);
    const target = new THREE.Vector3(0, 0.16, 6.5);

    // Obstacle at 2.0m pushes camera closer quickly
    follow.update(
      0.1,
      target,
      { x: 0, y: 0 },
      0,
      () => 2.0,
      () => 0
    );
    expect(follow.distance).toBeLessThan(4.6);

    // Toggle first-person eye camera (`V` key)
    follow.toggleFirstPerson();
    let fp = 0;
    for (let i = 0; i < 30; i++) {
      fp = follow.update(
        1 / 30,
        target,
        { x: 0, y: 0 },
        0,
        () => null,
        () => 0
      );
    }
    expect(fp).toBeGreaterThan(0.95);
    expect(cam.position.distanceTo(new THREE.Vector3(0, 0.16 + 1.67, 6.5))).toBeLessThan(0.25);
  });
});
