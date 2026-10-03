import {useEffect,useState} from 'react';
import {X} from 'lucide-react';
import {useRitualLight} from './ResponseNarration';
import {ritualPresentation} from './ritualFeedbackState';
import {RITUAL_CONFIRMED_DURATION} from './ritualLight';
import InfoHint from './InfoHint';

// A small private encouragement in the world, never submitted words/addresses.
// Receipt verification happens before a confirmed light cue can be emitted.
export default function WorldRitualResponse({visible,openPublicScreen}:{visible:boolean;openPublicScreen?:()=>void}){
  const {cue}=useRitualLight();
  const [dismissed,setDismissed]=useState(0),[expired,setExpired]=useState(0);
  useEffect(()=>{
    if(!cue||cue.startedAt===null)return;
    const timer=setTimeout(()=>setExpired(cue.id),Math.max(0,RITUAL_CONFIRMED_DURATION-(performance.now()-cue.startedAt)));
    return()=>clearTimeout(timer);
  },[cue]);
  if(!visible||!cue||cue.startedAt===null||cue.state!=='confirmed'||cue.id===dismissed||cue.id===expired)return null;
  // This ID references the already-verified local cue, not a blockchain proof.
  const event={kind:cue.kind,state:'confirmed' as const,confirmationId:`verified-cue:${cue.id}`};
  const presentation=ritualPresentation(event);if(!presentation)return null;
  return <section className="world-ritual-response" aria-label="Sanctuary response" data-response-kind={cue.kind} data-response-state="confirmed">
    <div><span className="eyebrow">A WORD OF ENCOURAGEMENT</span><button className="icon-button" type="button" aria-label="Dismiss encouragement" onClick={()=>setDismissed(cue.id)}><X size={14}/></button></div>
    <blockquote aria-live="polite">{presentation.text}</blockquote>
    <div className="world-response-meta"><small>{presentation.status}</small><InfoHint label="About this encouragement"><span>Encouragement, not a declaration of divine acceptance or forgiveness. The narrator uses a fixed AI-generated recording.</span></InfoHint></div>
    {cue.kind!=='donation'&&openPublicScreen&&<button type="button" className="text-button" onClick={()=>{setDismissed(cue.id);openPublicScreen();}}>View public screen</button>}
  </section>;
}
