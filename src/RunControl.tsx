import { useEffect, useRef } from 'react';
import { Footprints } from 'lucide-react';
export default function RunControl({running,enabled,toggle}:{running:boolean;enabled:boolean;toggle:()=>void}){
  const current=useRef({enabled,toggle});current.current={enabled,toggle};
  useEffect(()=>{
    const key=(e:KeyboardEvent)=>{
      if(!current.current.enabled||e.code!=='KeyR'||e.repeat||e.isComposing||e.ctrlKey||e.metaKey||e.altKey||e.shiftKey||e.defaultPrevented||document.hidden||document.querySelector('dialog[open]'))return;
      if(e.target instanceof HTMLElement&&(e.target.isContentEditable||e.target.closest('input,textarea,select,[role="textbox"]')))return;
      e.preventDefault();current.current.toggle();
    };
    addEventListener('keydown',key);return()=>removeEventListener('keydown',key);
  },[]);
  return <button className="dock-action run-control" disabled={!enabled} aria-label="Toggle running" aria-pressed={running} aria-keyshortcuts="R" onClick={toggle}><Footprints size={18}/><span>{running?'Run':'Walk'} · R</span></button>;
}
