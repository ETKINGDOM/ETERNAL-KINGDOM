import {ritualPresentation,type RitualFeedbackEvent} from './ritualFeedbackState';
import {RitualLightStore} from './ritualLight';
import {ResponseNarrator} from './responseNarrator';

/** Holds only fixed feedback metadata until the world is actually visible.
 * No private text, payment request, persistence, network write or transaction retry. */
export class RitualDelivery {
  private waiting:{owner:string;event:RitualFeedbackEvent;sound:boolean;cueId:number}|null=null;
  private soundEnabled=true;
  constructor(readonly light:RitualLightStore,private narrator:ResponseNarrator){}
  setSoundEnabled=(enabled:boolean)=>{
    this.soundEnabled=enabled;
    if(!enabled){
      // Mute applies to queued speech as well as the current player. Opening
      // sound again never resurrects a silenced response; the light is kept.
      if(this.waiting)this.waiting.sound=false;
      this.narrator.stop();
    }
  };
  clear=(owner?:string)=>{
    if(owner===undefined||this.waiting?.owner===owner)this.waiting=null;
    this.narrator.stop(owner);this.light.clear(owner);
  };
  complete=(owner:string,event:RitualFeedbackEvent,sound:boolean,immediateSound=false)=>{
    if(!ritualPresentation(event)){this.clear(owner);return;}
    this.clear();
    this.light.show(owner,event,event.state==='confirmed');
    const cue=this.light.getSnapshot();if(!cue)return;
    const speak=sound&&this.soundEnabled;
    if(event.state==='confirmed'){
      this.waiting={owner,event:{kind:event.kind,state:event.state,confirmationId:event.confirmationId},sound:speak&&!immediateSound,cueId:cue.id};
      // Explicit history listening is already a user gesture. Play it now,
      // while still keeping the avatar cue for the visible world after close.
      if(speak&&immediateSound)void this.narrator.play(owner,event);
    }
    else if(speak)void this.narrator.play(owner,event);
  };
  reveal=()=>{
    const waiting=this.waiting;if(!waiting)return;
    this.waiting=null;
    if(!this.light.activate(waiting.cueId))return;
    if(waiting.sound&&this.soundEnabled)void this.narrator.play(waiting.owner,waiting.event);
  };
  hide=()=>{
    // A receipt can arrive behind a wallet window. Its unheard cue must wait,
    // not expire offscreen. An already-presented response never replays.
    if(this.light.getSnapshot()?.startedAt===null){this.narrator.stop();return;}
    this.clear();
  };
}
