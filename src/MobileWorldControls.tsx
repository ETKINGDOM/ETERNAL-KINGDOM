import {useEffect,useRef,useState,type PointerEvent} from 'react';
import type {Posture} from '../shared/protocol';
import {POSTURE_KEYS,POSTURE_LABELS} from './PostureControls';
import {joystickAxis,type MovementInputPort} from './touchMovement';

const shortLabels:Record<Posture,string>={standing:'Stand',prayer:'Pray',confession:'Reflect',prostrate:'Bow'};
export default function MobileWorldControls({input,resetKey,posture,onPosture}:{input:MovementInputPort;resetKey:string;posture:Posture;onPosture:(pose:Posture)=>void}){
  const stick=useRef<HTMLButtonElement>(null),pointer=useRef<{id:number;x:number;y:number}|null>(null);
  const [knob,setKnob]=useState({x:0,y:0});
  function stop(){const held=pointer.current;pointer.current=null;input.clear();setKnob({x:0,y:0});if(held&&stick.current?.hasPointerCapture(held.id))stick.current.releasePointerCapture(held.id);}
  function update(e:PointerEvent<HTMLButtonElement>){const held=pointer.current;if(!held||held.id!==e.pointerId)return;const axis=joystickAxis(e.clientX-held.x,e.clientY-held.y);input.set(axis.x,axis.y);setKnob({x:axis.x*29,y:axis.y*29});}
  useEffect(()=>{stop();},[resetKey]);
  useEffect(()=>{
    const hidden=()=>{if(document.hidden)stop();};addEventListener('blur',stop);addEventListener('resize',stop);document.addEventListener('visibilitychange',hidden);
    return()=>{const held=pointer.current;pointer.current=null;input.clear();if(held&&stick.current?.hasPointerCapture(held.id))stick.current.releasePointerCapture(held.id);removeEventListener('blur',stop);removeEventListener('resize',stop);document.removeEventListener('visibilitychange',hidden);};
  },[input]);
  return <div className="mobile-world-controls" role="group" aria-label="Touch movement and gestures">
    <button ref={stick} type="button" className="movement-joystick" aria-label="Movement joystick" title="Drag to walk; release to stop. Arrow keys also work."
      onPointerDown={e=>{if(pointer.current||e.button!==0)return;e.preventDefault();e.stopPropagation();const rect=e.currentTarget.getBoundingClientRect();pointer.current={id:e.pointerId,x:rect.x+rect.width/2,y:rect.y+rect.height/2};e.currentTarget.setPointerCapture(e.pointerId);e.currentTarget.focus({preventScroll:true});update(e);}}
      onPointerMove={update} onPointerUp={e=>{if(pointer.current?.id===e.pointerId)stop();}} onPointerCancel={e=>{if(pointer.current?.id===e.pointerId)stop();}} onLostPointerCapture={e=>{if(pointer.current?.id===e.pointerId)stop();}}
      onKeyDown={e=>{const direction:Record<string,[number,number]>={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]};if(direction[e.key]){e.preventDefault();input.set(...direction[e.key]);}}}
      onKeyUp={e=>{if(e.key.startsWith('Arrow'))stop();}} onBlur={stop}>
      <span className="joystick-directions" aria-hidden="true">↑<span>←　→</span>↓</span><span className="joystick-knob" style={{transform:`translate(${knob.x}px,${knob.y}px)`}} aria-hidden="true"/>
    </button>
    <div className="mobile-gesture-buttons" role="group" aria-label="Touch gestures">{Object.entries(POSTURE_KEYS).map(([number,pose])=><button key={number} type="button" aria-label={`Gesture ${number}: ${POSTURE_LABELS[pose]}`} aria-pressed={posture===pose} title={POSTURE_LABELS[pose]} onClick={()=>{stop();onPosture(pose);}}><b>{number}</b><small>{shortLabels[pose]}</small></button>)}</div>
  </div>;
}
