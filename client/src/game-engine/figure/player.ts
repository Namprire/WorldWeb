/**
 * Adapted from `blendi/oil-paint` (`src/figure/player.js`, CC0 1.0, Patch).
 * Rapier 3D kinematic capsule controller with autostep (sidewalk curbs!), snap-to-ground,
 * slope limits, root-motion starts/stops/turns in place, jump/air/land states, and wall slowdown.
 */
import * as THREE from 'three';
import type RAPIER_NS from './rapier/rapier.mjs';
import type {
  Collider,
  KinematicCharacterController,
  Ray,
  RigidBody,
  World,
} from './rapier/rapier.mjs';
import type { Animator, AnimState, GroundHit } from './animator';
import type { FrameInputState } from './input';
import { rootAt, type LoadedMan } from './man';

const damp = (a: number, b: number, rate: number, dt: number) =>
  b + (a - b) * Math.exp(-rate * dt);
const angleWrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const clamp = THREE.MathUtils.clamp;
const approach = (a: number, b: number, step: number) =>
  a < b ? Math.min(b, a + step) : Math.max(b, a - step);

export interface PlayerTuning {
  radius: number;
  height: number;
  accel: { walk: number; run: number; sprint: number };
  decel: number;
  turn: { walk: number; run: number; sprint: number };
  jumpHeight: number;
  gravity: number;
  fallGravity: number;
  airControl: number;
  stepHeight: number;
  maxSlopeDeg: number;
}

export const TUNING: PlayerTuning = {
  radius: 0.28,
  height: 1.8,
  accel: { walk: 6, run: 9.5, sprint: 8 },
  decel: 12,
  turn: { walk: 9, run: 7.5, sprint: 5.4 },
  jumpHeight: 0.85,
  gravity: 19,
  fallGravity: 25,
  airControl: 2.8,
  stepHeight: 0.32,
  maxSlopeDeg: 46,
};

export type PlayerMode = 'move' | 'start' | 'stop' | 'turn' | 'jump' | 'air' | 'land' | 'idleExtra';

export class Player {
  R: typeof RAPIER_NS;
  world: World;
  man: LoadedMan;
  anim: Animator;
  t: PlayerTuning;

  yaw: number;
  vel = new THREE.Vector3();
  speed = 0;
  grounded = true;
  airTime = 0;
  mode: PlayerMode = 'move';
  strafe = false;
  moveAngle = 0;
  turnRate = 0;
  accelF = 0;
  stamina = 1.0;

  body: RigidBody;
  collider: Collider;
  kcc: KinematicCharacterController;
  feet: THREE.Vector3;
  prevFeet: THREE.Vector3;
  visualY: number;

  private ray: Ray;
  private lastYaw: number;
  private prevSpeed = 0;
  private lastInputMag = 0;
  private wallTime = 0;
  private moveTime = 0;
  private sprintTime = 0;
  private tiredFor = 0;
  private idleTime = 0;
  private moveDir: THREE.Vector3 | null = null;
  private jumpedAt = 0;
  private lastFallSpeed = 0;
  private blocked = 0;

  constructor(opts: {
    RAPIER: typeof RAPIER_NS;
    world: World;
    man: LoadedMan;
    animator: Animator;
    spawn: THREE.Vector3;
    yaw?: number;
    tuning?: PlayerTuning;
  }) {
    const { RAPIER, world, man, animator, spawn, yaw = 0, tuning = TUNING } = opts;
    this.R = RAPIER;
    this.world = world;
    this.man = man;
    this.anim = animator;
    this.t = tuning;
    this.yaw = yaw;
    this.lastYaw = yaw;

    const half = this.halfHeight();
    this.body = world.createRigidBody(
      RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(
        spawn.x,
        spawn.y + tuning.radius + half + 0.02,
        spawn.z
      )
    );
    this.collider = world.createCollider(
      RAPIER.ColliderDesc.capsule(half, tuning.radius).setFriction(0),
      this.body
    );
    this.kcc = world.createCharacterController(0.02);
    this.kcc.setUp({ x: 0, y: 1, z: 0 });
    this.kcc.enableAutostep(tuning.stepHeight, 0.12, false);
    this.kcc.enableSnapToGround(0.45);
    this.kcc.setMaxSlopeClimbAngle(THREE.MathUtils.degToRad(tuning.maxSlopeDeg));
    this.kcc.setMinSlopeSlideAngle(THREE.MathUtils.degToRad(tuning.maxSlopeDeg + 6));
    this.kcc.setSlideEnabled(true);

    this.feet = new THREE.Vector3(spawn.x, spawn.y, spawn.z);
    this.prevFeet = this.feet.clone();
    this.visualY = spawn.y;
    this.ray = new RAPIER.Ray({ x: 0, y: 0, z: 0 }, { x: 0, y: -1, z: 0 });
  }

