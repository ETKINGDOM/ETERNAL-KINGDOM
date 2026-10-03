import { useEffect, useRef, useState } from 'react';
import { HandHeart, X } from 'lucide-react';
import type { Posture } from '../shared/protocol';

export const POSTURE_LABELS:Record<Posture,string>={standing:'Stand up',prayer:'Kneel in prayer',confession:'Kneel in confession',prostrate:'Bow in reverence'};
export const POSTURE_KEYS:Record<string,Posture>={'1':'standing','2':'prayer','3':'confession','4':'prostrate'};
export default function PostureControls({posture,disabled,shortcutsEnabled,onChange,visible=true}:{posture:Posture;disabled:boolean;shortcutsEnabled:boolean;onChange:(pose:Posture)=>void;visible?:boolean}){
  const [open,setOpen]=useState(false);
  useEffect(()=>{if(!visible)setOpen(false);},[visible]);
  const current=useRef({disabled,shortcutsEnabled,onChange});current.current={disabled,shortcutsEnabled,onChange};
  useEffect(()=>{
    const keydown=(event:KeyboardEvent)=>{
      const state=current.current,target=event.target;
      if(state.disabled||!state.shortcutsEnabled||document.hidden||event.defaultPrevented||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
      if(document.querySelector('dialog[open]')||(target instanceof HTMLElement&&(target.isContentEditable||target.closest('input,textarea,select,[role="textbox"]'))))return;
      const pose=POSTURE_KEYS[event.key];if(!pose)return;
      event.preventDefault();state.onChange(pose);setOpen(false);
    };
    addEventListener('keydown',keydown);return()=>removeEventListener('keydown',keydown);
  },[]);
  return <div className="posture-controls">
    <button className="dock-action" aria-label="Sacred gestures" aria-expanded={open} aria-controls="sacred-gestures" disabled={disabled} onClick={()=>setOpen(v=>!v)}><HandHeart size={18}/><span>Gestures</span></button>
    {open&&<section id="sacred-gestures" className="posture-menu" aria-label="Sacred gestures" onKeyDown={e=>{if(e.key==='Escape'){e.preventDefault();e.stopPropagation();setOpen(false);}}}>
      <header><strong>A moment of stillness</strong><button aria-label="Close gestures" onClick={()=>setOpen(false)}><X size={16}/></button></header>
      <p>These gestures are visible to the room. Your words are never shared by an action.</p>
      {Object.entries(POSTURE_KEYS).map(([key,p])=><button key={p} disabled={disabled} aria-label={POSTURE_LABELS[p]} aria-keyshortcuts={key} aria-pressed={posture===p} onClick={()=>{onChange(p);setOpen(false);}}><kbd aria-hidden="true">{key}</kbd>{POSTURE_LABELS[p]}{p==='confession'&&<small>For quiet confession</small>}</button>)}
      <small>Keys 1–4 work outside text fields and dialogs. Remain kneeling until you stand or walk.</small>
    </section>}
  </div>;
}
