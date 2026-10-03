import type {Posture} from '../shared/protocol';
export const STAND_RETRY_INTERVAL=750;
// Public pose requests only, never wallet/transaction retries. A lost standing
// acknowledgement must not latch walking off until the user changes pose.
export class StandBeforeWalking {
  private self='';private posture:Posture='standing';private next=0;
  reset(){this.self='';this.posture='standing';this.next=0;}
  shouldRequest(now:number,self:string,posture:Posture,intent:boolean,active:boolean){
    if(!Number.isFinite(now)||!self||!active||!intent||posture==='standing'){this.reset();return false;}
    if(this.self!==self||this.posture!==posture)this.reset();
    this.self=self;this.posture=posture;
    if(now<this.next)return false;
    this.next=now+STAND_RETRY_INTERVAL;return true;
  }
}
