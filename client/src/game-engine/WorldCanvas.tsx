import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { WorldEnvironment } from './WorldEnvironment';
import { CityBuilder } from './CityBuilder';
import { PlayerController } from './PlayerController';
import { NpcSystem } from './NpcSystem';
import { TrafficAndDrones } from './TrafficAndDrones';
import { MissionBeacon } from './MissionBeacon';

export function WorldCanvas() {
  return (
    <div className="absolute inset-0 h-full w-full">
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ fov: 52, near: 0.2, far: 440, position: [0, 3.2, 11.2] }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.04,
        }}
        onCreated={({ gl, scene }) => {
          gl.shadowMap.enabled = true;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;

          // Physically-based IBL environment (`threejs-materials-lighting`) so glass facades,
          // clearcoat sports cars, and Jensen's leather jacket reflect realistic sky & horizon light
          const pmrem = new THREE.PMREMGenerator(gl);
          pmrem.compileEquirectangularShader();
          const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
          scene.environment = envRT.texture;
          scene.environmentIntensity = 0.88;
          pmrem.dispose();

          Object.assign(window as unknown as Record<string, unknown>, {
            renderer: gl,
            scene,
          });
        }}
      >
        <WorldEnvironment />
        <CityBuilder />
        <PlayerController />
        <NpcSystem />
        <TrafficAndDrones />
        <MissionBeacon />
      </Canvas>
    </div>
  );
}
