/**
 * Adapted from `blendi/oil-paint` (`src/figure/animator.js`, CC0 1.0, Patch).
 * Phase-synced blend spaces by speed and direction, start/stop/turn/jump clips with root motion,
 * posture correction, spine curve distribution, turn lean, head look-toward, relaxed fingers,
 * and 2-bone leg/foot IK with ground foot-lock.
 */
import * as THREE from 'three';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { LoadedMan } from './man';

const wrap = (a: number) => ((a % 1) + 1) % 1;
const angleWrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const damp = (a: number, b: number, rate: number, dt: number) =>
  b + (a - b) * Math.exp(-rate * dt);
const clamp = THREE.MathUtils.clamp;

export interface AnimatorSetup {
  idle: string;
  idleMix: readonly [string, number][];
  walk: string;
  run: string;
  sprint: string;
  strafe: readonly [number, string, string][];
  speeds: {
    walk: number;
    run: number;
    sprint: number;
    strafeWalk: number;
    strafeJog: number;
  };
}

export const SETUP: AnimatorSetup = {
  idle: 'Idle',
  idleMix: [
    ['Idle', 0.4],
    ['AM_Idle', 0.6],
  ],
  walk: 'Walk',
  run: 'Run',
  sprint: 'Sprint',
  strafe: [
    [0, 'Walk', 'Jog'],
    [45, 'Walk_Fwd_L', 'Jog_Fwd_L'],
    [90, 'Walk_L', 'Jog_L'],
    [135, 'Walk_Bwd_L', 'Walk_Bwd_L'],
    [180, 'Walk_Bwd', 'Walk_Bwd'],
    [-135, 'Walk_Bwd_R', 'Walk_Bwd_R'],
    [-90, 'Walk_R', 'Jog_R'],
    [-45, 'Walk_Fwd_R', 'Jog_Fwd_R'],
  ],
  speeds: {
    walk: 1.45,
    run: 5.3,
    sprint: 7.4,
    strafeWalk: 1.45,
    strafeJog: 3.6,
  },
};

const ANYMOVE_HANDS =
  /^(Run|Sprint|Idle_Tired|Idle_To_Run|Idle_To_Sprint|Run_To_Idle|Sprint_To_Idle)$/;

export interface ClipAnalysisInfo {
  n: number;
  duration: number;
  feet: {
    l: THREE.Vector3[];
    r: THREE.Vector3[];
    lw: THREE.Vector3[];
    rw: THREE.Vector3[];
    pelvis: number[];
  };
  offset: number;
  stride: number;
  stance?: number;
  launch?: number;
  contact?: number;
}

export interface AnimSampleContext {
  speed: number;
  moveAngle: number;
  grounded: boolean;
  strafe?: boolean;
}

export interface ClipSamplePart {
  clip: string;
  w: number;
  time: number;
  synced?: boolean;
}

export interface AnimState {
  kind: string;
  clip?: string;
  u?: number;
  prevU?: number;
  from?: number;
  to?: number;
  rate?: number;
  loop?: boolean;
  done?: boolean;
  scale?: number;
  strafe?: boolean;
  last?: { speed: number; moveAngle: number };
  sample: (ctx: AnimSampleContext, dt: number) => ClipSamplePart[];
}

export interface GroundHit {
  y: number;
  normal: THREE.Vector3;
}

interface PostureFix {
  spine: number;
  clavicle: number;
}

interface FingerPoseEntry {
  bone: THREE.Bone;
  flat: THREE.Quaternion;
  fist: THREE.Quaternion;
  oflat: THREE.Quaternion;
  ofist: THREE.Quaternion;
  thumb: boolean;
}

export class Animator {
  man: LoadedMan;
  setup: AnimatorSetup;
  object: THREE.Group;
  bones: Record<string, THREE.Bone>;
  mixer: THREE.AnimationMixer;
  info: Record<string, ClipAnalysisInfo> = {};
  actions: [
    Record<string, THREE.AnimationAction>,
    Record<string, THREE.AnimationAction>,
    Record<string, THREE.AnimationAction>,
  ] = [{}, {}, {}];
  layers: { state: AnimState; weight: number; fade: number; slot: number; rising: boolean }[] = [];
  state!: AnimState;

  phase = 0;
  lean = 0;
  pitchLean = 0;
  tired = false;
  tiredMix = 0;
  idleClock = 0;
  ik = { l: 0, r: 0, pelvis: 0, on: true };
  lock: { l: THREE.Vector3 | null; r: THREE.Vector3 | null } | null = null;
  lockOff: { l: THREE.Vector3; r: THREE.Vector3 } | null = null;
  lastMix: [string, number, number][] = [];

