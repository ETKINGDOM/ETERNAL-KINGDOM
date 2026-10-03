import type {Player} from '../shared/protocol';
import type {VoiceSession,VoiceSnapshot} from './voiceSession';
import './voice.css';
export function VoiceHud({voice,state,players}:{voice:VoiceSession;state:VoiceSnapshot;players:Player[]}){
  const call=state.call,peer=players.find(p=>p.id===call?.peer);
  if(!call&&!state.error)return null;
  return <section className="voice-hud" aria-label="Private voice controls">
    {call&&<><p><bdi>{peer?.name??'A verified pilgrim'}</bdi> · {call.phase==='incoming'?'Voice invitation':call.phase==='outgoing'?'Waiting for agreement':state.connection==='connected'?'Private voice connected':'Voice agreed · microphone off or connecting'}</p>
      {call.phase==='incoming'&&<button onClick={()=>voice.accept()}>Accept voice invitation</button>}
      {call.phase==='accepted'&&<><p className="voice-disclosure">{state.connection==='connected'?'Audience: only this person · no app recording · headphones recommended.':'Audience: only this person. Not recorded by this app. Both must turn on their microphones. Direct connection can reveal your network IP to the other person and STUN provider. Some networks need a TURN relay.'}</p>
        {state.microphone!=='on'?<button disabled={state.microphone==='requesting'} onClick={()=>void voice.enableMicrophone()}>{state.microphone==='requesting'?'Requesting microphone…':'Turn on microphone'}</button>:<button aria-pressed={state.muted} onClick={()=>voice.mute()}>{state.muted?'Unmute microphone':'Mute microphone'}</button>}
        {state.playbackBlocked&&<button onClick={()=>void voice.resumeAudio()}>Hear the other person</button>}
      </>}
      <button onClick={()=>voice.leave()}>{call.phase==='incoming'?'Decline voice invitation':call.phase==='outgoing'?'Cancel voice invitation':'Leave voice call'}</button>
    </>}
    {state.error&&<p role="status">{state.error}<button onClick={()=>voice.reset()} aria-label="Dismiss voice notice">×</button></p>}
  </section>;
}
