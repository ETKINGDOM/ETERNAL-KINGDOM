export type QualityPreference = 'auto' | 'performance';
export interface DeviceHints { width:number; height:number; coarsePointer:boolean; touchPoints:number; mobile:boolean; software?:boolean }

// Short-side detection also covers a phone first opened in landscape. Narrow
// desktop windows deliberately receive the inexpensive profile as well.
export function useCompactRendering(hints:DeviceHints, preference:QualityPreference='auto') {
  return preference==='performance'||Boolean(hints.software)||hints.mobile||hints.width<700||
    ((hints.coarsePointer||hints.touchPoints>0)&&Math.min(hints.width,hints.height)<=1024);
}
export function renderPixelRatio(width:number,height:number,dpr:number,compact:boolean,scale=1) {
  const cap=compact?1:1.5;
  const pixelBudget=compact?900_000:3_000_000;
  return Math.min(Math.max(.25,dpr),cap,Math.sqrt(pixelBudget/Math.max(1,width*height)))*scale;
}

// Observe delivered frames, not requestAnimationFrame ticks. Only lower the
// resolution after sustained misses; never mistake one pause for GPU pressure.
// No automatic up/down oscillation. A fresh scene starts at full profile scale.
export class AdaptiveResolution {
  scale=1;
  private started:number|null=null;
  private previous:number|null=null;
  private elapsed=0;
  private samples=0;
  reset() { this.started=null;this.previous=null;this.elapsed=0;this.samples=0; }
  observe(time:number) {
    if(this.started===null){this.started=time;this.previous=time;return false;}
    const delta=time-this.previous!;this.previous=time;
    if(delta<=0||delta>250){this.reset();return false;}
    if(time-this.started<3000)return false;
    this.elapsed+=delta;this.samples++;
    if(this.elapsed<2000)return false;
    const overloaded=this.samples>=20&&this.elapsed/this.samples>42;
    this.elapsed=0;this.samples=0;
    if(!overloaded||this.scale<=.65)return false;
    this.scale=Math.max(.65,Number((this.scale-.1).toFixed(2)));
    return true;
  }
}