  private idleClip: string;
  private spineRest: THREE.Quaternion[];
  private restShoulderX: number;
  private postureFix: PostureFix = { spine: 0, clavicle: 0 };
  private armMin: number | null = null;
  private armPush = { l: 0, r: 0 };
  private fingerPoses: FingerPoseEntry[] | null = null;
  private look = { yaw: 0, pitch: 0 };
  private upright = 0;

  constructor(man: LoadedMan, setup: AnimatorSetup = SETUP) {
    this.man = man;
    this.setup = setup;
    this.object = man.object;
    this.bones = man.bones;
    this.mixer = new THREE.AnimationMixer(this.object);
    this.idleClip = setup.idle;

    this.analyze();

    for (const [name, clip] of Object.entries(man.clips)) {
      for (let k = 0; k < 3; k++) {
        const a = this.mixer.clipAction(k ? clip.clone() : clip);
        a.play();
        a.setEffectiveWeight(0);
        a.timeScale = 0;
        this.actions[k][name] = a;
      }
    }

    this.spineRest = ['spine_01', 'spine_02', 'spine_03'].map((n) =>
      this.bones[n].quaternion.clone()
    );
    this.object.updateMatrixWorld(true);
    this.restShoulderX = Math.abs(
      this.bones.upperarm_l.getWorldPosition(new THREE.Vector3()).x - this.object.position.x
    );
    this.enter(this.locoState({ strafe: false }));
  }

  private analyze(): void {
    const rig = SkeletonUtils.clone(this.object) as THREE.Group;
    const mixer = new THREE.AnimationMixer(rig);
    const bones: Record<string, THREE.Bone> = {};
    rig.traverse((o) => {
      if ((o as THREE.Bone).isBone) bones[o.name] = o as THREE.Bone;
    });
    rig.updateMatrixWorld(true);

    const p = new THREE.Vector3();
    const rootPos = new THREE.Vector3();

    for (const [name, raw] of Object.entries(this.man.raw)) {
      const clip = this.man.clips[name];
      const a = mixer.clipAction(raw);
      a.setLoop(THREE.LoopOnce, 1);
      a.clampWhenFinished = true;
      a.play();

      const n = Math.max(2, Math.round(clip.duration * 30) + 1);
      const feet = {
        l: [] as THREE.Vector3[],
        r: [] as THREE.Vector3[],
        lw: [] as THREE.Vector3[],
        rw: [] as THREE.Vector3[],
        pelvis: [] as number[],
      };

      for (let i = 0; i < n; i++) {
        mixer.setTime((i / (n - 1)) * clip.duration);
        rig.updateMatrixWorld(true);
        rootPos.setFromMatrixPosition(bones.root.matrixWorld);
        for (const s of ['l', 'r'] as const) {
          bones[`foot_${s}`].getWorldPosition(p);
          feet[`${s}w`].push(p.clone());
          feet[s].push(p.clone().sub(rootPos));
        }
        bones.pelvis.getWorldPosition(p);
        feet.pelvis.push(p.y);
      }

      a.stop();
      mixer.uncacheAction(raw);

      const info: ClipAnalysisInfo = {
        n,
        duration: clip.duration,
        feet,
        offset: 0,
        stride: this.man.motion[name].speed * clip.duration,
      };

      if (/Walk|Jog|Run|Sprint/.test(name) && !/To_/.test(name)) {
        const sp: number[] = [];
        for (let i = 0; i < n - 1; i++) {
          sp.push(feet.lw[i + 1].distanceTo(feet.lw[i]) * 30);
        }
        const sorted = sp.slice().sort((x, y) => x - y);
        const slow = sorted[Math.floor(sorted.length * 0.4)] * 1.05 + 0.05;
        let best = 0;
        let bestLen = 0;
        for (let i = 0; i < sp.length; i++) {
          if (sp[i] > slow || sp[(i - 1 + sp.length) % sp.length] <= slow) continue;
          let len = 0;
          while (len < sp.length && sp[(i + len) % sp.length] <= slow) len++;
          if (len > bestLen) {
            bestLen = len;
            best = i;
          }
        }
        info.offset = best / (n - 1);
        info.stance = bestLen / (n - 1);
      }

      if (name === 'Jump_Start') {
        let best = 0;
        let bv = -Infinity;
        for (let i = 1; i < n; i++) {
          const v = feet.pelvis[i] - feet.pelvis[i - 1];
          if (v > bv) {
            bv = v;
            best = i;
          }
        }
        info.launch = Math.max(0, (best - 3) / (n - 1));
      }

      if (name === 'Jump_Land') info.contact = 0;
      this.info[name] = info;
    }

    this.postureFix = this.measurePosture(rig, bones, mixer);
    rig.traverse((o) => {
      const mesh = o as THREE.Mesh;
      mesh.geometry?.dispose?.();
    });
  }

