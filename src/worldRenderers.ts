import type { ComponentType } from 'react';
import type { Player } from '../shared/protocol';
import type { Point, Scene } from '../shared/world';
import type { SpeechBubble } from './speechBubbleState';
import type { QualityPreference } from './renderQuality';
import type { SanctuaryAction } from '../shared/places';
import type {RitualLightCue} from './ritualLight';
import type {MovementInputPort} from './touchMovement';

// A renderer owns presentation/input only. Identity, connection, public chat,
// private composer and service adapters remain in App/useWorld, across clients.
export interface WorldRendererProps {
  scene:Scene;players:Player[];bubbles:SpeechBubble[];showPlayerNames:boolean;
  onTogglePlayerNames:()=>void;self:string;active:boolean;stopWalkingSignal:number;
  onStand:()=>void;move:(p:Point)=>void;onGuide:()=>void;onTravel:(destination?:Scene)=>void;
  onPerson:(p:Player)=>void;quality?:QualityPreference;running:boolean;onRitual:(kind:SanctuaryAction)=>void;
  onInspectStreet:(id:string)=>void;
  ritualLightCue?:RitualLightCue|null;
  movementInput?:MovementInputPort;
  onPresentationReady?:(ready:boolean)=>void;
}
type Loader=()=>Promise<{default:ComponentType<WorldRendererProps>}>;
type RendererRegistration={label:string;status:'available';load:Loader}|{label:string;status:'planned';load:null};
export const worldRenderers={
  '3d':{label:'3D Sanctuary',status:'available',load:()=>import('./World3D')},
  '2d':{label:'Previous 2D preview',status:'available',load:()=>import('./WorldCanvas')},
  // Register a separate implementation here when the simple mobile client is
  // built. Do not alias this to the archived preview or report it as ready.
  lite:{label:'Simple mobile',status:'planned',load:null},
} satisfies Record<string,RendererRegistration>;
export function resolveWorldRenderer(requested:string|null) {
  return requested==='2d'?'2d':'3d';
}
