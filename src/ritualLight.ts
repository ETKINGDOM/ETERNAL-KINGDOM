import {ritualPresentation,type RitualFeedbackEvent} from './ritualFeedbackState';
import type {RitualKind} from './content/ritualResponses';

// Client-only encouragement, never a public event or proof of divine acceptance.
// Carries no words, wallet, receipt/hash, name, amount or encryption material.
export type RitualLightCue={id:number;kind:RitualKind;state:'local-preview'|'confirmed';startedAt:number|null};
export interface RitualLightPort {show(owner:string,event:RitualFeedbackEvent,defer?:boolean):void;clear(owner?:string):void}
export const RITUAL_LIGHT_DURATION=6000;
export const RITUAL_CONFIRMED_DURATION=18_000;
export class RitualLightStore implements RitualLightPort {
  private cue:RitualLightCue|null=null;
  private owner:string|null=null;
  private sequence=0;
  private listeners=new Set<()=>void>();
  constructor(private clock:()=>number){}
  getSnapshot=()=>this.cue;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private notify(){for(const listener of this.listeners)listener();}
  show(owner:string,event:RitualFeedbackEvent,defer=false){
    if(!ritualPresentation(event)||(event.state!=='local-preview'&&event.state!=='confirmed'))return;
    const startedAt=this.clock();if(!Number.isFinite(startedAt))return;
    this.owner=owner;
    this.cue={id:++this.sequence,kind:event.kind,state:event.state,startedAt:defer&&event.state==='confirmed'?null:startedAt};this.notify();
  }
  activate(id:number){
    if(this.cue?.id!==id||this.cue.state!=='confirmed'||this.cue.startedAt!==null)return false;
    const startedAt=this.clock();if(!Number.isFinite(startedAt))return false;
    this.cue={...this.cue,startedAt};this.notify();return true;
  }
  clear(owner?:string){
    if(owner!==undefined&&this.owner!==owner)return;
    this.owner=null;this.cue=null;this.notify();
  }
}
/** A short preview, or one visible completion cue aligned with the world response. */
export function ritualLightStrength(cue:RitualLightCue|null|undefined,now:number,reducedMotion:boolean){
  if(!cue||cue.startedAt===null||!Number.isFinite(now)||!Number.isFinite(cue.startedAt))return 0;
  const age=now-cue.startedAt;
  if(cue.state==='confirmed'){
    if(age<0||age>=RITUAL_CONFIRMED_DURATION)return 0;
    // Accessibility keeps a visible, static halo rather than hiding completion.
    if(reducedMotion)return .75;
    // Visible as soon as the confirmed card appears; no flashing/pulse loop.
    const rise=.65+.35*Math.min(1,age/400);
    const fade=Math.min(1,(RITUAL_CONFIRMED_DURATION-age)/3000);
    return rise*fade;
  }
  if(reducedMotion||age<=0||age>=RITUAL_LIGHT_DURATION)return 0;
  const phase=age/RITUAL_LIGHT_DURATION;
  return Math.sin(Math.PI*phase)**2;
}