  halfHeight(): number {
    return this.t.height / 2 - this.t.radius;
  }

  ground(x: number, z: number, fromY: number, maxDist = 1.6): GroundHit | null {
    this.ray.origin = { x, y: fromY, z };
    this.ray.dir = { x: 0, y: -1, z: 0 };
    const hit = this.world.castRayAndGetNormal(
      this.ray,
      maxDist,
      true,
      undefined,
      undefined,
      this.collider
    );
    if (!hit) return null;
    return {
      y: fromY - hit.timeOfImpact,
      normal: new THREE.Vector3(hit.normal.x, hit.normal.y, hit.normal.z),
    };
  }

  castRay(origin: THREE.Vector3, dir: THREE.Vector3, max: number): number | null {
    this.ray.origin = { x: origin.x, y: origin.y, z: origin.z };
    this.ray.dir = { x: dir.x, y: dir.y, z: dir.z };
    const hit = this.world.castRay(this.ray, max, true, undefined, undefined, this.collider);
    return hit ? hit.timeOfImpact : null;
  }

  facing(yaw = this.yaw): THREE.Vector3 {
    return new THREE.Vector3(Math.sin(yaw), 0, Math.cos(yaw));
  }

  teleport(x: number, y: number, z: number, yaw = this.yaw): void {
    const half = this.halfHeight();
    this.body.setTranslation({ x, y: y + this.t.radius + half + 0.04, z }, true);
    this.world.propagateModifiedBodyPositionsToColliders();
    this.feet.set(x, y, z);
    this.prevFeet.copy(this.feet);
    this.visualY = y;
    this.vel.set(0, 0, 0);
    this.speed = 0;
    this.mode = 'move';
    this.grounded = true;
    this.yaw = yaw;
    this.lastYaw = yaw;
    this.anim.lock = null;
    this.anim.lockOff = null;
    this.anim.enter(this.anim.locoState({ strafe: false }), 0.08);
  }

  private intent(input: FrameInputState, camYaw: number) {
    const m = input.move;
    const mag = Math.min(1, Math.hypot(m.x, m.y));
    const f = new THREE.Vector3(Math.sin(camYaw), 0, Math.cos(camYaw));
    const r = new THREE.Vector3(-Math.cos(camYaw), 0, Math.sin(camYaw));
    const dir = f.multiplyScalar(m.y).addScaledVector(r, m.x);
    if (dir.lengthSq() > 1e-6) dir.normalize();

    const S = this.anim.setup.speeds;
    let speed: number;
    if (mag < 0.05) speed = 0;
    else if (input.walk) speed = S.walk * Math.min(1, mag * 1.4);
    else if (input.device === 'pad' && mag < 0.6) speed = S.walk * (mag / 0.6);
    else if (input.sprint && !input.strafe) speed = S.sprint;
    else
      speed =
        input.device === 'pad'
          ? THREE.MathUtils.lerp(S.walk, S.run, (mag - 0.6) / 0.4)
          : S.run;

    return { dir, mag, speed, dirYaw: Math.atan2(dir.x, dir.z) };
  }

