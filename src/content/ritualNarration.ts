import type { NarrationClip } from './narration';
import type { RitualKind } from './ritualResponses';

// Static clips only. The client never sends faith text to a speech provider.
export const ritualNarration:Partial<Record<RitualKind,NarrationClip>>={
  prayer:{src:'/audio/response-prayer-833f2579270778f0.mp3',textVersion:'sanctuary-encouragement-1',voice:'Daniel · ElevenLabs',synthetic:true},
  confession:{src:'/audio/response-confession-aeef9e01ea2eadea.mp3',textVersion:'sanctuary-encouragement-1',voice:'Daniel · ElevenLabs',synthetic:true},
  praise:{src:'/audio/response-praise-08ad3861629470de.mp3',textVersion:'sanctuary-encouragement-1',voice:'Daniel · ElevenLabs',synthetic:true},
  donation:{src:'/audio/response-donation-3c8b1d08c870e824.mp3',textVersion:'sanctuary-encouragement-1',voice:'Daniel · ElevenLabs',synthetic:true},
};
