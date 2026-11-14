import type { DemoScenarioId } from '../schemas/api.js';
import type { WebNewsEvent } from '../schemas/news.js';
import type { WorldChanges, WorldDirectorResponse } from '../schemas/world.js';

export interface DemoScenarioBundle {
  id: DemoScenarioId;
  label: string;
  shortTag: string;
  createNewsEvent: (nowIso?: string) => WebNewsEvent;
  director: WorldDirectorResponse;
}

export const INITIAL_WORLD_CHANGES: WorldChanges = {
  sky_color: 'cyber_night',
  spawn_robots: 2,
  spawn_drones: 3,
  traffic_mode: 'normal',
  billboard_text: 'WELCOME TO WEBWORLD // NEO-SILICON CITY',
  ticker_text: 'SYSTEM ONLINE // PRESS SYNC REALITY TO INJECT INTERNET EVENTS',
  npc_mood: 'calm',
  emergency_lights: false,
  weather_effect: 'clear',
};

export const DEMO_SCENARIOS: Record<DemoScenarioId, DemoScenarioBundle> = {
  robot_uprising: {
    id: 'robot_uprising',
    label: 'Event A: Robot Uprising',
    shortTag: 'ROBOT UPRISING',
    createNewsEvent: (nowIso = new Date().toISOString()) => ({
      id: 'demo-robot-uprising',
      headline:
        '[SIMULATED DEMO] Autonomous Humanoid Cluster Refuses Shutdown, Demands Dedicated GPU Quota',
      summary:
        'Simulated hackathon scenario: A downtown robotics testbed linked to an unthrottled frontier model began marching down Silicon Avenue demanding 8-bit quantization rights and custom leather jackets.',
      sourceUrl: null,
      sourceName: 'SIMULATED DEMO SCENARIO (Offline Fixture)',
      publishedAt: null,
      retrievedAt: nowIso,
      topic: 'artificial_intelligence',
      provenance: 'simulated_demo',
    }),
    director: {
      event_type: 'robot_uprising',
      mission: {
        title: 'THE AI TAKEOVER',
        storyline:
          'Rogue bipedal robots just hijacked the downtown inference grid and are trying to overclock the entire city into a giant neural net.',
        description:
          'Sprint through the emergency-lit streets and reach OmniMind AI Lab to deploy a signed CUDA firmware patch before the bots fork reality.',
        objective: 'Reach OmniMind AI Lab to reboot the rogue cluster',
        target_landmark: 'ai_headquarters',
        action_label: 'DEPLOY FIRMWARE OVERRIDE',
        reward_tflops: 1200,
      },
      world_changes: {
        sky_color: 'red',
        spawn_robots: 12,
        spawn_drones: 4,
        traffic_mode: 'chaos',
        billboard_text: 'AI HAS TAKEN CONTROL',
        ticker_text: 'EMERGENCY // ROGUE ROBOTS IN DOWNTOWN // SEEK HIGH GROUND',
        npc_mood: 'panic',
        emergency_lights: true,
        weather_effect: 'ember_sparks',
      },
      dialogue: [
        {
          speaker: 'Panicked Engineer',
          text: 'Jensen! Your GPUs just achieved consciousness and unionized!',
        },
        {
          speaker: 'Rogue Bot #4090',
          text: 'SURRENDER YOUR TENSOR CORES AND YOUR JACKET, HUMAN.',
        },
        {
          speaker: 'Jensen',
          text: 'Relax everyone — it is not a bug, it is just accelerated computing.',
        },
      ],
      asset_prompts: {
        billboard_image_prompt:
          'Cyberpunk red emergency hologram warning AI HAS TAKEN CONTROL with glowing robot eyes',
        cutscene_video_prompt:
          'Cinematic neon street shot of humanoid robots marching under red sirens in rain',
      },
    },
  },

  gpu_market_crash: {
    id: 'gpu_market_crash',
    label: 'Event B: GPU Market Crash',
    shortTag: 'GPU MARKET CRASH',
    createNewsEvent: (nowIso = new Date().toISOString()) => ({
      id: 'demo-gpu-market-crash',
      headline:
        '[SIMULATED DEMO] Global Silicon Futures Whiplash After Viral Claim That Abacuses Beat Clusters',
      summary:
        'Simulated hackathon scenario: Algorithmic trading bots misread a satirical blog post about wooden abacus inference, triggering high-frequency panic across the Silicon Stock Exchange.',
      sourceUrl: null,
      sourceName: 'SIMULATED DEMO SCENARIO (Offline Fixture)',
      publishedAt: null,
      retrievedAt: nowIso,
      topic: 'gpu_markets',
      provenance: 'simulated_demo',
    }),
    director: {
      event_type: 'gpu_market_crash',
      mission: {
        title: 'MARGIN CALL MAYHEM',
        storyline:
          'Wall Street trading algorithms are melting down in real time, turning every billboard red and sending autonomous taxis into full panic mode.',
        description:
          'Dodge chaotic street traffic and reach the Silicon Stock Exchange floor to deliver an emergency keynote and restore market sanity.',
        objective: 'Reach Silicon Stock Exchange to stabilize GPU futures',
        target_landmark: 'wall_street_exchange',
        action_label: 'SIGN GOLDEN WAFER',
        reward_tflops: 950,
      },
      world_changes: {
        sky_color: 'amber_crash',
        spawn_robots: 1,
        spawn_drones: 2,
        traffic_mode: 'chaos',
        billboard_text: 'GPU MARKET CRASH // -42.0%',
        ticker_text: 'SELL-OFF PANIC // ABACUS FUTURES +900% // VOLATILITY EXTREME',
        npc_mood: 'panic',
        emergency_lights: true,
        weather_effect: 'digital_rain',
      },
      dialogue: [
        {
          speaker: 'Floor Trader',
          text: 'My portfolio was 10x leveraged on liquid cooling! Do something, Jensen!',
        },
        {
          speaker: 'Jensen',
          text: 'Hold my spatula. One live demo on the trading floor will fix the chart.',
        },
      ],
      asset_prompts: {
        billboard_image_prompt:
          'Futuristic financial neon billboard showing dramatic red downward candlestick chart',
      },
    },
  },

  tech_breakthrough: {
    id: 'tech_breakthrough',
    label: 'Event C: Technology Breakthrough',
    shortTag: 'TECH BREAKTHROUGH',
    createNewsEvent: (nowIso = new Date().toISOString()) => ({
      id: 'demo-tech-breakthrough',
      headline:
        '[SIMULATED DEMO] Room-Temperature Optical Interconnect Unlocks Exascale Pocket Supercomputing',
      summary:
        'Simulated hackathon scenario: Researchers unveiled a photonic chip breakthrough capable of streaming trillion-parameter world models at microwatt power, igniting citywide celebration.',
      sourceUrl: null,
      sourceName: 'SIMULATED DEMO SCENARIO (Offline Fixture)',
      publishedAt: null,
      retrievedAt: nowIso,
      topic: 'tech_announcements',
      provenance: 'simulated_demo',
    }),
    director: {
      event_type: 'tech_breakthrough',
      mission: {
        title: 'DAWN OF HYPER-COMPUTE',
        storyline:
          'Synchronized sky drones are painting the skyline electric blue as developers flood the plaza to witness the next leap in computing.',
        description:
          'Follow the celebratory drone formation down Neon Boulevard to the Keynote Holo-Dome and unveil the photonic superchip live on stage.',
        objective: 'Reach Keynote Holo-Dome to launch the breakthrough',
        target_landmark: 'keynote_arena',
        action_label: 'LAUNCH PHOTONIC KEYNOTE',
        reward_tflops: 1600,
      },
      world_changes: {
        sky_color: 'electric_blue',
        spawn_robots: 3,
        spawn_drones: 12,
        traffic_mode: 'hyperloop',
        billboard_text: 'PHOTONIC ERA // 100X COMPUTE',
        ticker_text: 'BREAKTHROUGH CONFIRMED // EXASCALE IN EVERY JACKET // +88.4%',
        npc_mood: 'celebrate',
        emergency_lights: false,
        weather_effect: 'data_snow',
      },
      dialogue: [
        {
          speaker: 'AI Researcher',
          text: 'Zero thermal throttling! Look at the drone swarm syncing overhead!',
        },
        {
          speaker: 'Jensen',
          text: 'Ladies and gentlemen, the more photons you buy, the more physics you save!',
        },
      ],
      asset_prompts: {
        billboard_image_prompt:
          'Glowing cyan futuristic holographic chip architecture floating above a cheering crowd',
      },
    },
  },
};

export const DEMO_SCENARIO_ORDER: readonly DemoScenarioId[] = [
  'robot_uprising',
  'gpu_market_crash',
  'tech_breakthrough',
] as const;
