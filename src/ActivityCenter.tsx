import {useEffect,useRef,useState} from 'react';
import {CircleAlert,X} from 'lucide-react';
import {collectActivity,currentActivityNotice,activityText,ACTIVITY_NOTICE_DURATION,type ActivityInput,type ActivityState} from './activityMessages';
import './activityMessages.css';
export type ActivityHistoryLink={id:string;label:string;count:number;open:()=>void};
export default function ActivityCenter({items,histories}:{items:readonly ActivityInput[];histories:ActivityHistoryLink[]}){
  const [state,setState]=useState<ActivityState>(()=>({seen:new Map(),messages:[],sequence:0}));
  const [open,setOpen]=useState(false),[now,setNow]=useState(Date.now);
  const root=useRef<HTMLElement>(null),button=useRef<HTMLButtonElement>(null);
  useEffect(()=>{const time=Date.now();setNow(time);setState(old=>collectActivity(old,items,time));},[items]);
  const latest=state.messages[0];
  useEffect(()=>{
    if(!latest)return;
    const timer=setTimeout(()=>setNow(Date.now()),Math.max(0,latest.time+ACTIVITY_NOTICE_DURATION-Date.now()));
    return()=>clearTimeout(timer);
  },[latest]);
  useEffect(()=>{
    if(!open)return;
    const outside=(e:PointerEvent)=>{if(e.target instanceof Node&&!root.current?.contains(e.target))setOpen(false);};
    const escape=(e:KeyboardEvent)=>{if(e.key==='Escape'){setOpen(false);button.current?.focus();}};
    document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
    return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
  },[open]);
  const notice=currentActivityNotice(state,now);
  return <aside ref={root} className="activity-center" aria-label="Activity messages">
    <button ref={button} type="button" className="activity-toggle icon-button" aria-label="Open activity history" aria-expanded={open} aria-controls="activity-history" onClick={()=>setOpen(v=>!v)}><CircleAlert size={22}/></button>
    {!open&&notice&&<p className="activity-notice" role="status">{activityText(notice)}</p>}
    {open&&<section id="activity-history" className="activity-history" aria-label="Recent activity">
      <header><h3>Messages</h3><button type="button" className="icon-button" aria-label="Close activity history" onClick={()=>{setOpen(false);button.current?.focus();}}><X size={16}/></button></header>
      <nav aria-label="Transaction histories">{histories.filter(h=>h.count>0).map(h=><button type="button" className="text-button" key={h.id} onClick={()=>{setOpen(false);h.open();}}>{h.label} · {h.count}</button>)}</nav>
      {state.messages.length?<ol>{state.messages.map(m=><li key={m.sequence}><span>{activityText(m)}</span><time dateTime={new Date(m.time).toISOString()}>{new Date(m.time).toLocaleTimeString('en',{hour:'2-digit',minute:'2-digit'})}</time></li>)}</ol>:<p>No activity this visit.</p>}
    </section>}
  </aside>;
}