  private shouldersForward(
    rig: THREE.Group,
    bones: Record<string, THREE.Bone>,
    mixer: THREE.AnimationMixer,
    fix: PostureFix | null
  ): number {
    const S = this.setup;
    const mix = S.idleMix ?? [[S.idle, 1]];
    const acts = mix.map(([c, w]) => {
      const a = mixer.clipAction(this.man.clips[c]);
      a.play();
      a.setEffectiveWeight(w);
      return a;
    });
    let sum = 0;
    const p = (n: string) => bones[n].getWorldPosition(new THREE.Vector3());
    for (const t of [0.1, 0.4, 0.7]) {
      acts.forEach((a) => {
        a.time = t * a.getClip().duration;
      });
      mixer.update(0);
      rig.updateMatrixWorld(true);
      this.applyPosture(bones, rig, fix);
      sum +=
        (p('upperarm_l').z + p('upperarm_r').z) / 2 -
        (p('foot_l').z + p('foot_r').z) / 2;
    }
    acts.forEach((a) => {
      a.stop();
      mixer.uncacheAction(a.getClip());
    });
    return sum / 3;
  }

  private measurePosture(
    rig: THREE.Group,
    bones: Record<string, THREE.Bone>,
    mixer: THREE.AnimationMixer
  ): PostureFix {
    const target = 0.02;
    const before = this.shouldersForward(rig, bones, mixer, null);
    let k = Math.max(0, before - target);
    let fix: PostureFix = { spine: 0, clavicle: 0 };
    for (let i = 0; i < 4; i++) {
      fix = {
        spine: clamp(Math.atan2(k * 0.5, 0.35), 0, 0.16),
        clavicle: clamp(Math.asin(Math.min(1, (k * 0.5) / 0.18)), 0, 0.4),
      };
      const after = this.shouldersForward(rig, bones, mixer, fix);
      k += after - target;
      if (Math.abs(after - target) < 0.005) break;
    }
    return fix;
  }