  update(dt: number, input: FrameInputState, camYaw: number): void {
    const A = this.anim;
    const want = this.intent(input, camYaw);
    const wasStrafe = this.strafe;
    this.strafe = !!input.strafe;
    this.lastInputMag = want.mag;

    if (wasStrafe !== this.strafe && this.mode === 'move') {
      A.enter(A.locoState({ strafe: this.strafe }), 0.25);
    }

    const st = A.state;
    const f = this.facing();
    const desired = new THREE.Vector3();

    // Update HUD stamina gently (never blocks sprint, adds GTA bar responsiveness)
    if (input.sprint && this.speed > A.setup.speeds.run + 0.2) {
      this.stamina = Math.max(0.12, this.stamina - dt * 0.14);
    } else {
      this.stamina = Math.min(1.0, this.stamina + dt * 0.22);
    }

    if (this.mode === 'move') {
      if (input.jump && this.grounded) {
        this.jump(dt);
        return;
      }
      const idle = this.speed < 0.15;

      if (idle && this.grounded) {
        const ask = this.strafe ? camYaw : want.mag > 0.05 ? want.dirYaw : null;
        if (ask != null) {
          const d = angleWrap(ask - this.yaw);
          if (
            (!this.strafe && Math.abs(d) > 2.2) ||
            (this.strafe && want.mag < 0.05 && Math.abs(d) > 1.15)
          ) {
            this.turnInPlace(d);
            return;
          }
        }
      }

      if (
        idle &&
        !(this.wallTime > 0) &&
        !this.strafe &&
        want.mag > 0.05 &&
        want.speed <= A.setup.speeds.walk + 0.01 &&
        Math.abs(angleWrap(want.dirYaw - this.yaw)) < 0.9 &&
        this.grounded
      ) {
        this.yaw = want.dirYaw;
        this.mode = 'start';
        A.enter(A.oneShot('start', 'AM_Idle_To_Walk', { from: 0.06, to: 0.62, rate: 1.15 }), 0.2);
        this.step(dt, new THREE.Vector3(), true);
        return;
      }

      if (
        idle &&
        !(this.wallTime > 0) &&
        !this.strafe &&
        want.mag > 0.05 &&
        want.speed > A.setup.speeds.walk + 0.1 &&
        Math.abs(angleWrap(want.dirYaw - this.yaw)) < 0.9 &&
        this.grounded
      ) {
        this.yaw = want.dirYaw;
        this.mode = 'start';
        A.enter(
          A.oneShot(
            'start',
            want.speed > A.setup.speeds.run + 0.1 ? 'Idle_To_Sprint' : 'Idle_To_Run',
            { from: 0.03, to: 0.72 }
          ),
          0.15
        );
        this.step(dt, new THREE.Vector3(), true);
        return;
      }

      this.moveTime = this.speed > 0.5 ? this.moveTime + dt : 0;
      if (!this.strafe && want.mag < 0.05 && this.grounded && this.speed > 0.9 && this.moveTime > 0.6) {
        const clip =
          this.speed > A.setup.speeds.run + 0.4
            ? 'Sprint_To_Idle'
            : this.speed > 2.4
              ? 'Run_To_Idle'
              : 'AM_Walk_To_Idle';
        const from = A.match(clip, A.currentFeet(), 0, 0.3);
        this.mode = 'stop';
        A.enter(A.oneShot('stop', clip, { from, to: 0.92 }), 0.22);
        if (this.sprintTime > 1.5) this.tiredFor = 6;
        this.step(dt, new THREE.Vector3(), true);
        return;
      }

      if (this.strafe) {
        if (want.mag > 0.05 || this.speed > 0.2) {
          this.yaw = this.turnToward(this.yaw, camYaw, 12, dt);
        }
        const local = want.dir.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -this.yaw);
        const ang = Math.atan2(local.x, local.z);
        const fwd = Math.cos(ang);
        const S = A.setup.speeds;
        const cap =
          fwd >= 0
            ? THREE.MathUtils.lerp(S.strafeJog, S.run * 0.82, fwd * fwd)
            : THREE.MathUtils.lerp(S.strafeJog, S.walk * 1.15, fwd * fwd);
        const target = Math.min(want.speed, cap);
        this.speed = approach(
          this.speed,
          target,
          (target > this.speed ? this.t.accel.run : this.t.decel) * dt
        );
        if (want.mag > 0.05) this.moveAngle = ang;
        this.moveDir = want.mag > 0.05 ? want.dir.clone() : this.moveDir ?? f.clone();
        desired.copy(this.moveDir).multiplyScalar(this.speed);
      } else {
        const gait: 'sprint' | 'run' | 'walk' =
          want.speed > A.setup.speeds.run + 0.1
            ? 'sprint'
            : want.speed > A.setup.speeds.walk + 0.1
              ? 'run'
              : 'walk';
        if (want.mag > 0.05) {
          this.yaw = this.turnToward(this.yaw, want.dirYaw, this.t.turn[gait], dt);
        }
        const off = want.mag > 0.05 ? Math.abs(angleWrap(want.dirYaw - this.yaw)) : 0;
        const target = want.speed * (off < 1.0 ? 1 : clamp(1.45 - off / 2.2, 0.4, 1));
        const rate = target > this.speed ? this.t.accel[gait] : this.t.decel;
        this.speed = approach(this.speed, target, rate * dt);
        this.moveAngle = 0;
        desired.copy(this.facing()).multiplyScalar(this.speed);
      }

      this.sprintTime =
        this.speed > A.setup.speeds.run + 0.3
          ? this.sprintTime + dt
          : Math.max(0, this.sprintTime - dt * 0.5);

      if (!this.grounded && this.airTime > 0.2) {
        this.mode = 'air';
        A.enter(A.oneShot('air', 'Jump_Loop', { loop: true }), 0.3);
      }
      this.idleExtras(dt);
      this.step(dt, desired, false);
      return;
    }

