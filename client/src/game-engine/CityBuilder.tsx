import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import {
  CITY_BILLBOARDS,
  CITY_BUILDINGS,
  SIDEWALK_BLOCKS,
  type BillboardSpec,
  type BuildingSpec,
} from './cityLayout';
import {
  createRealisticSkyscraperTextures,
  getAsphaltMaps,
  getSidewalkMaps,
} from './pbrTextures';
import { SKY_PALETTES, useGameStore } from '../state/gameStore';

function CommercialBillboard({ spec }: { spec: BillboardSpec }) {
  const billboardText = useGameStore((s) => s.worldChanges.billboard_text);
  const tickerText = useGameStore((s) => s.worldChanges.ticker_text);
  const skyColor = useGameStore((s) => s.worldChanges.sky_color);
  const eventType = useGameStore((s) => s.activeEventType);

  const { canvas, texture } = useMemo(() => {
    const c = document.createElement('canvas');
    c.width = 640;
    c.height = 280;
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { canvas: c, texture: t };
  }, []);

  useEffect(() => {
    return () => {
      texture.dispose();
    };
  }, [texture]);

  const accumRef = useRef(0);

  useFrame(({ clock }, delta) => {
    accumRef.current += delta;
    if (accumRef.current < 0.07) return;
    accumRef.current = 0;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const t = clock.getElapsedTime();
    const palette = SKY_PALETTES[skyColor];
    const isCrisis =
      eventType === 'robot_uprising' ||
      eventType === 'gpu_market_crash' ||
      skyColor === 'red' ||
      skyColor === 'amber_crash';

    // Realistic commercial outdoor LED screen backdrop (Weazel News / BAWSAQ / Silicon Media)
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    if (isCrisis) {
      grad.addColorStop(0, '#450a0a');
      grad.addColorStop(1, '#1c1917');
    } else {
      grad.addColorStop(0, '#0f172a');
      grad.addColorStop(0.55, '#1e293b');
      grad.addColorStop(1, '#0c4a6e');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Top Broadcast Header Bar
    ctx.fillStyle = isCrisis ? '#dc2626' : '#f59e0b';
    ctx.fillRect(0, 0, canvas.width, 44);
    ctx.fillStyle = isCrisis ? '#ffffff' : '#0f172a';
    ctx.font = '900 20px system-ui, -apple-system, sans-serif';
    ctx.fillText(
      isCrisis ? 'BREAKING NEWS // WEAZEL SILICON NETWORK' : 'LOS SILICON LIVE // BAWSAQ TECH FEED',
      20,
      29
    );

    // Live Stock Sparkline on top-right
    ctx.save();
    ctx.strokeStyle = isCrisis ? '#fca5a5' : '#84cc16';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i <= 14; i++) {
      const px = 415 + i * 14;
      const py = isCrisis
        ? 68 + i * 3.6 + Math.sin(t * 5 + i) * 5
        : 108 - i * 3.1 + Math.sin(t * 3.5 + i) * 4;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();
    ctx.restore();

    // Main Headline Text
    const primary =
      spec.variant === 'brand' && !eventType
        ? 'NVIDIA TENSOR TOWER // SOVEREIGN AI DISTRICT'
        : billboardText;

    ctx.fillStyle = '#f8fafc';
    ctx.font = '800 34px system-ui, -apple-system, sans-serif';
    const words = primary.split(/\s+/);
    let line1 = '';
    let line2 = '';
    for (const w of words) {
      if ((line1 + ' ' + w).trim().length <= 24) {
        line1 = (line1 + ' ' + w).trim();
      } else {
        line2 = (line2 + ' ' + w).trim();
      }
    }
    ctx.fillText(line1.slice(0, 26), 22, 118);
    if (line2) {
      ctx.fillStyle = isCrisis ? '#fecaca' : '#fde68a';
      ctx.fillText(line2.slice(0, 28), 22, 162);
    }

    // Bottom Financial / News Ticker Strip
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 222, canvas.width, 58);
    ctx.fillStyle = palette.neonAccentHex;
    ctx.fillRect(0, 220, canvas.width, 3);

    ctx.fillStyle = '#f1f5f9';
    ctx.font = '700 21px ui-monospace, monospace';
    const repeated = `${tickerText}   •   ${tickerText}   •   `;
    const unitW = ctx.measureText(tickerText + '   •   ').width || 320;
    const scrollPx = (t * 90) % unitW;
    ctx.save();
    ctx.beginPath();
    ctx.rect(12, 222, canvas.width - 24, 58);
    ctx.clip();
    ctx.fillText(repeated, 16 - scrollPx, 258);
    ctx.restore();

    texture.needsUpdate = true;
  });

  return (
    <group position={spec.position} rotation={[0, spec.rotationY, 0]}>
      {/* Galvanized Steel Billboard Housing & Catwalk */}
      <mesh position={[0, 0, -0.18]} castShadow>
        <boxGeometry args={[spec.width + 0.5, spec.height + 0.5, 0.3]} />
        <meshStandardMaterial color="#334155" metalness={0.75} roughness={0.38} />
      </mesh>
      <mesh position={[0, -spec.height * 0.5 - 0.32, 0.35]}>
        <boxGeometry args={[spec.width + 0.4, 0.1, 0.7]} />
        <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.45} />
      </mesh>
      {/* Commercial LED Display Face */}
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[spec.width, spec.height]} />
        <meshBasicMaterial map={texture} />
      </mesh>
    </group>
  );
}

