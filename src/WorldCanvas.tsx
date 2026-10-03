import { useEffect, useRef, useState } from 'react';
import type { Player } from '../shared/protocol';
import { canTravel, WORLD, type Point, type Scene } from '../shared/world';
import { worldCamera } from './worldCamera';
import { PilgrimSprites } from './PilgrimSprites';
import SpeechBubbles, { placeBubble, type BubbleElements } from './SpeechBubbles';
import type { WorldRendererProps } from './worldRenderers';
import NameVisibilityButton from './NameVisibilityButton';
import {StandBeforeWalking} from './standBeforeWalking';

const ART={plaza:'/world/courtyard.webp',temple:'/world/sanctuary-v3.webp'};
const BUILDER:Player={x:810,y:589,color:'#eee2c6',name:'The Builder',id:'builder',emote:'none',emoteUntil:0};
export default function WorldCanvas(props:WorldRendererProps){
  const canvas=useRef<HTMLCanvasElement>(null);const current=useRef(props);current.current=props;
  const [artState,setArtState]=useState<'loading'|'ready'|'error'>('loading');
  const [spriteState,setSpriteState]=useState<'loading'|'ready'|'error'>('loading');
  const bubbleElements=useRef<BubbleElements>(new Map());
  const presentable=Boolean(props.self&&props.players.some(p=>p.id===props.self)&&artState==='ready'&&spriteState==='ready');
  useEffect(()=>{props.onPresentationReady?.(presentable);return()=>props.onPresentationReady?.(false);},[presentable,props.onPresentationReady]);
  useEffect(()=>{
    const el=canvas.current!;const c=el.getContext('2d')!;
    const layer=document.createElement('canvas');layer.width=1536;layer.height=1101;const bg=layer.getContext('2d')!;
    const gradient=bg.createLinearGradient(0,0,0,1101);gradient.addColorStop(0,'#788e9e');gradient.addColorStop(1,'#e8e3d6');bg.fillStyle=gradient;bg.fillRect(0,0,1536,1101);
    let disposed=false;setArtState('loading');setSpriteState('loading');
    const sprites=new PilgrimSprites(ready=>{if(!disposed)setSpriteState(ready?'ready':'error');});
    const art=new Image();art.onload=()=>{if(!disposed){bg.drawImage(art,0,0,1536,1101);setArtState('ready');}};art.onerror=()=>{if(!disposed)setArtState('error');};art.src=ART[props.scene==='temple'?'temple':'plaza'];
    const reduced=matchMedia('(prefers-reduced-motion: reduce)');
    const keys=new Set<string>();let target:Point|null=null;let position:Point|null=null;let selfId='';let lastSent=0;let lastTime=0;let frame=0;let lastServer:Point|null=null;let cameraFocus=600;
    let camera=worldCamera(el.clientWidth,el.clientHeight,cameraFocus);
    const rendered=new Map<string,Point>();const directions=new Map<string,number>();let marker:Point|null=null;let markerTime=0;
    let lastPosture='standing';const standing=new StandBeforeWalking();
    let stopWalkingSignal=current.current.stopWalkingSignal;
    let motionStopped=false;
    const keydown=(e:KeyboardEvent)=>{
      if(!current.current.active||(e.target instanceof HTMLElement&&(e.target.matches('input,textarea,select,button')||e.target.isContentEditable)))return;
      if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(e.key.toLowerCase())){e.preventDefault();keys.add(e.key.toLowerCase());target=null;}
    };
    const keyup=(e:KeyboardEvent)=>keys.delete(e.key.toLowerCase());const blur=()=>{keys.clear();target=null;standing.reset();};
    const click=(e:PointerEvent)=>{
      if(!current.current.active)return;
      const r=el.getBoundingClientRect();const p={x:(e.clientX-r.left)/camera.scale+camera.x,y:(e.clientY-r.top)/camera.scale+camera.y};
      if(props.scene==='plaza'&&Math.abs(p.x-BUILDER.x)<30&&p.y>BUILDER.y-100&&p.y<BUILDER.y+35){current.current.onGuide();return;}
      if((props.scene==='plaza'&&p.x>430&&p.x<770&&p.y>140&&p.y<365)||(props.scene==='temple'&&p.y>800)){current.current.onTravel();return;}
      const person=current.current.players.find(a=>a.id!==current.current.self&&Math.abs(p.x-a.x)<25&&p.y>a.y-100&&p.y<a.y+25);
      if(person){current.current.onPerson(person);return;}
      target=p;marker=p;markerTime=performance.now();el.focus();
    };
    function draw(t:number){
      const dt=Math.min((t-lastTime)/1000,.04);lastTime=t;const state=current.current;const me=state.players.find(p=>p.id===state.self);
      if(stopWalkingSignal!==state.stopWalkingSignal){stopWalkingSignal=state.stopWalkingSignal;keys.clear();target=null;motionStopped=true;}
      const previous=position?{...position}:null;
      if(me&&selfId!==me.id){position={x:me.x,y:me.y};lastServer=position;selfId=me.id;}
      if(!me){position=null;selfId='';standing.reset();}
      if(me&&position){
        const posture=me.posture??'standing';
        if(posture!==lastPosture){if(posture!=='standing'){target=null;keys.clear();motionStopped=true;position={x:me.x,y:me.y};}lastPosture=posture;standing.reset();}
        if(lastServer&&(lastServer.x!==me.x||lastServer.y!==me.y)){if(Math.hypot(me.x-position.x,me.y-position.y)>65)position={x:me.x,y:me.y};lastServer={x:me.x,y:me.y};}
        if(state.active){
          let dx=Number(keys.has('d')||keys.has('arrowright'))-Number(keys.has('a')||keys.has('arrowleft'));
          let dy=Number(keys.has('s')||keys.has('arrowdown'))-Number(keys.has('w')||keys.has('arrowup'));
          if(target&&!dx&&!dy){dx=target.x-position.x;dy=target.y-position.y;if(Math.hypot(dx,dy)<5){target=null;dx=dy=0;}}
          const distance=Math.hypot(dx,dy);
          if(standing.shouldRequest(t,state.self,posture,Boolean(distance),state.active))state.onStand();
          if(distance&&posture==='standing'){const speed=state.running?260:180;const step=Math.min(speed*dt,distance>2?distance:speed*dt);const next={x:position.x+dx/distance*step,y:position.y+dy/distance*step};
            motionStopped=false;
            if(canTravel(props.scene,position,next))position=next;
            else if(canTravel(props.scene,position,{x:next.x,y:position.y}))position.x=next.x;
            else if(canTravel(props.scene,position,{x:position.x,y:next.y}))position.y=next.y;
            else target=null;
          }
          if(!motionStopped&&posture==='standing'&&t-lastSent>110&&Math.hypot(me.x-position.x,me.y-position.y)>.5){state.move(position);lastSent=t;}
        }else{keys.clear();target=null;standing.reset();}
      }
      const r=el.getBoundingClientRect();const dpr=Math.min(devicePixelRatio||1,2);const width=Math.round(r.width*dpr);const height=Math.round(r.height*dpr);
      if(el.width!==width||el.height!==height){el.width=width;el.height=height;}
      const wanted=position?.x??600;cameraFocus=reduced.matches?wanted:cameraFocus+(wanted-cameraFocus)*Math.min(1,dt*3);
      camera=worldCamera(r.width,r.height,cameraFocus);
      c.setTransform(dpr*camera.scale,0,0,dpr*camera.scale,-camera.x*dpr*camera.scale,-camera.y*dpr*camera.scale);
      c.drawImage(layer,0,0,WORLD.width,WORLD.height);
      if(!reduced.matches){for(let i=0;i<11;i++){const x=(i*173+50)%1200;const y=330+((i*89-t*.004)%450+450)%450;c.beginPath();c.arc(x,y,.8,0,Math.PI*2);c.fillStyle=`rgba(255,248,225,${.18+Math.sin(t*.0006+i)*.13})`;c.fill();}}
      if(marker&&t-markerTime<650&&!reduced.matches){c.save();c.globalAlpha=1-(t-markerTime)/650;c.beginPath();c.ellipse(marker.x,marker.y,8+(t-markerTime)/35,3+(t-markerTime)/90,0,0,Math.PI*2);c.strokeStyle='#e0c787';c.lineWidth=.8;c.stroke();c.restore();}
      const ids=new Set(state.players.map(p=>p.id));for(const id of rendered.keys())if(!ids.has(id)&&id!=='builder'){rendered.delete(id);directions.delete(id);}
      const figures=props.scene==='plaza'?[...state.players,BUILDER]:state.players;
      for(const p of [...figures].sort((a,b)=>a.y-b.y)){
        const prev=rendered.get(p.id)??{x:p.x,y:p.y};const loc=p.id===state.self&&position?{...position}:{x:prev.x+(p.x-prev.x)*Math.min(1,dt*12),y:prev.y+(p.y-prev.y)*Math.min(1,dt*12)};
        const before=p.id===state.self?(previous??prev):prev;const dx=loc.x-before.x;const dy=loc.y-before.y;const moving=Math.hypot(dx,dy)>.12;
        if(moving)directions.set(p.id,Math.abs(dx)>Math.abs(dy)?(dx<0?2:3):(dy<0?1:0));
        rendered.set(p.id,loc);sprites.draw(c,{...p,...loc},p.id===state.self,Date.now(),.76+loc.y/860*.28,!reduced.matches&&moving,t/1000,directions.get(p.id)??(p.id==='builder'?0:1),state.showPlayerNames);
        const x=(loc.x-camera.x)*camera.scale,y=(loc.y-130*(.76+loc.y/860*.28)-camera.y)*camera.scale;
        placeBubble(bubbleElements.current,p.id,x,y,x>0&&x<r.width&&y>0&&y<r.height,r.width);
      }
      frame=requestAnimationFrame(draw);
      el.dataset.playerNameplates=String(state.showPlayerNames?state.players.length:0);el.dataset.npcNameplates=String(props.scene==='plaza'?1:0);
      el.dataset.selfPosture=me?.posture??'standing';
      el.dataset.kneelingPlayers=String(state.players.filter(p=>p.posture&&p.posture!=='standing').length);
    }
    frame=requestAnimationFrame(draw);addEventListener('keydown',keydown);addEventListener('keyup',keyup);addEventListener('blur',blur);el.addEventListener('pointerdown',click);
    return()=>{disposed=true;sprites.dispose();art.onload=null;art.onerror=null;cancelAnimationFrame(frame);removeEventListener('keydown',keydown);removeEventListener('keyup',keyup);removeEventListener('blur',blur);el.removeEventListener('pointerdown',click);};
  },[props.scene]);
  return <div className="world-stage" data-art-state={artState} data-sprite-state={spriteState}><canvas ref={canvas} tabIndex={0} aria-label={`${props.scene==='plaza'?'Heavenly gardens':'Temple interior'}. Use arrow keys or WASD to walk. You can also click or tap a clear path.`} className="world-canvas"/><SpeechBubbles bubbles={props.bubbles} elements={bubbleElements.current}/><div className="view-controls"><NameVisibilityButton show={props.showPlayerNames} toggle={props.onTogglePlayerNames}/></div>{artState!=='ready'&&<div className="art-loading" role="status">{artState==='loading'?'Opening the gates…':'The scenery could not load. Please refresh to try again.'}</div>}{spriteState==='error'&&<div className="sprite-error" role="status">Character artwork could not load. Refresh to try again.</div>}</div>;
}