    if (this.mode === 'turn') {
      const raw = this.man.raw[st.clip!];
      const y0 = yawAt(raw, (st.prevU ?? 0) * raw.duration);
      const y1 = yawAt(raw, (st.u ?? 0) * raw.duration);
      this.yaw += angleWrap(y1 - y0) * (st.scale ?? 1);
      const asked = want.mag > 0.05 && !this.strafe;
      if (st.done || (asked && (st.u ?? 0) > (st.to ?? 1) * 0.7)) {
        this.mode = 'move';
        A.enter(A.locoState({ strafe: this.strafe }), 0.28);
      }
      this.step(dt, new THREE.Vector3(), true);
      return;
    }

    if (this.mode === 'start' || this.mode === 'stop') {
      let rm = this.rootMotion(st);
      if (st.prevU === st.u) rm = this.facing().multiplyScalar(this.speed * dt);
      const v = rm.length() / Math.max(dt, 1e-4);
      const resumed = this.mode === 'stop' && want.mag > 0.05;
      const runStart = st.clip === 'Idle_To_Run' || st.clip === 'Idle_To_Sprint';
      const asked =
        this.mode === 'start' &&
        (want.mag < 0.05 ||
          (runStart
            ? want.speed <= A.setup.speeds.walk + 0.1
            : want.speed > A.setup.speeds.walk + 0.1) ||
          Math.abs(angleWrap(want.dirYaw - this.yaw)) > 0.6);

      if (this.mode === 'start' && want.mag > 0.05) {
        this.yaw = this.turnToward(this.yaw, want.dirYaw, 3, dt);
      }
      if (st.done || resumed || asked) {
        this.speed = st.done && st.kind === 'stop' ? 0 : v > 0.05 ? v : this.speed;
        this.mode = 'move';
        const loco = A.locoState({ strafe: this.strafe });
        A.phase = A.matchPhase(
          this.speed > 2.4 ? A.setup.run : A.setup.walk,
          A.currentFeet()
        );
        A.enter(loco, st.done ? 0.35 : 0.22);
      }
      this.step(dt, rm.divideScalar(Math.max(dt, 1e-4)), true);
      return;
    }

    if (this.mode === 'jump' || this.mode === 'air') {
      if (want.mag > 0.05) {
        const wantV = want.dir.clone().multiplyScalar(Math.max(want.speed, 1.5));
        this.vel.x = approach(this.vel.x, wantV.x, this.t.airControl * dt);
        this.vel.z = approach(this.vel.z, wantV.z, this.t.airControl * dt);
        if (!this.strafe) this.yaw = this.turnToward(this.yaw, want.dirYaw, 2.5, dt);
      }
      if (this.strafe) this.yaw = this.turnToward(this.yaw, camYaw, 8, dt);
      if (st.kind === 'jumpStart' && (st.done || this.vel.y < 1.0)) {
        A.enter(A.oneShot('air', 'Jump_Loop', { loop: true }), 0.25);
      }
      desired.set(this.vel.x, 0, this.vel.z);
      this.step(dt, desired, false, true);
      if (this.grounded && this.airTime === 0) this.land();
      return;
    }

    if (this.mode === 'idleExtra') {
      if (input.jump && this.grounded) {
        this.mode = 'move';
        this.jump(dt);
        return;
      }
      this.step(dt, new THREE.Vector3(), true);
      return;
    }

