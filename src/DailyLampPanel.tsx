import {useEffect,useRef,useState} from 'react';
import {Flame} from 'lucide-react';
import type {WalletSession} from '../shared/identity';
import {LAMP_CYCLE_LENGTH,type DailyLampAdapter,type LampSnapshot} from '../shared/dailyLamp';
import {hostedDailyLamps} from './dailyLampStorage';
import InfoHint from './InfoHint';
import './dailyLamp.css';

export default function DailyLampPanel({session,openProfile,onLit,adapter=hostedDailyLamps}:{session:WalletSession|null;openProfile:()=>void;onLit?:()=>void;adapter?:DailyLampAdapter}){
  const scope=session?`${session.accountId}:${session.expiresAt}`:'';
  const current=useRef(scope);current.current=scope;
  const serial=useRef(0),abort=useRef<AbortController|null>(null),locked=useRef(false);
  const [state,setState]=useState<{scope:string;lamp:LampSnapshot|null;busy:boolean;uncertain:boolean;error:string;glow:boolean}>({scope:'',lamp:null,busy:false,uncertain:false,error:'',glow:false});
  const active=state.scope===scope?state:null, lamp=active?.lamp??null;
  async function update(light=false){
    if(!session||locked.current||session.expiresAt<=Date.now())return;
    if(light&&(!lamp||lamp.litToday||active?.uncertain))return;
    const key=scope,turn=++serial.current,controller=new AbortController();abort.current?.abort();abort.current=controller;locked.current=true;
    setState(old=>({...old,scope:key,busy:true,error:'',glow:false}));
    try{
      const input={accountId:session.accountId,sessionExpiresAt:session.expiresAt};
      const next=await (light?adapter.light(input,controller.signal):adapter.read(input,controller.signal));
      if(current.current!==key||serial.current!==turn)return;
      const newlyLit=light&&next.total>(lamp?.total??0);
      setState({scope:key,lamp:next,busy:false,uncertain:false,error:'',glow:newlyLit});
      if(newlyLit){try{onLit?.();}catch{/* Presentation cannot undo a saved lamp. */}}
    }catch{
      if(current.current===key&&serial.current===turn)setState(old=>({...old,busy:false,uncertain:true,error:light?'Could not confirm. Check your lamp before trying again.':'Your lamps could not be loaded.',glow:false}));
    }finally{if(current.current===key&&serial.current===turn)locked.current=false;}
  }
  useEffect(()=>{
    locked.current=false;setState({scope,lamp:null,busy:Boolean(session),uncertain:false,error:'',glow:false});
    if(session)void update();
    return()=>{serial.current++;abort.current?.abort();};
  },[scope,adapter]);
  // Read on returning to the visible panel/UTC rollover, never a background
  // lighting action. Account writes remain independent of appearance revisions.
  useEffect(()=>{
    if(!session)return;
    const read=()=>{if(document.visibilityState==='visible')void update();};
    document.addEventListener('visibilitychange',read);window.addEventListener('focus',read);
    const delay=lamp?Math.min(Math.max(1000,lamp.nextResetAt-Date.now()+100),86_400_000):0;
    const timer=delay?window.setTimeout(read,delay):undefined;
    return()=>{document.removeEventListener('visibilitychange',read);window.removeEventListener('focus',read);window.clearTimeout(timer);};
  },[scope,lamp?.nextResetAt,adapter]);
  return <section className="daily-lamp" aria-label="Your daily lamps">
    <div className="daily-lamp-heading"><h3>Your lamps</h3><InfoHint label="Daily lamp details"><p>One lamp each UTC day. Seven lights complete a cycle; missed days do not reset your total.</p><p>Saved with this verified account on this service, not onchain. No God tokens, Gas, rewards or spiritual rank. EVM and SOL identities are separate.</p></InfoHint></div>
    <div className={`daily-lamp-row ${active?.glow?'just-lit':''}`} aria-label={lamp?`${lamp.litInCycle} of 7 lamps lit`:'Seven daily lamps'}>
      {Array.from({length:LAMP_CYCLE_LENGTH},(_,i)=><span key={i} className={`${lamp&&i<lamp.litInCycle?'lit':''} ${active?.glow&&i===lamp!.litInCycle-1?'new-light':''}`} aria-label={`Lamp ${i+1}: ${lamp&&i<lamp.litInCycle?'lit':'unlit'}`}><Flame size={24}/></span>)}
    </div>
    {!session?<><p>Sign in to keep your lamps.</p><button type="button" className="secondary-button" onClick={openProfile}>Connect wallet</button></>:<>
      <p className="lamp-total">Total lights <strong>{lamp?lamp.total:'—'}</strong>{lamp&&<small>Cycle {lamp.cycle}</small>}</p>
      {lamp?.litToday&&<p role="status">Today’s lamp is lit.</p>}
      {active?.glow&&<p className="lamp-response" role="status">A little light for this day.</p>}
      <button type="button" className="primary" disabled={!lamp||Boolean(active?.busy)||Boolean(active?.uncertain)||lamp.litToday||session.expiresAt<=Date.now()} onClick={()=>void update(true)}>{active?.busy?'Checking…':lamp?.litToday?'Lit today':'Light today’s lamp'}</button>
      {active?.error&&<p role="alert" className="error">{active.error}</p>}
      {active?.uncertain&&<button type="button" className="text-button" disabled={active.busy} onClick={()=>void update()}>Check my lamps</button>}
      {session.expiresAt<=Date.now()&&<button type="button" className="text-button" onClick={openProfile}>Sign in again</button>}
    </>}
  </section>;
}
