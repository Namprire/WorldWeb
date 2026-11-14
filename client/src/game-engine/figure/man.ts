/**
 * Adapted from `blendi/oil-paint` (`src/figure/man.js`, CC0 1.0, Patch) + realistic PBR
 * Jensen Huang leather-jacket customization & shared singleton loader for WEBWORLD.
 */
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/examples/jsm/utils/SkeletonUtils.js';
import { getLeatherJacketMaps } from '../pbrTextures';

export interface ClipMotionInfo {
  speed: number;
  velocity: THREE.Vector3;
  yaw: number;
  duration: number;
}

export type HandFingerPoses = Record<
  string,
  { flat: [number, number, number, number]; fist: [number, number, number, number] }
>;

export interface LoadedMan {
  object: THREE.Group;
  meshes: THREE.SkinnedMesh[];
  bones: Record<string, THREE.Bone>;
  clips: Record<string, THREE.AnimationClip>;
  motion: Record<string, ClipMotionInfo>;
  raw: Record<string, THREE.AnimationClip>;
  hands: HandFingerPoses;
}

interface RawSharedBundle {
  templateScene: THREE.Group;
  animations: THREE.AnimationClip[];
  hands: HandFingerPoses;
}

let sharedBundlePromise: Promise<RawSharedBundle> | null = null;

async function fetchSharedBundle(base = '/figure/'): Promise<RawSharedBundle> {
  if (!sharedBundlePromise) {
    const loader = new GLTFLoader();
    sharedBundlePromise = Promise.all([
      loader.loadAsync(`${base}starter-man.glb`),
      loader.loadAsync(`${base}starter-man-clips.glb`),
      fetch(`${base}hands-anymove.json`).then((r) => r.json() as Promise<HandFingerPoses>),
    ]).then(([m, c, hands]) => ({
      templateScene: m.scene,
      animations: c.animations,
      hands,
    }));
  }
  return sharedBundlePromise;
}

/**
 * Loads a rigged character instance with all in-place & raw mocap clips ready for `Animator`.
 */
export async function loadMan(base = '/figure/'): Promise<LoadedMan> {
  const bundle = await fetchSharedBundle(base);
  const object = SkeletonUtils.clone(bundle.templateScene) as THREE.Group;

  const meshes: THREE.SkinnedMesh[] = [];
  object.traverse((o) => {
    if ((o as THREE.SkinnedMesh).isSkinnedMesh) {
      const sm = o as THREE.SkinnedMesh;
      sm.castShadow = true;
      sm.receiveShadow = true;
      sm.frustumCulled = false;
      meshes.push(sm);
    }
  });

  const bones: Record<string, THREE.Bone> = {};
  object.traverse((o) => {
    if ((o as THREE.Bone).isBone) {
      bones[o.name] = o as THREE.Bone;
    }
  });

  const clips: Record<string, THREE.AnimationClip> = {};
  const motion: Record<string, ClipMotionInfo> = {};
  const raw: Record<string, THREE.AnimationClip> = {};

  for (const clip of bundle.animations) {
    raw[clip.name] = clip;
    const root = clip.tracks.find((t) => t.name === 'root.position');
    const rootRot = clip.tracks.find((t) => t.name === 'root.quaternion');
    const mInfo: ClipMotionInfo = {
      speed: 0,
      velocity: new THREE.Vector3(),
      yaw: 0,
      duration: clip.duration,
    };

    if (root) {
      const v = root.values;
      const n = v.length;
      mInfo.velocity
        .set(v[n - 3] - v[0], 0, v[n - 1] - v[2])
        .divideScalar(clip.duration || 1);
      mInfo.speed = mInfo.velocity.length();
    }
    if (rootRot) {
      const v = rootRot.values;
      const n = v.length;
      const q0 = new THREE.Quaternion().fromArray(v, 0);
      const q1 = new THREE.Quaternion().fromArray(v, n - 4);
      const d = q1.multiply(q0.invert());
      mInfo.yaw = 2 * Math.atan2(d.y, d.w);
    }

    motion[clip.name] = mInfo;
    clips[clip.name] = new THREE.AnimationClip(
      clip.name,
      clip.duration,
      clip.tracks.filter((t) => !t.name.startsWith('root.'))
    );
  }

  return { object, meshes, bones, clips, motion, raw, hands: bundle.hands };
}

