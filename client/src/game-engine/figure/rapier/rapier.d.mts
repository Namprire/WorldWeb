export interface Vector3Like {
  x: number;
  y: number;
  z: number;
}

export class Ray {
  origin: Vector3Like;
  dir: Vector3Like;
  constructor(origin: Vector3Like, dir: Vector3Like);
}

export interface RayColliderIntersection {
  timeOfImpact: number;
  normal: Vector3Like;
}

export class RigidBodyDesc {
  static kinematicPositionBased(): RigidBodyDesc;
  static fixed(): RigidBodyDesc;
  setTranslation(x: number, y: number, z: number): this;
}

export class RigidBody {
  translation(): Vector3Like;
  setTranslation(t: Vector3Like, wakeUp: boolean): void;
  setNextKinematicTranslation(t: Vector3Like): void;
}

export class ColliderDesc {
  static capsule(halfHeight: number, radius: number): ColliderDesc;
  static cuboid(hx: number, hy: number, hz: number): ColliderDesc;
  static cylinder(halfHeight: number, radius: number): ColliderDesc;
  setFriction(f: number): this;
  setTranslation(x: number, y: number, z: number): this;
}

export type Collider = object;

export class KinematicCharacterController {
  setUp(v: Vector3Like): void;
  enableAutostep(maxHeight: number, minWidth: number, includeDynamicBodies: boolean): void;
  enableSnapToGround(distance: number): void;
  setMaxSlopeClimbAngle(angle: number): void;
  setMinSlopeSlideAngle(angle: number): void;
  setSlideEnabled(enabled: boolean): void;
  computeColliderMovement(collider: Collider, desiredTranslation: Vector3Like): void;
  computedMovement(): Vector3Like;
  computedGrounded(): boolean;
}

export class World {
  constructor(gravity: Vector3Like);
  createRigidBody(desc: RigidBodyDesc): RigidBody;
  createCollider(desc: ColliderDesc, parent?: RigidBody): Collider;
  createCharacterController(offset: number): KinematicCharacterController;
  castRay(
    ray: Ray,
    maxToi: number,
    solid: boolean,
    filterFlags?: number,
    filterGroups?: number,
    excludeCollider?: Collider
  ): { timeOfImpact: number } | null;
  castRayAndGetNormal(
    ray: Ray,
    maxToi: number,
    solid: boolean,
    filterFlags?: number,
    filterGroups?: number,
    excludeCollider?: Collider
  ): RayColliderIntersection | null;
  propagateModifiedBodyPositionsToColliders(): void;
  step(): void;
  free(): void;
}

declare const RAPIER: {
  init(): Promise<void>;
  World: typeof World;
  Ray: typeof Ray;
  RigidBodyDesc: typeof RigidBodyDesc;
  ColliderDesc: typeof ColliderDesc;
};

export default RAPIER;
