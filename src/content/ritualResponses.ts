// Fixed, owner-approved encouragement. Never interpolate private words, names,
// donation amounts or claims of divine acceptance into narration.
export const ritualResponses = {
  version: 'sanctuary-encouragement-1',
  voiceId: 'onwK4e9ZLuTAKqWW03F9',
  voice: 'Daniel · ElevenLabs',
  disclaimer: 'These words offer encouragement, not a declaration of divine acceptance or forgiveness.',
  messages: {
    prayer: 'May peace accompany you.',
    confession: 'May you find the courage to make amends, and the strength to begin again.',
    praise: 'May gratitude bring light to your days.',
    donation: 'Thank you for helping build this place of peace.',
  },
};
export type RitualKind=keyof typeof ritualResponses.messages;