  currentFeet(): [THREE.Vector3, THREE.Vector3] {
    this.object.updateMatrixWorld(true);
    const inv = new THREE.Matrix4().copy(this.object.matrixWorld).invert();
    const r = new THREE.Vector3()
      .setFromMatrixPosition(this.bones.root.matrixWorld)
      .applyMatrix4(inv);
    return [
      this.bones.foot_l.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).sub(r),
      this.bones.foot_r.getWorldPosition(new THREE.Vector3()).applyMatrix4(inv).sub(r),
    ];
  }

  match(name: string, feet: [THREE.Vector3, THREE.Vector3], from = 0, to = 1): number {
    const info = this.info[name];
    let best = from;
    let bestD = Infinity;
    for (let i = 0; i < info.n; i++) {
      const u = i / (info.n - 1);
      if (u < from || u > to) continue;
      const d =
        info.feet.l[i].distanceToSquared(feet[0]) +
        info.feet.r[i].distanceToSquared(feet[1]);
      if (d < bestD) {
        bestD = d;
        best = u;
      }
    }
    return best;
  }

  matchPhase(name: string, feet: [THREE.Vector3, THREE.Vector3]): number {
    return wrap(this.match(name, feet) - this.info[name].offset);
  }

  enter(state: AnimState, fade = 0.2): AnimState {
    for (const l of this.layers) l.fade = Math.max(l.fade ?? 0, fade);
    const used = new Set(this.layers.map((l) => l.slot));
    const free = [0, 1, 2].find((k) => !used.has(k));
    const slot = free ?? this.layers.shift()!.slot;
    this.layers.push({
      state,
      weight: this.layers.length ? 0 : 1,
      fade,
      slot,
      rising: true,
    });
    this.state = state;
    return state;
  }

  locoState(opts: { strafe: boolean }): AnimState {
    const st: AnimState = {
      kind: 'loco',
      strafe: opts.strafe,
      sample: (ctx, dt) => {
        const live = this.state === st;
        if (live || !st.last) st.last = { speed: ctx.speed, moveAngle: ctx.moveAngle };
        return this.sampleLoco({ ...ctx, ...st.last, strafe: st.strafe }, dt, live);
      },
    };
    return st;
  }

  private sampleLoco(ctx: AnimSampleContext, dt: number, advance = true): ClipSamplePart[] {
    const S = this.setup;
    const sp = S.speeds;
    const v = ctx.speed;
    const out: { clip: string; w: number; synced: boolean; time?: number }[] = [];

    const add = (clip: string, w: number, synced = true) => {
      if (w <= 1e-4) return;
      if (clip === this.idleClip) {
        const k = this.tiredMix;
        if (1 - k > 1e-3) {
          for (const [c, cw] of S.idleMix) {
            out.push({ clip: c, w: w * cw * (1 - k), synced: false });
          }
        }
        if (k > 1e-3) {
          out.push({ clip: 'Idle_Tired', w: w * k, synced: false });
        }
        return;
      }
      out.push({ clip, w, synced });
    };

    if (advance) this.tiredMix = damp(this.tiredMix, this.tired ? 1 : 0, 1.2, dt);

    if (!ctx.strafe) {
      const k: [number, string][] = [
        [0, S.idle],
        [sp.walk, S.walk],
        [sp.run, S.run],
        [sp.sprint, S.sprint],
      ];
      if (v <= 0) {
        add(this.idleClip, 1, false);
      } else {
        let i = 0;
        while (i < k.length - 2 && v > k[i + 1][0]) i++;
        const t = clamp((v - k[i][0]) / (k[i + 1][0] - k[i][0]), 0, 1);
        add(i === 0 ? this.idleClip : k[i][1], 1 - t, i > 0);
        add(k[i + 1][1], t, true);
      }
    } else {
      const walkW = clamp(v / sp.strafeWalk, 0, 1);
      const jogT = clamp((v - sp.strafeWalk) / (sp.strafeJog - sp.strafeWalk), 0, 1);
      add(this.idleClip, 1 - walkW, false);
      this.dirBlend(
        S.strafe.map(([a, w]) => [a, w] as [number, string]),
        ctx.moveAngle,
        walkW * (1 - jogT),
        add
      );
      this.dirBlend(
        S.strafe.map(([a, , j]) => [a, j] as [number, string]),
        ctx.moveAngle,
        walkW * jogT,
        add
      );
    }

    const merged: Record<string, { clip: string; w: number; synced: boolean; time: number }> = {};
    for (const o of out) {
      (merged[o.clip] ??= { clip: o.clip, w: 0, synced: o.synced, time: 0 }).w += o.w;
    }
    const list = Object.values(merged);

    let stride = 0;
    let sw = 0;
    for (const o of list) {
      if (o.synced) {
        stride += this.info[o.clip].stride * o.w;
        sw += o.w;
      }
    }
    if (sw > 0 && advance) {
      stride /= sw;
      const cyc = stride > 0.05 ? v / stride : 0;
      this.phase = wrap(this.phase + cyc * dt);
    }

    for (const o of list) {
      const info = this.info[o.clip];
      o.time = o.synced
        ? wrap(this.phase + info.offset) * info.duration
        : this.idleClock % info.duration;
    }

    return list;
  }

  private dirBlend(
    ring: [number, string][],
    angle: number,
    w: number,
    add: (clip: string, w: number, synced?: boolean) => void
  ): void {
    if (w <= 1e-4) return;
    const deg = THREE.MathUtils.radToDeg(angleWrap(angle));
    const sorted = ring
      .map(([a, c]) => [((a % 360) + 360) % 360, c] as [number, string])
      .sort((x, y) => x[0] - y[0]);
    const d = ((deg % 360) + 360) % 360;
    for (let i = 0; i < sorted.length; i++) {
      const [a0, c0] = sorted[i];
      const [a1raw, c1] = sorted[(i + 1) % sorted.length];
      const a1 = a1raw <= a0 ? a1raw + 360 : a1raw;
      const dd = d < a0 ? d + 360 : d;
      if (dd >= a0 && dd <= a1) {
        const t = (dd - a0) / (a1 - a0);
        add(c0, w * (1 - t));
        add(c1, w * t);
        return;
      }
    }
  }

  oneShot(
    kind: string,
    clip: string,
    opts: { from?: number; to?: number; rate?: number; loop?: boolean } = {}
  ): AnimState {
    const { from = 0, to = 1, rate = 1, loop = false } = opts;
    const info = this.info[clip];
    const st: AnimState = {
      kind,
      clip,
      u: from,
      prevU: from,
      from,
      to,
      rate,
      loop,
      done: false,
      sample: (_ctx, dt) => {
        st.prevU = st.u!;
        st.u = st.u! + (dt * rate) / info.duration;
        if (st.u >= to) {
          if (loop) {
            st.u = from + wrap((st.u - from) / (to - from)) * (to - from);
          } else {
            st.u = to;
            st.done = true;
          }
        }
        return [{ clip, w: 1, time: st.u * info.duration }];
      },
    };
    return st;
  }

  update(dt: number, ctx: AnimSampleContext): void {
    this.idleClock += dt;
    for (const l of this.layers) {
      const k = dt / Math.max(1e-3, l.fade);
      l.weight =
        l === this.layers[this.layers.length - 1]
          ? Math.min(1, l.weight + k)
          : Math.max(0, l.weight - k);
    }
    this.layers = this.layers.filter((l, i) => l.weight > 0 || i === this.layers.length - 1);
    const total = this.layers.reduce((s, l) => s + l.weight, 0) || 1;

    const want = [
      new Map<string, { w: number; time: number }>(),
      new Map<string, { w: number; time: number }>(),
      new Map<string, { w: number; time: number }>(),
    ];

    for (const l of this.layers) {
      const parts = l.state.sample(ctx, dt);
      for (const p of parts) {
        const m = want[l.slot];
        const e = m.get(p.clip) ?? { w: 0, time: p.time };
        e.w += (p.w * l.weight) / total;
        e.time = p.time;
        m.set(p.clip, e);
      }
    }

    this.lastMix = [];
    for (let k = 0; k < 3; k++) {
      for (const [name, e] of want[k]) {
        if (e.w > 0.005) {
          this.lastMix.push([name, +e.w.toFixed(3), +e.time.toFixed(3)]);
        }
      }
    }
    this.lastMix.sort((a, b) => b[1] - a[1]);

    for (let k = 0; k < 3; k++) {
      for (const [name, a] of Object.entries(this.actions[k])) {
        const e = want[k].get(name);
        if (e) {
          a.setEffectiveWeight(e.w);
          a.time = e.time;
        } else {
          a.setEffectiveWeight(0);
        }
      }
    }

    this.mixer.update(0);
    this.object.updateMatrixWorld(true);
    this.evenSpine(this.bones);
    this.applyPosture(this.bones, this.object, this.postureFix);
    this.object.updateMatrixWorld(true);
  }

  private evenSpine(bones: Record<string, THREE.Bone>): void {
    const chain = [bones.spine_01, bones.spine_02, bones.spine_03];
    const rel = new THREE.Quaternion();
    const total = new THREE.Quaternion();
    const restTotal = new THREE.Quaternion();
    for (let i = 0; i < 3; i++) {
      total.multiply(chain[i].quaternion);
      restTotal.multiply(this.spineRest[i]);
    }
    rel.copy(restTotal).invert().multiply(total);
    const ident = new THREE.Quaternion();
    const parts = [
      ident.clone().slerp(rel, 1 / 3),
      ident.clone().slerp(rel, 2 / 3),
      rel.clone(),
    ];
    let built = new THREE.Quaternion();
    const restSoFar = new THREE.Quaternion();
    for (let i = 0; i < 3; i++) {
      restSoFar.multiply(this.spineRest[i]);
      const target = restSoFar.clone().multiply(parts[i]);
      chain[i].quaternion.copy(built.clone().invert().multiply(target));
      built = target;
    }
  }

  private applyPosture(
    bones: Record<string, THREE.Bone>,
    object: THREE.Group,
    fix: PostureFix | null
  ): void {
    if (!fix) return;
    const q = object.quaternion;
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);

    const rot = (b: THREE.Bone, axis: THREE.Vector3, a: number) => {
      const qa = new THREE.Quaternion().setFromAxisAngle(axis, a);
      const pq = b.parent!.getWorldQuaternion(new THREE.Quaternion());
      const wq = b.getWorldQuaternion(new THREE.Quaternion());
      b.quaternion.copy(pq.invert().multiply(qa.multiply(wq)));
      b.updateMatrixWorld(true);
    };

    rot(bones.spine_02, right, fix.spine * 0.5);
    rot(bones.spine_03, right, fix.spine * 0.5);
    rot(bones.neck_01, right, -fix.spine * 0.85);
    rot(bones.clavicle_l, up, fix.clavicle);
    rot(bones.clavicle_r, up, -fix.clavicle);
    rot(bones.clavicle_l, fwd, -fix.clavicle * 0.25);
    rot(bones.clavicle_r, fwd, fix.clavicle * 0.25);
    rot(bones.upperarm_l, fwd, fix.clavicle * 0.25);
    rot(bones.upperarm_r, fwd, -fix.clavicle * 0.25);
    rot(bones.upperarm_l, up, -fix.clavicle);
    rot(bones.upperarm_r, up, fix.clavicle);
  }

  armClearance(dt: number): void {
    const b = this.bones;
    const o = this.object;
    if (this.armMin == null) this.armMin = this.restShoulderX * 0.86;
    const inv = new THREE.Matrix4().copy(o.matrixWorld).invert();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(o.quaternion);
    const loc = (n: string) => b[n].getWorldPosition(new THREE.Vector3()).applyMatrix4(inv);
    const mid = loc('spine_03').x;

    for (const [s, sign] of [
      ['l', 1],
      ['r', -1],
    ] as const) {
      const sh = loc(`upperarm_${s}`);
      const el = loc(`lowerarm_${s}`);
      const out = (el.x - mid) * sign;
      const len = sh.distanceTo(el) || 0.27;
      const need = clamp(Math.asin(clamp((this.armMin - out) / len, 0, 0.9)), 0, 0.6);
      this.armPush[s] = need > this.armPush[s] ? need : damp(this.armPush[s], need, 6, dt);
      if (this.armPush[s] > 1e-4) {
        this.rotateWorld(b[`upperarm_${s}`], fwd, this.armPush[s] * sign);
      }
    }
  }

  relaxHands(speed: number, weight = 1): void {
    if (!this.fingerPoses) {
      this.fingerPoses = [];
      const flat = this.man.raw.TPose;
      const fist = this.man.raw.Idle;
      if (flat && fist) {
        for (const name of Object.keys(this.bones)) {
          if (!/^(index|middle|ring|pinky|thumb)_0[123]_[lr]$/.test(name)) continue;
          const a = flat.tracks.find((t) => t.name === `${name}.quaternion`);
          const b = fist.tracks.find((t) => t.name === `${name}.quaternion`);
          const o = this.man.hands[name];
          if (!a || !b || !o) continue;
          this.fingerPoses.push({
            bone: this.bones[name],
            flat: new THREE.Quaternion().fromArray(a.values, 0),
            fist: new THREE.Quaternion().fromArray(b.values, 0),
            oflat: new THREE.Quaternion().fromArray(o.flat),
            ofist: new THREE.Quaternion().fromArray(o.fist),
            thumb: name.startsWith('thumb'),
          });
        }
      }
    }

    const k = THREE.MathUtils.lerp(0.42, 0.72, clamp((speed - 2) / 4, 0, 1));
    const share = clamp(
      this.lastMix.reduce((s, [c, w]) => s + (ANYMOVE_HANDS.test(c) ? w : 0), 0),
      0,
      1
    );
    const q = new THREE.Quaternion();
    const o = new THREE.Quaternion();
    for (const f of this.fingerPoses) {
      q.slerpQuaternions(f.flat, f.fist, f.thumb ? k * 0.8 : k);
      if (share > 0) {
        o.slerpQuaternions(f.oflat, f.ofist, f.thumb ? k * 0.8 : k);
        q.slerp(o, share);
      }
      f.bone.quaternion.slerp(q, weight);
    }
  }

  rotateWorld(bone: THREE.Bone, axis: THREE.Vector3, angle: number): void {
    const q = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(q.multiply(worldQ)));
    bone.updateMatrixWorld(true);
  }

  rotateWorldQ(bone: THREE.Bone, q: THREE.Quaternion): void {
    const parentQ = bone.parent!.getWorldQuaternion(new THREE.Quaternion());
    const worldQ = bone.getWorldQuaternion(new THREE.Quaternion());
    bone.quaternion.copy(parentQ.invert().multiply(q.clone().multiply(worldQ)));
    bone.updateMatrixWorld(true);
  }

  lookToward(dt: number, dirWorld: THREE.Vector3, weight: number): void {
    const inv = new THREE.Quaternion().copy(this.object.quaternion).invert();
    const d = dirWorld.clone().applyQuaternion(inv);
    const yaw = clamp(Math.atan2(d.x, d.z), -1.0, 1.0);
    const behind = Math.abs(Math.atan2(d.x, d.z)) > 1.9;
    const pitch = clamp(Math.asin(clamp(d.y, -1, 1)) * 0.5, -0.2, 0.3);

    this.look.yaw = damp(this.look.yaw, behind ? 0 : yaw * weight, 5, dt);
    this.look.pitch = damp(this.look.pitch, behind ? 0 : (pitch + 0.08) * weight, 5, dt);

    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3(-1, 0, 0)
      .applyQuaternion(this.object.quaternion)
      .applyAxisAngle(up, this.look.yaw);

    for (const [b, k] of [
      ['spine_03', 0.2],
      ['neck_01', 0.35],
      ['Head', 0.45],
    ] as const) {
      this.rotateWorld(this.bones[b], up, this.look.yaw * k);
      this.rotateWorld(this.bones[b], right, this.look.pitch * k);
    }
  }

  uprightTrunk(dt: number, speed: number, weight = 1): void {
    const b = this.bones;
    const q = this.object.quaternion;
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(q);
    const trunk = b.neck_01
      .getWorldPosition(new THREE.Vector3())
      .sub(b.pelvis.getWorldPosition(new THREE.Vector3()));
    const lean = Math.atan2(trunk.dot(fwd), trunk.y);

    const k: [number, number][] = [
      [0, 4],
      [1.45, 6],
      [5.3, 11],
      [7.4, 14],
    ];
    let want = k[k.length - 1][1];
    for (let i = 0; i < k.length - 1; i++) {
      if (speed <= k[i + 1][0]) {
        want =
          k[i][1] +
          ((speed - k[i][0]) / (k[i + 1][0] - k[i][0])) * (k[i + 1][1] - k[i][1]);
        break;
      }
    }

    const moving = clamp((speed - 0.4) / 1.0, 0, 1);
    const extra =
      clamp(lean - THREE.MathUtils.degToRad(want), 0, THREE.MathUtils.degToRad(22)) *
      weight *
      moving;
    this.upright = damp(this.upright, extra, 8, dt);

    for (const n of ['spine_01', 'spine_02', 'spine_03']) {
      this.rotateWorld(b[n], right, this.upright * 0.45);
    }
    this.rotateWorld(b.neck_01, right, -this.upright * 0.45);
  }

  leanInto(dt: number, turnRate: number, speed: number, forwardAccel: number): void {
    const target = clamp(-turnRate * speed * 0.035, -0.22, 0.22);
    this.lean = damp(this.lean, target, 6, dt);
    this.pitchLean = damp(this.pitchLean, clamp(forwardAccel * 0.012, -0.08, 0.1), 5, dt);

    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion);
    const right = new THREE.Vector3(-1, 0, 0).applyQuaternion(this.object.quaternion);

    for (const [b, k] of [
      ['spine_01', 0.35],
      ['spine_02', 0.35],
      ['spine_03', 0.3],
    ] as const) {
      this.rotateWorld(this.bones[b], fwd, this.lean * k);
      this.rotateWorld(this.bones[b], right, -this.pitchLean * k);
    }
  }

  private legIK(side: 'l' | 'r', delta: THREE.Vector3): void {
    const hip = this.bones[`thigh_${side}`];
    const knee = this.bones[`calf_${side}`];
    const foot = this.bones[`foot_${side}`];

    const H = hip.getWorldPosition(new THREE.Vector3());
    const K = knee.getWorldPosition(new THREE.Vector3());
    const A = foot.getWorldPosition(new THREE.Vector3());
    const footQ = foot.getWorldQuaternion(new THREE.Quaternion());
    const T = A.clone().add(delta);

    const l1 = H.distanceTo(K);
    const l2 = K.distanceTo(A);
    const toT = T.clone().sub(H);
    const d = clamp(toT.length(), Math.abs(l1 - l2) + 1e-3, l1 + l2 - 1e-3);
    toT.setLength(d);

    const axis = toT.clone().normalize();
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(this.object.quaternion);
    const pole = K.clone().sub(H);
    pole.sub(axis.clone().multiplyScalar(pole.dot(axis)));
    const fwdP = fwd.clone().sub(axis.clone().multiplyScalar(fwd.dot(axis))).normalize();

    const along = pole.lengthSq() < 1e-6 ? -1 : pole.clone().normalize().dot(fwdP);
    const pull = clamp((0.5 - along) / 0.7, 0, 1);
    pole
      .normalize()
      .multiplyScalar(1 - pull)
      .addScaledVector(fwdP, pull * 1.2 + 1e-3)
      .normalize();

    const cosA = clamp((l1 * l1 + d * d - l2 * l2) / (2 * l1 * d), -1, 1);
    const newK = H.clone()
      .addScaledVector(axis, l1 * cosA)
      .addScaledVector(pole, l1 * Math.sqrt(Math.max(0, 1 - cosA * cosA)));

    const q1 = new THREE.Quaternion().setFromUnitVectors(
      K.clone().sub(H).normalize(),
      newK.clone().sub(H).normalize()
    );
    this.rotateWorldQ(hip, q1);

    const K2 = knee.getWorldPosition(new THREE.Vector3());
    const A2 = foot.getWorldPosition(new THREE.Vector3());
    const q2 = new THREE.Quaternion().setFromUnitVectors(
      A2.clone().sub(K2).normalize(),
      H.clone().add(toT).sub(K2).normalize()
    );
    this.rotateWorldQ(knee, q2);

    const parentQ = foot.parent!.getWorldQuaternion(new THREE.Quaternion());
    foot.quaternion.copy(parentQ.invert().multiply(footQ));
    foot.updateMatrixWorld(true);
  }

  placeFeet(
    dt: number,
    ground: (x: number, z: number, fromY: number) => GroundHit | null,
    rootY: number,
    weight = 1
  ): void {
    const ik = this.ik;
    const res: Record<
      'l' | 'r',
      { ankle: THREE.Vector3; off: number; normal: THREE.Vector3; lift: number; ballLift: number }
    > = {} as never;

    for (const s of ['l', 'r'] as const) {
      const ankle = this.bones[`foot_${s}`].getWorldPosition(new THREE.Vector3());
      const ball = this.bones[`ball_${s}`].getWorldPosition(new THREE.Vector3());
      const g1 = ground(ankle.x, ankle.z, rootY + 0.7);
      const g2 = ground(ball.x, ball.z, rootY + 0.7);

      let gy = rootY;
      let normal = new THREE.Vector3(0, 1, 0);
      if (g1 || g2) {
        const a = g1 ?? g2!;
        const b = g2 ?? g1!;
        gy = Math.max(a.y, b.y);
        normal = a.normal.clone().add(b.normal).normalize();
      }

      const lift = ankle.y - rootY;
      const planted = clamp(1 - (lift - 0.11) / 0.1, 0, 1);
      const offPlanted = clamp(gy - rootY, -0.45, 0.45);
      const offSwing = clamp(gy + 0.1 - ankle.y, 0, 0.45);
      const off = (offPlanted * planted + offSwing * (1 - planted)) * weight;

      ik[s] = damp(ik[s], off, 18, dt);
      res[s] = { ankle, off: ik[s], normal, lift, ballLift: ball.y - rootY };
    }

    const lock = (this.lock ??= { l: null, r: null });
    const lockOff = (this.lockOff ??= { l: new THREE.Vector3(), r: new THREE.Vector3() });

    for (const s of ['l', 'r'] as const) {
      const r = res[s];
      const planted = weight > 0.5 && r.lift < 0.125 && r.ballLift < 0.055;
      if (planted) {
        if (!lock[s]) lock[s] = r.ankle.clone().sub(lockOff[s].clone().multiplyScalar(-1));
        let d = lock[s]!.clone().sub(r.ankle);
        d.y = 0;
        if (d.length() > 0.2) {
          lock[s]!.lerp(r.ankle, Math.min(1, 12 * dt));
          d = lock[s]!.clone().sub(r.ankle);
          d.y = 0;
        }
        lockOff[s].copy(d);
      } else {
        lock[s] = null;
        lockOff[s].multiplyScalar(Math.exp(-16 * dt));
      }
    }

    const pelvisDrop = Math.min(0, res.l.off, res.r.off);
    ik.pelvis = damp(ik.pelvis, pelvisDrop, 12, dt);
    if (!ik.on) return;

    const pelvis = this.bones.pelvis;
    const pw = pelvis
      .getWorldPosition(new THREE.Vector3())
      .add(new THREE.Vector3(0, ik.pelvis, 0));
    pelvis.position.copy(pelvis.parent!.worldToLocal(pw));
    pelvis.updateMatrixWorld(true);

    for (const s of ['l', 'r'] as const) {
      const r = res[s];
      this.legIK(s, new THREE.Vector3(lockOff[s].x, r.off - ik.pelvis, lockOff[s].z));
      const planted = clamp(1 - (r.lift - 0.09) / 0.12, 0, 1) * weight;
      const n = r.normal.clone();
      if (n.y < 0.75) n.lerp(new THREE.Vector3(0, 1, 0), 0.5).normalize();
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
      const ident = new THREE.Quaternion();
      ident.slerp(q, planted);
      this.rotateWorldQ(this.bones[`foot_${s}`], ident);
    }
  }
}