/** Samples a raw clip's root track at time t: ground position (character space). */
export function rootAt(
  clip: THREE.AnimationClip,
  t: number,
  outPos = new THREE.Vector3()
): THREE.Vector3 {
  const tr = clip.tracks.find((x) => x.name === 'root.position');
  if (!tr) return outPos.set(0, 0, 0);
  const times = tr.times;
  const v = tr.values;
  if (t <= times[0]) return outPos.set(v[0], 0, v[2]);
  const last = times.length - 1;
  if (t >= times[last]) return outPos.set(v[last * 3], 0, v[last * 3 + 2]);
  let i = 0;
  while (times[i + 1] < t) i++;
  const k = (t - times[i]) / (times[i + 1] - times[i]);
  return outPos.set(
    v[i * 3] + (v[i * 3 + 3] - v[i * 3]) * k,
    0,
    v[i * 3 + 2] + (v[i * 3 + 5] - v[i * 3 + 2]) * k
  );
}

/**
 * Splits a SkinnedMesh geometry's triangles into multiple material groups using bind-pose vertex positions.
 */
function partitionSkinnedGeometry(
  geom: THREE.BufferGeometry,
  classifyTriangle: (ax: number, ay: number, az: number) => number,
  inflateGroup?: { groupIndex: number; offsetMeters: number }
): THREE.BufferGeometry {
  const cloned = geom.clone();
  const pos = cloned.attributes.position as THREE.BufferAttribute;
  const nrm = cloned.attributes.normal as THREE.BufferAttribute | undefined;

  // Optionally inflate sleeve vertices slightly outward along normal so leather jacket sleeves wrap cleanly
  if (inflateGroup && nrm) {
    for (let v = 0; v < pos.count; v++) {
      const vx = pos.getX(v);
      const vy = pos.getY(v);
      const vz = pos.getZ(v);
      if (classifyTriangle(vx, vy, vz) === inflateGroup.groupIndex) {
        pos.setXYZ(
          v,
          vx + nrm.getX(v) * inflateGroup.offsetMeters,
          vy + nrm.getY(v) * inflateGroup.offsetMeters,
          vz + nrm.getZ(v) * inflateGroup.offsetMeters
        );
      }
    }
    pos.needsUpdate = true;
  }

  const srcIndex = cloned.getIndex();
  const triCount = srcIndex ? srcIndex.count / 3 : pos.count / 3;
  const buckets = new Map<number, number[]>();

  for (let t = 0; t < triCount; t++) {
    const i0 = srcIndex ? srcIndex.getX(t * 3) : t * 3;
    const i1 = srcIndex ? srcIndex.getX(t * 3 + 1) : t * 3 + 1;
    const i2 = srcIndex ? srcIndex.getX(t * 3 + 2) : t * 3 + 2;

    const cx = (pos.getX(i0) + pos.getX(i1) + pos.getX(i2)) / 3;
    const cy = (pos.getY(i0) + pos.getY(i1) + pos.getY(i2)) / 3;
    const cz = (pos.getZ(i0) + pos.getZ(i1) + pos.getZ(i2)) / 3;

    const gIdx = classifyTriangle(cx, cy, cz);
    let arr = buckets.get(gIdx);
    if (!arr) {
      arr = [];
      buckets.set(gIdx, arr);
    }
    arr.push(i0, i1, i2);
  }

  const sortedKeys = [...buckets.keys()].sort((a, b) => a - b);
  const newIndices: number[] = [];
  cloned.clearGroups();

  let offset = 0;
  for (const key of sortedKeys) {
    const tris = buckets.get(key)!;
    for (let k = 0; k < tris.length; k++) newIndices.push(tris[k]);
    cloned.addGroup(offset, tris.length, key);
    offset += tris.length;
  }

  cloned.setIndex(newIndices);
  return cloned;
}

