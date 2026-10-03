export const CHAT_IME_END_GUARD_MS=50;

// Some engines end composition immediately before its confirming Enter, with
// isComposing already false. This short guard affects only recent IME use;
// ordinary English Enter and explicit mouse/touch sends remain unchanged.
export class ChatCompositionGuard{
  private active=false;
  private endedAt=-Infinity;
  start(){this.active=true;this.endedAt=-Infinity;}
  end(now:number){this.active=false;this.endedAt=now;}
  reset(){this.active=false;this.endedAt=-Infinity;}
  blocksSubmit(now:number){return this.active||now-this.endedAt<CHAT_IME_END_GUARD_MS;}
  blocksKey(event:{key:string;isComposing:boolean;keyCode:number},now:number){
    return event.key==='Enter'&&(event.isComposing||event.keyCode===229||this.blocksSubmit(now));
  }
}

// Visual viewport adjustment is local presentation only, not device detection.
export function chatKeyboardInset(layoutHeight:number,viewport:{height:number;offsetTop:number}|null,focused:boolean){
  return focused&&viewport?Math.max(0,layoutHeight-viewport.height-viewport.offsetTop):0;
}
