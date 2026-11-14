/**
 * Adapted from `blendi/oil-paint` (`src/figure/camera.js` & `src/night/main.js`, MIT, Patch)
 * + GTA V over-the-shoulder / first-person (`V`) / supercar chase camera & trauma shake (`game-feel`).
 */
import * as THREE from 'three';

const damp = (a: number, b: number, rate: number, dt: number) =>
  b + (a - b) * Math.exp(-rate * dt);

export class FollowCamera {
  camera: THREE.PerspectiveCamera;
  yaw = Math.PI; // Facing North (-Z) toward NVIDIA Tower at spawn
  pitch = 0.14; // Slight elevated GTA V downward angle
  want = 4.6;
  distance = 4.6;
  side = 0.62; // GTA V over-the-right-shoulder lateral framing
  lift = 0.55;
  sink = 0.45;
  pivot = new THREE.Vector3();

  firstPersonTarget = false;
  firstBlend = 0;

  private outlook = new THREE.Vector3();
  private eyeAt = new THREE.Vector3();
  private gaze = new THREE.Vector3();
  private shakeClock = 0;

  constructor(camera: THREE.PerspectiveCamera) {
    this.camera = camera;
  }

  toggleFirstPerson(): void {
    this.firstPersonTarget = !this.firstPersonTarget;
  }

  update(
    dt: number,
    target: THREE.Vector3,
    look: { x: number; y: number },
    zoom: number,
    castRay: (origin: THREE.Vector3, dir: THREE.Vector3, max: number) => number | null,
    groundAt: (x: number, z: number) => number,
    opts: {
      inVehicle?: boolean;
      vehicleYaw?: number;
      vehicleSpeed?: number;
      trauma?: number;
    } = {}
  ): number {
    const cam = this.camera;
    this.shakeClock += dt * 32;

    this.yaw -= look.x;
    this.pitch = THREE.MathUtils.clamp(this.pitch + look.y, -0.58, 1.05);
    this.want = THREE.MathUtils.clamp(this.want + zoom * 0.5, 2.4, 12.5);

    // Gentle auto-align behind vehicle when driving without active mouse look
    if (opts.inVehicle && opts.vehicleYaw != null && Math.abs(look.x) < 1e-4 && Math.abs(opts.vehicleSpeed ?? 0) > 1.8) {
      const diff = Math.atan2(
        Math.sin(opts.vehicleYaw - this.yaw),
        Math.cos(opts.vehicleYaw - this.yaw)
      );
      this.yaw += diff * (1 - Math.exp(-2.8 * dt));
    }

    const wantFirst = !opts.inVehicle && this.firstPersonTarget ? 1 : 0;
    this.firstBlend += (wantFirst - this.firstBlend) * (1 - Math.exp(-7 * dt));
    const fp = this.firstBlend * this.firstBlend * (3 - 2 * this.firstBlend);

    const targetHeight = opts.inVehicle ? 1.15 : 1.38;
    const goal = new THREE.Vector3(target.x, target.y + targetHeight, target.z);
    if (this.pivot.lengthSq() === 0) this.pivot.copy(goal);

    const followRate = opts.inVehicle ? 14 : 11;
    this.pivot.x = damp(this.pivot.x, goal.x, followRate, dt);
    this.pivot.z = damp(this.pivot.z, goal.z, followRate, dt);
    this.pivot.y = damp(this.pivot.y, goal.y, opts.inVehicle ? 10 : 6, dt);

    const cp = Math.cos(this.pitch);
    const sp = Math.sin(this.pitch);
    const back = new THREE.Vector3(-Math.sin(this.yaw) * cp, sp, -Math.cos(this.yaw) * cp);
    const right = new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw));

    const baseDist = opts.inVehicle ? Math.max(6.2, this.want + 1.8) : this.want;
    const lateralSide = opts.inVehicle ? 0 : this.side * Math.min(1, baseDist / 5.2);
    const from = this.pivot.clone().addScaledVector(right, lateralSide);

    const hit = castRay(from, back, baseDist + 0.45);
    const free = hit == null ? baseDist : Math.max(0.9, hit - 0.32);
    // Asymmetric push-in / pull-out (`camera-systems` & `oil-paint`)
    this.distance =
      free < this.distance
        ? damp(this.distance, free, 18, dt)
        : damp(this.distance, free, 2.8, dt);

    cam.position.copy(from).addScaledVector(back, this.distance);

    const floor = groundAt(cam.position.x, cam.position.z) + 0.42;
    let raised = 0;
    if (cam.position.y < floor) {
      raised = floor - cam.position.y;
      cam.position.y = floor;
    }

    const liftAmt = opts.inVehicle ? 0.32 : this.lift * Math.min(1, baseDist / 5.2);
    cam.lookAt(
      from.x - back.x * 6,
      from.y - back.y * 6 + liftAmt - raised * this.sink,
      from.z - back.z * 6
    );

    // Smooth blend into first-person eye camera (`V` key from `oil-paint`)
    if (fp > 0.002) {
      this.gaze.set(Math.sin(this.yaw) * cp, -sp, Math.cos(this.yaw) * cp);
      this.eyeAt.set(
        target.x + Math.sin(this.yaw) * 0.08,
        target.y + 1.67,
        target.z + Math.cos(this.yaw) * 0.08
      );
      cam.getWorldDirection(this.outlook).multiplyScalar(6).add(cam.position);
      cam.position.lerp(this.eyeAt, fp);
      cam.lookAt(this.outlook.lerp(this.eyeAt.clone().addScaledVector(this.gaze, 6), fp));
    }

    // Dynamic FOV boost when sprinting / driving fast / first-person
    const speedFovBoost = opts.inVehicle
      ? Math.min(10, Math.abs(opts.vehicleSpeed ?? 0) * 0.42)
      : 0;
    const targetFov = 52 + 16 * fp + speedFovBoost;
    if (Math.abs(cam.fov - targetFov) > 0.05) {
      cam.fov = damp(cam.fov, targetFov, 8, dt);
      cam.near = 0.25 - 0.15 * fp;
      cam.updateProjectionMatrix();
    }

    // Trauma screen shake (`game-feel` quadratic trauma^2)
    const tr = opts.trauma ?? 0;
    if (tr > 0.005) {
      const mag = tr * tr * 0.35;
      cam.position.x += Math.sin(this.shakeClock * 1.7) * mag;
      cam.position.y += Math.cos(this.shakeClock * 2.3) * mag * 0.7;
    }

    cam.updateMatrixWorld(true);
    return fp;
  }
}
