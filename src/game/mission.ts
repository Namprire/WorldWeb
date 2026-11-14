import { INTERACTION_RADIUS, LOCATIONS } from '../shared/locations';
import type { MissionStep } from '../shared/schema';

export interface MissionState {
  status: 'idle' | 'active' | 'complete';
  stepIndex: number;
  steps: MissionStep[];
  collected: number;
}

export const emptyMission = (): MissionState => ({ status: 'idle', stepIndex: 0, steps: [], collected: 0 });

export const startMission = (steps: MissionStep[]): MissionState => ({
  status: 'active', stepIndex: 0, steps, collected: 0,
});

export function canInteract(mission: MissionState, x: number, z: number) {
  if (mission.status !== 'active') return false;
  const location = LOCATIONS[mission.steps[mission.stepIndex].location];
  return Math.hypot(location.x - x, location.z - z) <= INTERACTION_RADIUS;
}

export function advanceMission(mission: MissionState, x: number, z: number): MissionState {
  if (!canInteract(mission, x, z)) return mission;

  const { action } = mission.steps[mission.stepIndex];
  const stepIndex = mission.stepIndex + 1;
  let collected = mission.collected;
  if (action === 'collect') collected += 1;
  if (action === 'deliver') collected = 0;

  return {
    ...mission,
    stepIndex,
    collected,
    status: stepIndex === mission.steps.length ? 'complete' : 'active',
  };
}