function RealisticSkyscraper({ spec, index }: { spec: BuildingSpec; index: number }) {
  const textures = useMemo(
    () => createRealisticSkyscraperTextures(index + 1, spec.trimColor),
    [index, spec.trimColor]
  );

  useEffect(() => {
    return () => {
      textures.map.dispose();
      textures.emissiveMap.dispose();
      textures.roughnessMap.dispose();
    };
  }, [textures]);

  const podiumH = 3.8;
  const towerH = spec.height - podiumH;

  return (
    <group position={[spec.x, 0, spec.z]}>
      {/* Ground-Level Architectural Stone & Glass Lobby Podium */}
      <mesh position={[0, podiumH * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.width + 0.35, podiumH, spec.depth + 0.35]} />
        <meshStandardMaterial color="#948e83" roughness={0.72} metalness={0.08} />
      </mesh>

      {/* Warm Illuminated Glass Storefront / Corporate Entrance */}
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[spec.width + 0.4, 2.4, spec.depth * 0.62]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#fde68a"
          emissiveIntensity={0.38}
          roughness={0.12}
          metalness={0.75}
        />
      </mesh>
      <mesh position={[0, 1.55, 0]}>
        <boxGeometry args={[spec.width * 0.62, 2.4, spec.depth + 0.4]} />
        <meshStandardMaterial
          color="#1e293b"
          emissive="#fde68a"
          emissiveIntensity={0.38}
          roughness={0.12}
          metalness={0.75}
        />
      </mesh>

      {/* Main Curtain-Wall Glass & Mullion Tower */}
      <mesh position={[0, podiumH + towerH * 0.5, 0]} castShadow receiveShadow>
        <boxGeometry args={[spec.width, towerH, spec.depth]} />
        <meshStandardMaterial
          color={spec.bodyColor}
          map={textures.map}
          roughnessMap={textures.roughnessMap}
          emissiveMap={textures.emissiveMap}
          emissive="#fff7ed"
          emissiveIntensity={0.55}
          roughness={0.85}
          metalness={0.45}
          envMapIntensity={1.4}
        />
      </mesh>

      {/* Architectural Roof Parapet Cornice */}
      <mesh position={[0, spec.height + 0.25, 0]} castShadow>
        <boxGeometry args={[spec.width + 0.4, 0.5, spec.depth + 0.4]} />
        <meshStandardMaterial color="#64748b" roughness={0.55} metalness={0.35} />
      </mesh>

      {/* Realistic Rooftop Mechanical Penthouse & HVAC Units */}
      <mesh position={[0, spec.height + 1.35, 0]} castShadow>
        <boxGeometry args={[spec.width * 0.48, 1.8, spec.depth * 0.48]} />
        <meshStandardMaterial color="#475569" roughness={0.62} metalness={0.3} />
      </mesh>
      <mesh position={[spec.width * 0.28, spec.height + 0.85, spec.depth * 0.24]}>
        <boxGeometry args={[1.4, 0.9, 1.4]} />
        <meshStandardMaterial color="#94a3b8" roughness={0.45} metalness={0.6} />
      </mesh>

      {/* Telecom Mast & Red FAA Aviation Warning Beacon */}
      {spec.roofSpire && (
        <group position={[0, spec.height + 2.2, 0]}>
          <mesh position={[0, 2.8, 0]}>
            <cylinderGeometry args={[0.05, 0.18, 5.6, 8]} />
            <meshStandardMaterial color="#94a3b8" metalness={0.85} roughness={0.25} />
          </mesh>
          <mesh position={[0, 5.7, 0]}>
            <sphereGeometry args={[0.16, 10, 10]} />
            <meshBasicMaterial color="#ef4444" />
          </mesh>
        </group>
      )}
    </group>
  );
}

