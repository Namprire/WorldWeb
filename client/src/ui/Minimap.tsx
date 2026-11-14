import { useEffect, useRef } from 'react';
import { CITY_LANDMARKS, WORLD_LIMITS } from '@webworld/shared';
import { CITY_BUILDINGS } from '../game-engine/cityLayout';
import { playerTelemetry } from '../state/playerTelemetry';
import { useGameStore } from '../state/gameStore';

const RADAR_W = 224;
const RADAR_H = 140;

export function Minimap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const staminaBarRef = useRef<HTMLDivElement>(null);
  const vehicleBadgeRef = useRef<HTMLDivElement>(null);
  const activeMission = useGameStore((s) => s.activeMission);

  useEffect(() => {
    let rafId = 0;
    const scale = 2.05; // Zoomed street-level GTA V GPS scale

    const renderRadar = () => {
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.clearRect(0, 0, RADAR_W, RADAR_H);

          // GTA V Dark Asphalt/Terrain GPS Base
          ctx.fillStyle = '#1b2028';
          ctx.fillRect(0, 0, RADAR_W, RADAR_H);

          ctx.save();
          // Center GPS on player and rotate with camera yaw like GTA V!
          ctx.translate(RADAR_W / 2, RADAR_H * 0.62);
          ctx.rotate(playerTelemetry.cameraYaw - Math.PI);

          const relX = (wx: number) => (wx - playerTelemetry.x) * scale;
          const relZ = (wz: number) => (wz - playerTelemetry.z) * scale;

          // City District Perimeter
          const ext = WORLD_LIMITS.CITY_HALF_EXTENT * scale;
          ctx.fillStyle = '#272e38';
          ctx.fillRect(
            relX(-WORLD_LIMITS.CITY_HALF_EXTENT),
            relZ(-WORLD_LIMITS.CITY_HALF_EXTENT),
            ext * 2,
            ext * 2
          );

          // GTA V Light-Grey Road Ribbons (NS x=±14, EW z=±14)
          ctx.fillStyle = '#64748b';
          for (const rx of [-14, 14]) {
            ctx.fillRect(
              relX(rx - 3.8),
              relZ(-WORLD_LIMITS.CITY_HALF_EXTENT),
              7.6 * scale,
              ext * 2
            );
          }
          for (const rz of [-14, 14]) {
            ctx.fillRect(
              relX(-WORLD_LIMITS.CITY_HALF_EXTENT),
              relZ(rz - 3.8),
              ext * 2,
              7.6 * scale
            );
          }

          // 3D Building Footprints
          for (const b of CITY_BUILDINGS) {
            const bx = relX(b.x - b.width / 2);
            const bz = relZ(b.z - b.depth / 2);
            ctx.fillStyle = b.landmarkId ? '#3f4a5a' : '#323946';
            ctx.strokeStyle = '#111827';
            ctx.lineWidth = 1;
            ctx.fillRect(bx, bz, b.width * scale, b.depth * scale);
            ctx.strokeRect(bx, bz, b.width * scale, b.depth * scale);
          }

          // GTA V Yellow/Purple GPS Waypoint Line to Active Mission
          const mission = useGameStore.getState().activeMission;
          if (mission && mission.status === 'active') {
            const lm = CITY_LANDMARKS[mission.spec.target_landmark];
            const mx = relX(lm.beaconPosition[0]);
            const mz = relZ(lm.beaconPosition[2]);

            ctx.strokeStyle = '#facc15';
            ctx.lineWidth = 3.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(mx, mz);
            ctx.stroke();

            // Yellow GTA Mission Ring + Dot
            ctx.fillStyle = '#facc15';
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(mx, mz, 5.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
          }

          // Supercars, Drones & Rogue Android Blips
          for (const blip of playerTelemetry.entityBlips) {
            const px = relX(blip.x);
            const pz = relZ(blip.z);
            if (blip.kind === 'car') {
              ctx.fillStyle = '#a3e635';
              ctx.fillRect(px - 2.2, pz - 2.2, 4.4, 4.4);
            } else {
              ctx.fillStyle = blip.kind === 'robot' ? '#ef4444' : '#38bdf8';
              ctx.beginPath();
              ctx.arc(px, pz, blip.kind === 'robot' ? 3.2 : 2.2, 0, Math.PI * 2);
              ctx.fill();
            }
          }

          // Player White Arrow with Black Outline (GTA V signature)
          ctx.save();
          ctx.rotate(-playerTelemetry.yaw + Math.PI);
          ctx.fillStyle = '#ffffff';
          ctx.strokeStyle = '#09090b';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(0, -6.5);
          ctx.lineTo(5, 5.5);
          ctx.lineTo(0, 3.2);
          ctx.lineTo(-5, 5.5);
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
          ctx.restore();

          ctx.restore();

          // Subtle North 'N' Badge on Radar Rim
          const northAngle = playerTelemetry.cameraYaw - Math.PI - Math.PI / 2;
          const nx = RADAR_W / 2 + Math.cos(northAngle) * (RADAR_W * 0.42);
          const ny = RADAR_H / 2 + Math.sin(northAngle) * (RADAR_H * 0.4);
          ctx.fillStyle = '#09090b';
          ctx.beginPath();
          ctx.arc(nx, ny, 7.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#f8fafc';
          ctx.font = '900 9px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('N', nx, ny + 0.5);
        }
      }

      if (staminaBarRef.current) {
        staminaBarRef.current.style.width = `${Math.round(playerTelemetry.stamina * 100)}%`;
      }
      if (vehicleBadgeRef.current) {
        if (playerTelemetry.vehicleName) {
          vehicleBadgeRef.current.style.display = 'block';
          vehicleBadgeRef.current.textContent = `${playerTelemetry.vehicleName} · ${Math.round(playerTelemetry.speed * 3.6)} KM/H (F to Exit)`;
        } else {
          vehicleBadgeRef.current.style.display = 'none';
        }
      }

      rafId = requestAnimationFrame(renderRadar);
    };

    rafId = requestAnimationFrame(renderRadar);
    return () => cancelAnimationFrame(rafId);
  }, [activeMission]);

  return (
    <div className="pointer-events-auto flex flex-col gap-1.5">
      {/* Active GTA Vehicle Speedometer Strip */}
      <div
        ref={vehicleBadgeRef}
        style={{ display: 'none' }}
        className="gta-box w-fit rounded px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-lime-400 uppercase"
      />

      <div className="flex items-end gap-2.5">
        {/* Authentic GTA V Rectangular Radar + Bottom Health / Armor / Stamina Strip */}
        <div className="overflow-hidden rounded-sm border-2 border-zinc-900/95 bg-zinc-950 shadow-2xl">
          <canvas
            ref={canvasRef}
            width={RADAR_W}
            height={RADAR_H}
            className="block"
          />
          {/* GTA V 3-Segment Health (Green) / Leather Jacket Armor (Blue) / Stamina (Yellow) */}
          <div className="flex h-2.5 w-full gap-0.5 bg-zinc-950 p-0.5">
            <div className="h-full w-1/2 bg-emerald-950">
              <div className="h-full w-full bg-emerald-500" />
            </div>
            <div className="h-full w-1/4 bg-sky-950">
              <div className="h-full w-full bg-sky-400" />
            </div>
            <div className="h-full w-1/4 bg-amber-950">
              <div
                ref={staminaBarRef}
                className="h-full bg-amber-400 transition-[width] duration-75"
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>

        {/* Clean GTA V Keybind Strip */}
        <div className="gta-box hidden rounded px-3 py-2 text-[10px] leading-relaxed text-zinc-300 lg:block">
          <div>
            <span className="font-mono font-bold text-white">WASD</span> Move ·{' '}
            <span className="font-mono font-bold text-white">Shift</span> Sprint ·{' '}
            <span className="font-mono font-bold text-white">Alt</span> Walk
          </div>
          <div>
            <span className="font-mono font-bold text-white">Space</span> Jump/Brake ·{' '}
            <span className="font-mono font-bold text-white">C / RMB</span> Strafe
          </div>
          <div>
            <span className="font-mono font-bold text-amber-300">F</span> Drive Supercar ·{' '}
            <span className="font-mono font-bold text-amber-300">V</span> 1st-Person ·{' '}
            <span className="font-mono font-bold text-white">L</span> Lock Mouse
          </div>
        </div>
      </div>
    </div>
  );
}
