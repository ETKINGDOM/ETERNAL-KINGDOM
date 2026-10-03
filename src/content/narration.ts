// Only approved, version-matched recordings belong here. No automatic system
// voice fallback: voice casting is part of the founder's authored presentation.
export type NarrationClip = { src: string; textVersion: string; voice: string; synthetic: boolean };
export const narration = {
  direction: 'Warm, resonant adult male voice. Grounded chest resonance, intimate and reassuring. Calm natural pacing, thoughtful pauses, clear international English. Not elderly, gravelly, theatrical, whispered, or artificially pitch-shifted. Speak as a human founder sharing his personal testimony, not as God.',
  clips: {
    0: {
      src: '/audio/founder-testimony-2-571a407f61572efe.mp3',
      textVersion: 'founder-testimony-2',
      voice: 'Daniel · ElevenLabs',
      synthetic: true,
    },
    1: {
      src: '/audio/founder-activities-23c8c90b792e314e.mp3',
      textVersion: 'founder-testimony-2',
      voice: 'Daniel · ElevenLabs',
      synthetic: true,
    },
    2: {
      src: '/audio/founder-eternity-41df0e8fe8de3fc0.mp3',
      textVersion: 'founder-testimony-2',
      voice: 'Daniel · ElevenLabs',
      synthetic: true,
    },
  } as Partial<Record<number, NarrationClip>>,
};