/**
 * California Washingtonia Boulevard Palm Tree (GTA V Los Santos signature flora).
 */
function CaliforniaPalmTree({
  position,
  scale = 1,
  leanAngle = 0.06,
  seed = 0,
}: {
  position: [number, number, number];
  scale?: number;
  leanAngle?: number;
  seed?: number;
}) {
  const crownRef = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (crownRef.current) {
      const t = clock.getElapsedTime();
      crownRef.current.rotation.z = Math.sin(t * 1.4 + seed) * 0.035;
      crownRef.current.rotation.x = Math.cos(t * 1.1 + seed) * 0.025;
    }
  });

  const frondAngles = useMemo(
    () => Array.from({ length: 9 }, (_, i) => (i / 9) * Math.PI * 2 + (seed % 1)),
    [seed]
  );

  return (
    <group position={position} scale={scale} rotation={[0, seed * 1.7, leanAngle]}>
      {/* Tree Pit Planter Grate on Sidewalk */}
      <mesh position={[0, 0.02, 0]} receiveShadow>
        <cylinderGeometry args={[0.62, 0.68, 0.06, 12]} />
        <meshStandardMaterial color="#3f3f46" roughness={0.85} />
      </mesh>
      {/* Tapered Fibrous Palm Trunk */}
      <mesh position={[0, 3.6, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.13, 0.24, 7.2, 8]} />
        <meshStandardMaterial color="#6b5344" roughness={0.92} />
      </mesh>
      {/* Dead Frond Skirt below Crown */}
      <mesh position={[0, 7.05, 0]}>
        <sphereGeometry args={[0.28, 8, 8]} />
        <meshStandardMaterial color="#785c3a" roughness={0.95} />
      </mesh>
      {/* Swaying Arched Green Palm Fronds */}
      <group ref={crownRef} position={[0, 7.25, 0]}>
        {frondAngles.map((ang, idx) => (
          <group key={idx} rotation={[0, ang, 0]}>
            <mesh
              position={[0, 0.12, 1.05]}
              rotation={[0.42 + (idx % 3) * 0.12, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.38, 0.04, 2.25]} />
              <meshStandardMaterial color="#3f6212" roughness={0.68} />
            </mesh>
            <mesh
              position={[0, -0.32, 2.05]}
              rotation={[0.92 + (idx % 2) * 0.14, 0, 0]}
              castShadow
            >
              <boxGeometry args={[0.26, 0.03, 1.15]} />
              <meshStandardMaterial color="#4d7c0f" roughness={0.68} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  );
}

export function CityBuilder() {
  const asphaltMaps = useMemo(() => getAsphaltMaps(), []);
  const sidewalkMaps = useMemo(() => getSidewalkMaps(), []);
  const sculptureRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (sculptureRef.current) {
      sculptureRef.current.rotation.y += delta * 0.35;
    }
  });

  // Boulevard Streetlight coordinates along curbs
  const streetLampCoords = useMemo(() => {
    const coords: { x: number; z: number; rotY: number }[] = [];
    for (const c of [-40, -24, -6, 6, 24, 40]) {
      coords.push({ x: -10.3, z: c, rotY: 0 });
      coords.push({ x: 10.3, z: c, rotY: Math.PI });
      coords.push({ x: c, z: -10.3, rotY: -Math.PI / 2 });
      coords.push({ x: c, z: 10.3, rotY: Math.PI / 2 });
    }
    return coords;
  }, []);

  // California Palm Tree boulevard placements
  const palmTrees = useMemo(() => {
    const pts: { pos: [number, number, number]; scale: number; seed: number }[] = [
      { pos: [-8.2, 0.16, -8.2], scale: 1.05, seed: 1 },
      { pos: [8.2, 0.16, -8.2], scale: 0.96, seed: 2 },
      { pos: [-8.2, 0.16, 8.2], scale: 1.08, seed: 3 },
      { pos: [8.2, 0.16, 8.2], scale: 0.98, seed: 4 },
      { pos: [-19.2, 0.16, -8.8], scale: 1.12, seed: 5 },
      { pos: [19.2, 0.16, -8.8], scale: 1.02, seed: 6 },
      { pos: [-19.2, 0.16, 8.8], scale: 1.06, seed: 7 },
      { pos: [19.2, 0.16, 8.8], scale: 1.14, seed: 8 },
      { pos: [-8.8, 0.16, -20.5], scale: 1.0, seed: 9 },
      { pos: [8.8, 0.16, -20.5], scale: 1.1, seed: 10 },
      { pos: [-8.8, 0.16, 20.5], scale: 1.04, seed: 11 },
      { pos: [8.8, 0.16, 20.5], scale: 0.95, seed: 12 },
      { pos: [-31.5, 0.16, -18.2], scale: 1.15, seed: 13 },
      { pos: [31.5, 0.16, -18.2], scale: 1.08, seed: 14 },
      { pos: [-31.5, 0.16, 18.2], scale: 1.1, seed: 15 },
      { pos: [31.5, 0.16, 18.2], scale: 1.0, seed: 16 },
      { pos: [-18.5, 0.16, -32.0], scale: 1.06, seed: 17 },
      { pos: [18.5, 0.16, -32.0], scale: 1.12, seed: 18 },
      { pos: [-18.5, 0.16, 32.0], scale: 1.02, seed: 19 },
      { pos: [18.5, 0.16, 32.0], scale: 1.09, seed: 20 },
    ];
    return pts;
  }, []);

  // Road segments between intersections ([-56, -18], [-10, 10], [18, 56])
  const roadSegments: readonly [number, number][] = [
    [-37, 36],
    [0, 19],
    [37, 36],
  ];

  // 4 Major Intersections at (±14, ±14)
  const intersections: readonly [number, number][] = [
    [-14, -14],
    [14, -14],
    [-14, 14],
    [14, 14],
  ];

  const crosswalkStripes = [-2.7, -1.8, -0.9, 0, 0.9, 1.8, 2.7];

  return (
    <group name="LosSiliconCity">
      {/* Realistic Aggregate Asphalt Boulevard Surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[280, 280]} />
        <meshStandardMaterial
          map={asphaltMaps.map}
          normalMap={asphaltMaps.normalMap}
          normalScale={new THREE.Vector2(0.55, 0.55)}
          roughnessMap={asphaltMaps.roughnessMap}
          roughness={0.88}
          metalness={0.04}
        />
      </mesh>

      {/* Realistic Double-Yellow Centerlines & White Lane Dividers (NS Avenues x=±14) */}
      {[-14, 14].map((rx) =>
        roadSegments.map(([cz, len], sIdx) => (
          <group key={`ns-mark-${rx}-${sIdx}`}>
            {/* Double Yellow Centerline */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[rx - 0.12, 0.012, cz]}>
              <planeGeometry args={[0.11, len]} />
              <meshStandardMaterial color="#eab308" roughness={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[rx + 0.12, 0.012, cz]}>
              <planeGeometry args={[0.11, len]} />
              <meshStandardMaterial color="#eab308" roughness={0.6} />
            </mesh>
          </group>
        ))
      )}

      {/* Realistic Double-Yellow Centerlines (EW Avenues z=±14) */}
      {[-14, 14].map((rz) =>
        roadSegments.map(([cx, len], sIdx) => (
          <group key={`ew-mark-${rz}-${sIdx}`}>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, rz - 0.12]}>
              <planeGeometry args={[len, 0.11]} />
              <meshStandardMaterial color="#eab308" roughness={0.6} />
            </mesh>
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, 0.012, rz + 0.12]}>
              <planeGeometry args={[len, 0.11]} />
              <meshStandardMaterial color="#eab308" roughness={0.6} />
            </mesh>
          </group>
        ))
      )}

      {/* Zebra Crosswalks & Cantilever Traffic Signal Gantries at All 4 Intersections */}
      {intersections.map(([ix, iz], idx) => (
        <group key={`inter-${idx}`} position={[ix, 0, iz]}>
          {/* North & South Crosswalks */}
          {[-4.3, 4.3].map((cz) =>
            crosswalkStripes.map((sx, k) => (
              <mesh
                key={`cw-ns-${cz}-${k}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[sx, 0.014, cz]}
              >
                <planeGeometry args={[0.45, 2.1]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.65} />
              </mesh>
            ))
          )}
          {/* West & East Crosswalks */}
          {[-4.3, 4.3].map((cx) =>
            crosswalkStripes.map((sz, k) => (
              <mesh
                key={`cw-ew-${cx}-${k}`}
                rotation={[-Math.PI / 2, 0, 0]}
                position={[cx, 0.014, sz]}
              >
                <planeGeometry args={[2.1, 0.45]} />
                <meshStandardMaterial color="#e2e8f0" roughness={0.65} />
              </mesh>
            ))
          )}

          {/* GTA V Cantilever Traffic Signal Pole on Corner */}
          <group position={[3.9, 0.16, 3.9]}>
            <mesh position={[0, 3.1, 0]} castShadow>
              <cylinderGeometry args={[0.09, 0.12, 6.2, 8]} />
              <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.35} />
            </mesh>
            <mesh position={[-2.2, 5.85, 0]}>
              <boxGeometry args={[4.5, 0.11, 0.11]} />
              <meshStandardMaterial color="#475569" metalness={0.75} roughness={0.35} />
            </mesh>
            {/* Traffic Signal Housing + Red/Amber/Green Lenses */}
            <group position={[-3.2, 5.45, 0]}>
              <mesh>
                <boxGeometry args={[0.32, 0.86, 0.26]} />
                <meshStandardMaterial color="#18181b" roughness={0.5} />
              </mesh>
              <mesh position={[0, 0.24, 0.14]}>
                <circleGeometry args={[0.085, 12]} />
                <meshBasicMaterial color="#ef4444" />
              </mesh>
              <mesh position={[0, 0, 0.14]}>
                <circleGeometry args={[0.085, 12]} />
                <meshBasicMaterial color="#451a03" />
              </mesh>
              <mesh position={[0, -0.24, 0.14]}>
                <circleGeometry args={[0.085, 12]} />
                <meshBasicMaterial color="#22c55e" />
              </mesh>
            </group>
          </group>
        </group>
      ))}

      {/* Raised Tiled Concrete Sidewalks with Bevelled Granite Curbs (y = 0..0.16) */}
      {SIDEWALK_BLOCKS.map((blk, i) => (
        <group key={`sw-${i}`} position={[blk.x, 0.08, blk.z]}>
          {/* Outer Granite Curb Rim */}
          <mesh receiveShadow castShadow>
            <boxGeometry args={[blk.width + 0.24, 0.16, blk.depth + 0.24]} />
            <meshStandardMaterial color="#94a3b8" roughness={0.76} metalness={0.05} />
          </mesh>
          {/* Inner Tiled Concrete Sidewalk Surface */}
          <mesh position={[0, 0.004, 0]} receiveShadow>
            <boxGeometry args={[blk.width - 0.12, 0.16, blk.depth - 0.12]} />
            <meshStandardMaterial
              map={sidewalkMaps.map}
              normalMap={sidewalkMaps.normalMap}
              normalScale={new THREE.Vector2(0.45, 0.45)}
              roughnessMap={sidewalkMaps.roughnessMap}
              roughness={0.84}
              metalness={0.04}
            />
          </mesh>
        </group>
      ))}

      {/* Central Founders Plaza Architectural Fountain & Brushed-Titanium Sculpture */}
      <group position={[0, 0.16, 0]}>
        {/* Granite Fountain Basin */}
        <mesh position={[0, 0.24, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[1.95, 2.1, 0.48, 32]} />
          <meshStandardMaterial color="#64748b" roughness={0.55} metalness={0.15} />
        </mesh>
        {/* Reflective Water Pool */}
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.49, 0]}>
          <circleGeometry args={[1.76, 32]} />
          <meshPhysicalMaterial
            color="#0ea5e9"
            roughness={0.05}
            metalness={0.1}
            clearcoat={1.0}
            envMapIntensity={1.6}
          />
        </mesh>
        {/* Modern Brushed-Titanium Civic Sculpture */}
        <group ref={sculptureRef} position={[0, 1.85, 0]}>
          <mesh castShadow>
            <torusKnotGeometry args={[0.68, 0.16, 64, 16]} />
            <meshPhysicalMaterial
              color="#e2e8f0"
              metalness={0.92}
              roughness={0.14}
              clearcoat={0.6}
              envMapIntensity={1.8}
            />
          </mesh>
        </group>
      </group>

      {/* Realistic Curtain-Wall & Stone Skyscrapers */}
      {CITY_BUILDINGS.map((b, idx) => (
        <RealisticSkyscraper key={b.id} spec={b} index={idx} />
      ))}

      {/* Commercial Steel-Mounted LED Billboards */}
      {CITY_BILLBOARDS.map((bb) => (
        <CommercialBillboard key={bb.id} spec={bb} />
      ))}

      {/* California Boulevard Palm Trees */}
      {palmTrees.map((p, idx) => (
        <CaliforniaPalmTree
          key={`palm-${idx}`}
          position={p.pos}
          scale={p.scale}
          seed={p.seed}
        />
      ))}

      {/* Realistic Cobrahead Boulevard Streetlamps */}
      {streetLampCoords.map((lamp, idx) => (
        <group
          key={`lamp-${idx}`}
          position={[lamp.x, 0.16, lamp.z]}
          rotation={[0, lamp.rotY, 0]}
        >
          <mesh position={[0, 2.8, 0]} castShadow>
            <cylinderGeometry args={[0.055, 0.085, 5.6, 8]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.32} />
          </mesh>
          <mesh position={[-0.65, 5.55, 0]} rotation={[0, 0, 0.15]}>
            <boxGeometry args={[1.4, 0.07, 0.07]} />
            <meshStandardMaterial color="#475569" metalness={0.8} roughness={0.32} />
          </mesh>
          <mesh position={[-1.25, 5.6, 0]}>
            <boxGeometry args={[0.42, 0.1, 0.22]} />
            <meshStandardMaterial color="#334155" metalness={0.7} roughness={0.35} />
          </mesh>
          <mesh position={[-1.25, 5.53, 0]}>
            <boxGeometry args={[0.34, 0.03, 0.16]} />
            <meshBasicMaterial color="#fef3c7" />
          </mesh>
        </group>
      ))}

      {/* Realistic Concrete Jersey Highway Barriers at District Perimeter */}
      {[
        { pos: [0, 0.45, -56] as [number, number, number], size: [112, 0.9, 0.55] as [number, number, number] },
        { pos: [0, 0.45, 56] as [number, number, number], size: [112, 0.9, 0.55] as [number, number, number] },
        { pos: [-56, 0.45, 0] as [number, number, number], size: [0.55, 0.9, 112] as [number, number, number] },
        { pos: [56, 0.45, 0] as [number, number, number], size: [0.55, 0.9, 112] as [number, number, number] },
      ].map((wall, i) => (
        <mesh key={`jersey-${i}`} position={wall.pos} receiveShadow castShadow>
          <boxGeometry args={wall.size} />
          <meshStandardMaterial color="#94a3b8" roughness={0.85} />
        </mesh>
      ))}
    </group>
  );
}