    if (this.mode === 'land') {
      const moving = want.mag > 0.05;
      this.speed = approach(this.speed, moving ? want.speed : 0, (moving ? 6 : 10) * dt);
      if (moving && !this.strafe) this.yaw = this.turnToward(this.yaw, want.dirYaw, 6, dt);
      if (input.jump && this.grounded) {
        this.jump(dt);
        return;
      }
      const leave = moving ? (st.u ?? 0) > (st.from ?? 0) + 0.14 : st.done;
      if (leave) {
        this.mode = 'move';
        A.phase = A.matchPhase(
          this.speed > 2.4 ? A.setup.run : A.setup.walk,
          A.currentFeet()
        );
        A.enter(A.locoState({ strafe: this.strafe }), moving ? 0.25 : 0.35);
      }
      desired
        .copy(this.strafe && this.moveDir ? this.moveDir : this.facing())
        .multiplyScalar(this.speed);
      this.step(dt, desired, false);
    }
  }

  private turnToward(a: number, b: number, rate: number, dt: number): number {
    const d = angleWrap(b - a);
    return a + clamp(d, -rate * dt, rate * dt);
  }

  private rootMotion(st: AnimState): THREE.Vector3 {
    const raw = this.man.raw[st.clip!];
    const p0 = rootAt(raw, (st.prevU ?? 0) * raw.duration);
    const p1 = rootAt(raw, (st.u ?? 0) * raw.duration);
    return p1.sub(p0).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.yaw);
  }

  private turnInPlace(d: number): void {
    const A = this.anim;
    const big = Math.abs(d) > 2.2;
    const clip = big ? (d > 0 ? 'Turn180_L' : 'Turn180_R') : d > 0 ? 'Turn90_L' : 'Turn90_R';
    const raw = this.man.raw[clip];
    const total =
      angleWrap(yawAt(raw, raw.duration) - yawAt(raw, 0)) ||
      (big ? Math.PI : Math.PI / 2) * Math.sign(d);
    const s = A.oneShot('turn', clip, {
      from: 0.08,
      to: big ? 0.8 : 0.78,
      rate: big ? 1.45 : 1.35,
    });
    const covered =
      angleWrap(yawAt(raw, (s.to ?? 0.8) * raw.duration) - yawAt(raw, (s.u ?? 0.08) * raw.duration)) ||
      total;
    s.scale = d / (Math.abs(covered) > 0.3 ? covered : total);
    s.prevU = s.u;
    this.mode = 'turn';
    this.speed = 0;
    A.enter(s, 0.2);
  }

  private jump(dt: number): void {
    const A = this.anim;
    const t = this.t;
    this.vel
      .copy(this.strafe && this.moveDir ? this.moveDir : this.facing())
      .multiplyScalar(this.speed);
    this.vel.y = Math.sqrt(2 * t.gravity * t.jumpHeight);
    this.grounded = false;
    this.mode = 'jump';
    this.jumpedAt = performance.now();
    const info = A.info.Jump_Start;
    A.enter(
      A.oneShot('jumpStart', 'Jump_Start', { from: info?.launch ?? 0.35, to: 1, rate: 1.25 }),
      0.08
    );
    this.step(dt, new THREE.Vector3(this.vel.x, 0, this.vel.z), false, true);
  }

  private land(): void {
    const A = this.anim;
    const fall = this.lastFallSpeed;
    this.speed = Math.hypot(this.vel.x, this.vel.z);
    this.vel.y = 0;
    this.mode = 'land';
    const from = A.info.Jump_Land?.contact ?? 0;
    const st = A.oneShot('land', 'Jump_Land', {
      from,
      to: fall > 7 ? 0.9 : 0.7,
      rate: fall > 7 ? 1.1 : 1.45,
    });
    st.from = from;
    A.enter(st, 0.08);
  }

  private idleExtras(dt: number): void {
    const A = this.anim;
    const st = A.state;
    if (this.tiredFor > 0) this.tiredFor -= dt;
    A.tired = this.tiredFor > 0;
    if (st.kind !== 'loco' || this.strafe) {
      this.idleTime = 0;
      return;
    }
    if (this.speed < 0.05) this.idleTime += dt;
    else this.idleTime = 0;
    if (this.idleTime > 9 && this.speed < 0.05) {
      this.idleTime = -5;
      this.mode = 'idleExtra';
      A.enter(A.oneShot('idleExtra', 'Idle_LookAround', { from: 0, to: 1 }), 0.6);
    }
  }

  private step(dt: number, v: THREE.Vector3, rootMotion = false, airborne = false): void {
    const t = this.t;
    const A = this.anim;

    if (this.mode === 'idleExtra' && A.state.done) {
      this.mode = 'move';
      A.enter(A.locoState({ strafe: this.strafe }), 0.4);
    }
    if (this.mode === 'idleExtra' && this.lastInputMag > 0.05) {
      this.mode = 'move';
      A.enter(A.locoState({ strafe: this.strafe }), 0.25);
    }

    if (!airborne) {
      this.vel.x = v.x;
      this.vel.z = v.z;
      if (this.grounded) this.vel.y = -0.1;
    }
    if (!(this.grounded && !airborne)) {
      this.vel.y -= (this.vel.y < 0 ? t.fallGravity : t.gravity) * dt;
    }
    this.vel.y = Math.max(this.vel.y, -40);

    const d = { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt };
    this.kcc.computeColliderMovement(this.collider, d);
    const mv = this.kcc.computedMovement();
    const was = this.grounded;
    this.grounded = this.kcc.computedGrounded();
    if (this.vel.y > 0 && mv.y < d.y * 0.5) this.vel.y = 0;

    const p = this.body.translation();
    this.body.setNextKinematicTranslation({ x: p.x + mv.x, y: p.y + mv.y, z: p.z + mv.z });
    this.world.step();

    this.prevFeet.copy(this.feet);
    this.feet.set(
      p.x + mv.x,
      p.y + mv.y - this.halfHeight() - t.radius - 0.02,
      p.z + mv.z
    );

    if (!this.grounded) {
      this.airTime += dt;
      this.lastFallSpeed = -this.vel.y;
    } else if (!was || this.airTime) {
      this.airTime = 0;
    }
    if (this.grounded && airborne && this.vel.y > 0 && performance.now() - this.jumpedAt < 150) {
      this.grounded = false;
    }

    const moved3 = Math.hypot(mv.x, mv.y, mv.z) / Math.max(dt, 1e-4);
    this.blocked =
      !rootMotion && this.mode === 'move' && this.grounded && moved3 < this.speed * 0.6 - 0.2
        ? this.blocked + 1
        : 0;
    if (this.blocked > 3) {
      this.speed = Math.max(moved3, this.speed - 20 * dt);
      this.wallTime = 0.5;
    } else {
      this.wallTime = Math.max(0, this.wallTime - dt);
    }

    this.turnRate = damp(
      this.turnRate,
      angleWrap(this.yaw - this.lastYaw) / Math.max(dt, 1e-4),
      10,
      dt
    );
    this.accelF = damp(
      this.accelF,
      (this.speed - this.prevSpeed) / Math.max(dt, 1e-4),
      6,
      dt
    );
    this.prevSpeed = this.speed;
    this.lastYaw = this.yaw;
  }

  visualRoot(dt: number): THREE.Vector3 {
    const g = this.ground(this.feet.x, this.feet.z, this.feet.y + 0.5, 1.2);
    let y = this.feet.y;
    if (g && this.grounded) y = Math.min(this.feet.y + 0.02, g.y);
    if (!this.grounded) {
      this.visualY = y;
    } else {
      this.visualY =
        y > this.visualY ? damp(this.visualY, y, 14, dt) : damp(this.visualY, y, 20, dt);
    }
    return new THREE.Vector3(this.feet.x, this.visualY, this.feet.z);
  }
}

export function yawAt(raw: THREE.AnimationClip, t: number): number {
  const tr = raw.tracks.find((x) => x.name === 'root.quaternion');
  if (!tr) return 0;
  const n = tr.times.length;
  let i = 0;
  while (i < n - 2 && tr.times[i + 1] < t) i++;
  const k = clamp(
    (t - tr.times[i]) / ((tr.times[i + 1] ?? tr.times[i]) - tr.times[i] || 1),
    0,
    1
  );
  const q0 = new THREE.Quaternion().fromArray(tr.values, 0);
  const qa = new THREE.Quaternion().fromArray(tr.values, i * 4);
  const qb = new THREE.Quaternion().fromArray(tr.values, Math.min(n - 1, i + 1) * 4);
  qa.slerp(qb, k);
  const d = qa.multiply(q0.invert());
  return 2 * Math.atan2(d.y, d.w);
}
