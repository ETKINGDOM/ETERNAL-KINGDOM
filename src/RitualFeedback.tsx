import { useEffect, useId, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { Play, Sparkles } from 'lucide-react';
import { ritualResponses } from './content/ritualResponses';
import { ritualNarration } from './content/ritualNarration';
import { ritualPresentation, type RitualFeedbackEvent, type RitualFeedbackPort } from './ritualFeedbackState';
import {useResponseNarration,useRitualDelivery} from './ResponseNarration';
import InfoHint from './InfoHint';

export default function RitualFeedback({ref,soundEnabled,immediateSound=false}:{ref?:Ref<RitualFeedbackPort>;soundEnabled:boolean;immediateSound?:boolean;onSpeakingChange?:(playing:boolean)=>void}){
  const [response,setResponse]=useState<{event:RitualFeedbackEvent;sequence:number}|null>(null);
  const owner=useId();const sequence=useRef(0);
  const {narrator,state}=useResponseNarration();
  const delivery=useRitualDelivery();
  const error=state.owner===owner?state.error:'';
  function stop(){narrator.stop(owner);}
  function clear(){delivery.clear(owner);setResponse(null);}
  function play(){if(response&&soundEnabled)void narrator.play(owner,response.event);}
  useImperativeHandle(ref,()=>({
    clear,
    complete(event){
      stop();
      if(!ritualPresentation(event)){delivery.clear(owner);setResponse(null);return;}
      setResponse({event,sequence:++sequence.current});
      delivery.complete(owner,event,soundEnabled,immediateSound);
      // Called by completion, never by a render effect (Strict Mode/re-renders
      // must not replay). A blocked browser leaves a manual retry and the text.
    },
  }));
  // Muting this card stops only its own response. Unmounting is not a mute.
  useEffect(()=>{if(!soundEnabled)narrator.stop(owner);},[soundEnabled,narrator,owner]);
  const presentation=response?ritualPresentation(response.event):null;
  if(!response||!presentation)return null;
  const candidate=ritualNarration[response.event.kind];
  const clip=candidate?.textVersion===ritualResponses.version?candidate:undefined;
  return <section className="ritual-response" aria-label="Sanctuary response" data-response-kind={response.event.kind} data-response-state={response.event.state}>
    <div key={response.sequence} className="ritual-response-light" aria-hidden="true"><Sparkles size={22}/></div>
    <span className="eyebrow">A WORD OF ENCOURAGEMENT</span>
    <blockquote aria-live="polite">{presentation.text}</blockquote>
    <p className="ritual-response-status">{presentation.status}</p>
    {clip&&soundEnabled&&error&&<button type="button" className="text-button" onClick={play} aria-label="Play sanctuary response"><Play size={14}/> Listen to response</button>}
    {error&&<p className="error" role="alert">{error}</p>}
    <InfoHint label="About this encouragement"><span>Sanctuary narrator{clip?` · ${clip.voice} · AI-generated voice`:''}. {ritualResponses.disclaimer}</span></InfoHint>
  </section>;
}
