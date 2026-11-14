import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { SKY_PALETTES, useGameStore } from '../state/gameStore';
import { playerTelemetry } from '../state/playerTelemetry';

const PARTICLE_COUNT = 220;

const SKY_VERT = /* glsl */ `
varying vec3 vWorldDir;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldDir = normalize(position);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = /* glsl */ `
uniform vec3 uZenith;
uniform vec3 uHorizon;
uniform vec3 uSunColor;
uniform vec3 uSunDir;
uniform float uTime;
varying vec3 vWorldDir;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float valueNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}

void main() {
  vec3 dir = normalize(vWorldDir);
  float h = clamp(dir.y, 0.0, 1.0);

  // Smooth Rayleigh/Mie California atmospheric gradient
  vec3 sky = mix(uHorizon, uZenith, pow(h, 0.52));

  // Warm solar glow & crisp solar disc on the western/southern Los Silicon horizon
  vec3 sunD = normalize(uSunDir);
  float sunAmt = max(dot(dir, sunD), 0.0);
  sky += uSunColor * pow(sunAmt, 7.0) * 0.42;
  sky += uSunColor * smoothstep(0.9985, 0.9996, sunAmt) * 2.4;

  // High-altitude sunlit cirrus clouds
  if (dir.y > 0.03) {
    vec2 uv = dir.xz / (dir.y + 0.18) * 2.1 + vec2(uTime * 0.008, uTime * 0.004);
    float n = valueNoise(uv) * 0.6 + valueNoise(uv * 2.3) * 0.3 + valueNoise(uv * 5.1) * 0.1;
    float cloud = smoothstep(0.56, 0.84, n) * smoothstep(0.03, 0.25, dir.y);
    vec3 cloudCol = mix(uHorizon * 1.12, uSunColor * 1.05, pow(sunAmt, 2.0));
    sky = mix(sky, cloudCol, cloud * 0.48);
  }

  // Below horizon bounce
  if (dir.y < 0.0) {
    sky = mix(uHorizon * 0.75, uZenith * 0.35, clamp(-dir.y * 4.0, 0.0, 1.0));
  }

  gl_FragColor = vec4(sky, 1.0);
}
`;

export function WorldEnvironment() {
  const { scene } = useThree();
  const skyColor = useGameStore((s) => s.worldChanges.sky_color);
  const emergencyLights = useGameStore((s) => s.worldChanges.emergency_lights);
  const weatherEffect = useGameStore((s) => s.worldChanges.weather_effect);

  const hemiRef = useRef<THREE.HemisphereLight>(null);
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const emergencyGroupRef = useRef<THREE.Group>(null);
  const shockwaveRef = useRef<THREE.Mesh>(null);
  const pointsRef = useRef<THREE.Points>(null);

  const currentZenith = useMemo(() => new THREE.Color(SKY_PALETTES.cyber_night.skyHex), []);
  const currentHorizon = useMemo(() => new THREE.Color(SKY_PALETTES.cyber_night.horizonHex), []);
  const currentSun = useMemo(() => new THREE.Color(SKY_PALETTES.cyber_night.sunHex), []);
  const currentFog = useMemo(() => new THREE.Color(SKY_PALETTES.cyber_night.fogHex), []);
  const tmpColor = useMemo(() => new THREE.Color(), []);

  const skyMaterial = useMemo(
    () =>
      new THREE.ShaderMaterial({
        side: THREE.BackSide,
        depthWrite: false,
        uniforms: {
          uZenith: { value: currentZenith.clone() },
          uHorizon: { value: currentHorizon.clone() },
          uSunColor: { value: currentSun.clone() },
          uSunDir: { value: new THREE.Vector3(-0.58, 0.28, -0.76).normalize() },
          uTime: { value: 0 },
        },
        vertexShader: SKY_VERT,
        fragmentShader: SKY_FRAG,
      }),
    [currentHorizon, currentSun, currentZenith]
  );

  // Distant Vinewood / Santa Monica coastal hills ring around the city
  const mountainGeometry = useMemo(() => {
    const segs = 96;
    const radius = 185;
    const geom = new THREE.CylinderGeometry(radius, radius, 46, segs, 1, true);
    const pos = geom.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      const x = pos.getX(i);
      const z = pos.getZ(i);
      const ang = Math.atan2(z, x);
      if (y > 0) {
        const ridge =
          10 +
          Math.sin(ang * 5.0) * 7.5 +
          Math.cos(ang * 11.0 + 1.2) * 4.2 +
          Math.sin(ang * 19.0) * 2.1;
        pos.setY(i, Math.max(2, ridge));
      } else {
        pos.setY(i, -4);
      }
    }
    geom.computeVertexNormals();
    return geom;
  }, []);

  useMemo(() => {
    scene.fog = new THREE.FogExp2(
      SKY_PALETTES.cyber_night.fogHex,
      SKY_PALETTES.cyber_night.fogDensity
    );
  }, [scene]);

  const particlePositions = useMemo(() => {
    const arr = new Float32Array(PARTICLE_COUNT * 3);
    for (let i = 0; i < PARTICLE_COUNT; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 95;
      arr[i * 3 + 1] = Math.random() * 32 + 1;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 95;
    }
    return arr;
  }, []);

  useFrame(({ clock }, delta) => {
    const dt = Math.min(delta, 0.05);
    const alpha = 1 - Math.exp(-2.6 * dt);
    const palette = SKY_PALETTES[skyColor];

    tmpColor.set(palette.skyHex);
    currentZenith.lerp(tmpColor, alpha);
    tmpColor.set(palette.horizonHex);
    currentHorizon.lerp(tmpColor, alpha);
    tmpColor.set(palette.sunHex);
    currentSun.lerp(tmpColor, alpha);

    skyMaterial.uniforms.uZenith.value.copy(currentZenith);
    skyMaterial.uniforms.uHorizon.value.copy(currentHorizon);
    skyMaterial.uniforms.uSunColor.value.copy(currentSun);
    skyMaterial.uniforms.uTime.value = clock.getElapsedTime();

    if (scene.fog instanceof THREE.FogExp2) {
      tmpColor.set(palette.fogHex);
      currentFog.lerp(tmpColor, alpha);
      scene.fog.color.copy(currentFog);
      scene.fog.density = THREE.MathUtils.lerp(
        scene.fog.density,
        palette.fogDensity,
        alpha
      );
    }

    if (hemiRef.current) {
      tmpColor.set(palette.hemiSkyHex);
      hemiRef.current.color.lerp(tmpColor, alpha);
      tmpColor.set(palette.hemiGroundHex);
      hemiRef.current.groundColor.lerp(tmpColor, alpha);
    }

    // Tight player-following directional sun shadow frustum (`threejs-materials-lighting` Pattern 3)
    if (dirLightRef.current) {
      tmpColor.set(palette.keyLightHex);
      dirLightRef.current.color.lerp(tmpColor, alpha);

      const px = playerTelemetry.x;
      const pz = playerTelemetry.z;
      dirLightRef.current.position.set(px - 34, 38, pz - 42);
      dirLightRef.current.target.position.set(px, 0, pz);
      dirLightRef.current.target.updateMatrixWorld();
    }

    if (emergencyGroupRef.current) {
      emergencyGroupRef.current.visible = emergencyLights;
      if (emergencyLights) {
        emergencyGroupRef.current.rotation.y += dt * 3.4;
      }
    }

    if (shockwaveRef.current) {
      const nowSec = performance.now() / 1000;
      const elapsed = nowSec - playerTelemetry.lastShockwaveAt;
      if (elapsed >= 0 && elapsed < 1.6) {
        shockwaveRef.current.visible = true;
        const progress = elapsed / 1.6;
        const scale = 1 + progress * 65;
        shockwaveRef.current.scale.set(scale, scale, 1);
        const mat = shockwaveRef.current.material as THREE.MeshBasicMaterial;
        mat.opacity = (1 - progress) * 0.65;
        mat.color.set(palette.neonAccentHex);
      } else {
        shockwaveRef.current.visible = false;
      }
    }

    if (pointsRef.current) {
      pointsRef.current.visible = weatherEffect !== 'clear';
      if (weatherEffect !== 'clear') {
        const attr = pointsRef.current.geometry.getAttribute(
          'position'
        ) as THREE.BufferAttribute;
        const vy =
          weatherEffect === 'ember_sparks'
            ? 5.0
            : weatherEffect === 'digital_rain'
              ? -19.0
              : -4.2;
        const t = clock.getElapsedTime();
        for (let i = 0; i < PARTICLE_COUNT; i++) {
          let y = attr.getY(i) + vy * dt;
          const x = attr.getX(i) + Math.sin(t + i) * 0.018;
          if (vy > 0 && y > 34) y = 0.5;
          if (vy < 0 && y < 0.3) y = 34;
          attr.setXY(i, x, y);
        }
        attr.needsUpdate = true;
      }
    }
  });

  const particleColor =
    weatherEffect === 'ember_sparks'
      ? '#fb923c'
      : weatherEffect === 'digital_rain'
        ? '#bae6fd'
        : '#f8fafc';

  return (
    <>
      {/* Atmospheric GTA V California Sky Dome */}
      <mesh material={skyMaterial} frustumCulled={false}>
        <sphereGeometry args={[340, 32, 20]} />
      </mesh>

      {/* Distant Vinewood / Coastal Hills Silhouette */}
      <mesh geometry={mountainGeometry} position={[0, 0, 0]}>
        <meshStandardMaterial
          color="#334155"
          roughness={0.95}
          metalness={0.0}
          side={THREE.BackSide}
        />
      </mesh>

      {/* Physically-based sky/ground bounce + crisp golden-hour sun shadows */}
      <hemisphereLight ref={hemiRef} args={['#93c5fd', '#574c46', 1.15]} />

      <directionalLight
        ref={dirLightRef}
        position={[-34, 38, -42]}
        intensity={3.2}
        color="#ffd7a8"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={4}
        shadow-camera-far={135}
        shadow-camera-left={-38}
        shadow-camera-right={38}
        shadow-camera-top={38}
        shadow-camera-bottom={-38}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
      />

      {/* Emergency Police / Crisis Helicopter Searchlights */}
      <group ref={emergencyGroupRef} position={[0, 22, 0]} visible={false}>
        <pointLight position={[18, 0, 0]} color="#ef4444" intensity={55} distance={55} />
        <pointLight position={[-18, 0, 0]} color="#3b82f6" intensity={55} distance={55} />
        <mesh position={[9, -8, 0]} rotation={[0, 0, Math.PI / 3]}>
          <coneGeometry args={[4.2, 20, 16, 1, true]} />
          <meshBasicMaterial
            color="#f8fafc"
            transparent
            opacity={0.09}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
        <mesh position={[-9, -8, 0]} rotation={[0, 0, -Math.PI / 3]}>
          <coneGeometry args={[4.2, 20, 16, 1, true]} />
          <meshBasicMaterial
            color="#fecaca"
            transparent
            opacity={0.09}
            side={THREE.DoubleSide}
            depthWrite={false}
          />
        </mesh>
      </group>

      {/* Subtle Reality-Sync Atmospheric Pulse */}
      <mesh
        ref={shockwaveRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.22, 0]}
        visible={false}
      >
        <ringGeometry args={[0.9, 1.08, 48]} />
        <meshBasicMaterial
          color="#f59e0b"
          transparent
          opacity={0.65}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Weather Rain / Ash / Sparks */}
      <points ref={pointsRef} visible={false}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[particlePositions, 3]} />
        </bufferGeometry>
        <pointsMaterial
          color={particleColor}
          size={0.22}
          transparent
          opacity={0.68}
          depthWrite={false}
        />
      </points>
    </>
  );
}
