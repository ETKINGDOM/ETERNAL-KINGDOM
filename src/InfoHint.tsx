import {useId,useState,type ReactNode} from 'react';
import './infoHint.css';

/** Hover/focus on desktop, tap on touch. Details stay local and readable without a hover device. */
export default function InfoHint({label,children}:{label:string;children:ReactNode}){
  const id=useId();
  const [pinned,setPinned]=useState(false),[hovered,setHovered]=useState(false),[focused,setFocused]=useState(false);
  const open=pinned||hovered||focused;
  const close=()=>{setPinned(false);setHovered(false);setFocused(false);};
  return <div className="info-hint" onPointerLeave={()=>setHovered(false)}
    onBlur={e=>{if(!e.currentTarget.contains(e.relatedTarget))close();}} onKeyDown={e=>{if(e.key==='Escape'&&open){e.preventDefault();e.stopPropagation();close();}}}>
    <button type="button" className="info-hint-button" aria-label={label} aria-expanded={open} aria-controls={id}
      onPointerEnter={e=>{if(e.pointerType==='mouse')setHovered(true);}} onFocus={()=>setFocused(true)} onClick={()=>{setPinned(!pinned);setFocused(false);setHovered(false);}}><span aria-hidden="true">!</span></button>
    <div id={id} className="info-hint-content" role="note" aria-label={label} hidden={!open}>{children}</div>
  </div>;
}
