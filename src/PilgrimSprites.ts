import type { Player } from '../shared/protocol';
type Ctx=CanvasRenderingContext2D;
type Frame={x:number;y:number;w:number;h:number};
// Tight alpha bounds measured from the original 1254 × 1254 transparent atlas.
const FRAMES:Frame[]=[{x:203,y:8,w:238,h:602},{x:801,y:11,w:239,h:593},{x:262,y:625,w:213,h:596},{x:780,y:625,w:213,h:598}];
export class PilgrimSprites {
  private image=new Image();
  private variants=new Map<string,HTMLCanvasElement>();
  ready=false;
  constructor(onReady:(ready:boolean)=>void){this.image.onload=()=>{this.ready=true;onReady(true);};this.image.onerror=()=>onReady(false);this.image.src='/world/pilgrim-v3.webp';}
  dispose(){this.image.onload=null;this.image.onerror=null;this.variants.clear();}
  private frame(index:number,color:string){
    const key=`${index}:${color}`;const cached=this.variants.get(key);if(cached)return cached;
    const f=FRAMES[index];const canvas=document.createElement('canvas');canvas.width=180;canvas.height=460;
    const c=canvas.getContext('2d')!;c.drawImage(this.image,f.x,f.y,f.w,f.h,0,0,180,460);
    // Runtime wardrobe tint respects sprite alpha; the face/hair remain untouched.
    c.save();c.globalCompositeOperation='source-atop';c.globalAlpha=.28;c.fillStyle=color;c.fillRect(0,92,180,368);c.restore();
    this.variants.set(key,canvas);return canvas;
  }
  draw(c:Ctx,p:Player,self:boolean,now:number,scale:number,moving:boolean,phase:number,direction:number,showPlayerName=true){
    c.save();c.translate(p.x,p.y);c.scale(scale,scale);
    c.beginPath();c.ellipse(2,2,16,4.5,0,0,Math.PI*2);c.fillStyle='#23354238';c.fill();
    if(self){c.beginPath();c.ellipse(0,1,20,6,0,0,Math.PI*2);c.strokeStyle='#f5e9bbac';c.lineWidth=.85;c.stroke();}
    const h=p.id==='builder'?98:91;const w=h*180/460;
    if(this.ready){
      const bob=moving?Math.sin(phase*10)*.55:0;
      const kneeling=p.posture&&p.posture!=='standing'&&!moving;
      if(!kneeling)c.drawImage(this.frame(direction,p.color),-w/2,-h+bob,w,h);
      else{
        // A folded lower robe and cropped upper-body sprite preserve head size
        // in the lightweight fallback instead of squashing the entire figure.
        c.fillStyle=p.color;c.strokeStyle='#b49b71';c.lineWidth=.7;
        c.beginPath();c.ellipse(0,-8,w*.65,12,0,Math.PI,Math.PI*2);c.lineTo(w*.7,1);c.lineTo(-w*.7,1);c.closePath();c.fill();c.stroke();
        c.save();c.translate(0,-15);
        const bow=p.posture==='prostrate';
        c.rotate((direction===3?1:-1)*(bow?1.25:p.posture==='confession'?.22:0));
        c.drawImage(this.frame(direction,p.color),0,0,180,260,-w/2,-h*.57,w,h*.57);c.restore();
      }
    }
    const isBuilder=p.id==='builder';
    if(isBuilder||showPlayerName){
    // Draw nameplates in CSS-pixel units, independent of the world camera scale.
    c.save();const transform=c.getTransform();const deviceScale=Math.min(devicePixelRatio||1,2);
    const screenScale=Math.hypot(transform.a,transform.b)/deviceScale;
    c.translate(0,10);c.scale(1/screenScale,1/screenScale);
    c.font='600 15px Arial, sans-serif';c.textAlign='center';c.textBaseline='middle';
    const characters=Array.from(p.name);let name=characters.join('');
    while(c.measureText(name).width>190&&characters.length){characters.pop();name=characters.join('')+'…';}
    const width=c.measureText(name).width+22,height=isBuilder?45:29;
    c.fillStyle='rgba(15,30,43,.94)';c.strokeStyle=self||isBuilder?'#e6c779':'rgba(235,222,189,.65)';c.lineWidth=1;
    c.beginPath();c.roundRect(-width/2,0,width,height,7);c.fill();c.stroke();
    c.fillStyle=self||isBuilder?'#ffe3a0':'#fffaf0';c.fillText(name,0,15);
    if(isBuilder){c.font='600 9px Arial, sans-serif';c.fillStyle='#f1ddb5';c.fillText('CLICK TO LISTEN',0,34);}
    c.restore();
    }
    if(p.emote!=='none'&&p.emoteUntil>now){c.beginPath();c.arc(0,-h-17,14,0,Math.PI*2);c.fillStyle='#fff9e3e8';c.fill();c.fillStyle='#9d8451';c.font='20px Georgia';c.fillText(({peace:'☮',heart:'♡',pray:'✧'})[p.emote],0,-h-10);}
    c.restore();
  }
}