/**
 * Customizes the rigged human character as realistic **Jensen Huang** in his iconic
 * pebble-grain black leather biker jacket, dark denim jeans, black/white sneakers,
 * salt-and-pepper cropped silver hair, and titanium rimless glasses attached to `Head`.
 */
export function styleAsJensenHuang(man: LoadedMan): void {
  const leatherMaps = getLeatherJacketMaps();

  const leatherMat = new THREE.MeshPhysicalMaterial({
    color: '#181a1f',
    map: leatherMaps.map,
    normalMap: leatherMaps.normalMap,
    normalScale: new THREE.Vector2(0.85, 0.85),
    roughnessMap: leatherMaps.roughnessMap,
    roughness: 0.36,
    metalness: 0.08,
    clearcoat: 0.48,
    clearcoatRoughness: 0.32,
    envMapIntensity: 1.35,
  });

  const teeShirtMat = new THREE.MeshStandardMaterial({
    color: '#111317',
    roughness: 0.82,
    metalness: 0.02,
  });

  const zipperTrimMat = new THREE.MeshStandardMaterial({
    color: '#cbd5e1',
    metalness: 0.92,
    roughness: 0.18,
    envMapIntensity: 1.5,
  });

  const darkJeansMat = new THREE.MeshStandardMaterial({
    color: '#1b2230',
    roughness: 0.78,
    metalness: 0.04,
  });

  const skinMat = new THREE.MeshPhysicalMaterial({
    color: '#d9a17c',
    roughness: 0.52,
    metalness: 0.0,
    sheen: 0.25,
    sheenRoughness: 0.65,
    sheenColor: new THREE.Color('#ffd6ba'),
  });

  const silverHairMat = new THREE.MeshStandardMaterial({
    color: '#b8bec9',
    roughness: 0.56,
    metalness: 0.14,
  });

  const browMat = new THREE.MeshStandardMaterial({
    color: '#525866',
    roughness: 0.7,
  });

  const eyeMat = new THREE.MeshPhysicalMaterial({
    color: '#231712',
    roughness: 0.08,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
  });

  const shoeUpperMat = new THREE.MeshPhysicalMaterial({
    color: '#16181d',
    roughness: 0.38,
    clearcoat: 0.25,
  });

  const shoeSoleMat = new THREE.MeshStandardMaterial({
    color: '#eceff4',
    roughness: 0.65,
  });

  for (const mesh of man.meshes) {
    const label = `${mesh.name} ${mesh.material && !Array.isArray(mesh.material) ? mesh.material.name : ''}`;

    if (/eyelash/i.test(label)) {
      mesh.visible = false;
      continue;
    }

    if (/eyebrow/i.test(label)) {
      mesh.material = browMat;
      continue;
    }

    if (/short01/i.test(label)) {
      mesh.material = silverHairMat;
      continue;
    }

    if (/high-poly/i.test(label)) {
      mesh.material = eyeMat;
      continue;
    }

    if (/casualsuit/i.test(label)) {
      // Group 0: Leather Biker Jacket | Group 1: Dark Denim Jeans | Group 2: Silver Zipper | Group 3: Black Tee V-Zone
      mesh.geometry = partitionSkinnedGeometry(mesh.geometry, (x, y, z) => {
        if (y < 0.98) return 1;
        if (z > 0.095 && Math.abs(x - 0.012) < 0.011 && y > 1.02 && y < 1.46) return 2;
        if (z > 0.075 && Math.abs(x) < 0.046 && y > 1.38) return 3;
        return 0;
      });
      mesh.material = [leatherMat, darkJeansMat, zipperTrimMat, teeShirtMat];
      continue;
    }

    if (/generic/i.test(label)) {
      // Group 0: Human Skin (head, neck, wrists & hands) | Group 1: Long-Sleeve Leather Jacket Arms
      mesh.geometry = partitionSkinnedGeometry(
        mesh.geometry,
        (x, y) => {
          const ax = Math.abs(x);
          if (ax >= 0.22 && ax < 0.755 && y > 1.2 && y < 1.58) {
            return 1;
          }
          return 0;
        },
        { groupIndex: 1, offsetMeters: 0.004 }
      );
      mesh.material = [skinMat, leatherMat];
      continue;
    }

    if (/shoes/i.test(label)) {
      mesh.geometry = partitionSkinnedGeometry(mesh.geometry, (_x, y) => (y < 0.032 ? 1 : 0));
      mesh.material = [shoeUpperMat, shoeSoleMat];
      continue;
    }

    mesh.material = skinMat;
  }

  // Attach sleek titanium rimless glasses onto `Head` in bind pose (`high-poly` eyes sit at y=1.735, z=0.098)
  if (man.bones.Head) {
    man.object.updateMatrixWorld(true);
    const glasses = new THREE.Group();
    glasses.name = 'JensenGlasses';

    const frameMat = new THREE.MeshStandardMaterial({
      color: '#94a3b8',
      metalness: 0.95,
      roughness: 0.18,
    });
    const lensMat = new THREE.MeshPhysicalMaterial({
      color: '#0f172a',
      transparent: true,
      opacity: 0.28,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
    });

    // Left & right rectangular rimless lenses + top brow bar + nose bridge + temples
    for (const side of [-1, 1]) {
      const lx = side * 0.031;
      const lens = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.019, 0.003), lensMat);
      lens.position.set(lx, 0, 0);
      glasses.add(lens);

      const topBar = new THREE.Mesh(new THREE.BoxGeometry(0.036, 0.0028, 0.004), frameMat);
      topBar.position.set(lx, 0.01, 0);
      glasses.add(topBar);

      const temple = new THREE.Mesh(new THREE.BoxGeometry(0.0025, 0.0025, 0.088), frameMat);
      temple.position.set(side * 0.05, 0.006, -0.044);
      glasses.add(temple);
    }

    const bridge = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.0026, 0.004), frameMat);
    bridge.position.set(0, 0.006, 0.001);
    glasses.add(bridge);

    glasses.position.set(0, 1.736, 0.109);
    man.object.add(glasses);
    glasses.updateMatrixWorld(true);
    man.bones.Head.attach(glasses);
  }
}

