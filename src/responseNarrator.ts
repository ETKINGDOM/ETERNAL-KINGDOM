import { ritualNarration } from './content/ritualNarration';
import { ritualResponses } from './content/ritualResponses';
import { ritualPresentation, type RitualFeedbackEvent } from './ritualFeedbackState';

export type ResponseAudio = Pick<HTMLAudioElement,'src'|'volume'|'play'|'pause'|'remove'|'addEventListener'|'removeEventListener'>;
export type NarrationState = {owner:string|null;playing:boolean;error:string};
/** One page-owned clip. Cards may disappear without cancelling it. No faith text enters this port. */
export class ResponseNarrator {
  private audio:ResponseAudio|null=null;
  private revision=0;
  private retryClip:{owner:string;event:RitualFeedbackEvent}|null=null;
  private listeners=new Set<()=>void>();
  private state:NarrationState={owner:null,playing:false,error:''};
  constructor(private createAudio:()=>ResponseAudio){}
  getSnapshot=()=>this.state;
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>{this.listeners.delete(listener);};};
  private update(state:NarrationState){this.state=state;for(const listener of this.listeners)listener();}
  stop=(owner?:string)=>{
    if(owner!==undefined&&this.state.owner!==owner)return;
    this.revision++;
    this.retryClip=null;
    const old=this.audio;this.audio=null;old?.pause();old?.remove();
    this.update({owner:null,playing:false,error:''});
  };
  retry=async()=>{const clip=this.retryClip;if(clip)await this.play(clip.owner,clip.event);};
  async play(owner:string,event:RitualFeedbackEvent){
    const clip=ritualNarration[event.kind];
    if(!ritualPresentation(event)||clip?.textVersion!==ritualResponses.version)return;
    this.stop();const revision=++this.revision;
    const current=()=>revision===this.revision;
    const fail=(error:string)=>{
      if(!current())return;
      this.stop();this.retryClip={owner,event:{kind:event.kind,state:event.state,confirmationId:event.confirmationId}};this.update({owner,playing:false,error});
    };
    try{
      const audio=this.createAudio();this.audio=audio;audio.src=clip.src;audio.volume=.8;
      this.update({owner,playing:false,error:''});
      audio.addEventListener('playing',()=>{if(current())this.update({owner,playing:true,error:''});});
      audio.addEventListener('ended',()=>{if(current())this.stop();});
      audio.addEventListener('pause',()=>{if(current())this.update({...this.state,playing:false});});
      audio.addEventListener('error',()=>fail('The recording is unavailable. The written response remains here.'));
      await audio.play();
    }catch{fail('The response could not play. You can read it below or try again.');}
  }
}