export interface PedestrianPalette {
  topHex: string;
  bottomHex: string;
  skinHex: string;
  hairHex: string;
  shoeHex: string;
}

/**
 * Customizes a cloned rigged human pedestrian with realistic street-wear PBR materials.
 */
export function styleAsStreetPedestrian(object: THREE.Group, pal: PedestrianPalette): void {
  const topMat = new THREE.MeshStandardMaterial({ color: pal.topHex, roughness: 0.68 });
  const bottomMat = new THREE.MeshStandardMaterial({ color: pal.bottomHex, roughness: 0.78 });
  const skinMat = new THREE.MeshStandardMaterial({ color: pal.skinHex, roughness: 0.56 });
  const hairMat = new THREE.MeshStandardMaterial({ color: pal.hairHex, roughness: 0.65 });
  const shoeMat = new THREE.MeshStandardMaterial({ color: pal.shoeHex, roughness: 0.5 });
  const eyeMat = new THREE.MeshStandardMaterial({ color: '#1f1712', roughness: 0.15 });

  object.traverse((o) => {
    if (!(o as THREE.SkinnedMesh).isSkinnedMesh) return;
    const sm = o as THREE.SkinnedMesh;
    sm.castShadow = true;
    sm.receiveShadow = true;
    sm.frustumCulled = false;

    const label = sm.name;
    if (/eyelash|eyebrow/i.test(label)) {
      sm.visible = false;
    } else if (/casualsuit/i.test(label)) {
      sm.geometry = partitionSkinnedGeometry(sm.geometry, (_x, y) => (y < 0.98 ? 1 : 0));
      sm.material = [topMat, bottomMat];
    } else if (/short01/i.test(label)) {
      sm.material = hairMat;
    } else if (/shoes/i.test(label)) {
      sm.material = shoeMat;
    } else if (/high-poly/i.test(label)) {
      sm.material = eyeMat;
    } else {
      sm.material = skinMat;
    }
  });
}
