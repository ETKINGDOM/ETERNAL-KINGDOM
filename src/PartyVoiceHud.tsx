import {Mic,MicOff,X} from 'lucide-react';
import type {PartyVoiceSession,PartyVoiceSnapshot} from './partyVoiceSession';
import InfoHint from './InfoHint';
import './voice.css';
export default function PartyVoiceHud({voice,state}:{voice:PartyVoiceSession;state:PartyVoiceSnapshot}){
  if(!state.party&&!state.invitations.length&&!state.error)return null;
  return <section className="party-voice-hud" aria-label="Voice party">
    {state.party&&<><header><span>Voice · {state.party.members.length}/4</span><InfoHint label="Voice party details"><p>Only the listed members can hear this group. Accepting an invitation requests microphone permission. No app recording. New members appear here; leave to stop your microphone and all party audio.</p><p>Audio is sent directly to at most three people, using public STUN. This may reveal network IPs. Some networks require a separately configured relay. No paid relay is enabled. Parties last up to 20 minutes.</p></InfoHint><button className="icon-button" aria-label="Leave voice party" onClick={()=>voice.leave()}><X size={16}/></button></header>
      <ul>{state.party.members.map(m=><li key={m.personId}><span className="party-avatar" style={{borderColor:m.color}} aria-hidden="true">{Array.from(m.name)[0]}</span><bdi>{m.name}{m.personId===state.self?' · You':''}</bdi>{m.muted||!m.ready?<MicOff size={13}/>:<Mic size={13}/>}</li>)}</ul>
      {state.outgoing.map(i=><p className="party-waiting" key={i.id}>Inviting <bdi>{i.peer.name}</bdi>…</p>)}
      {state.party.members.length>1&&<>{state.microphone==='on'?<button aria-label={state.muted?'Unmute microphone':'Mute microphone'} aria-pressed={state.muted} onClick={()=>voice.mute()}>{state.muted?<MicOff size={15}/>:<Mic size={15}/>}</button>:<button disabled={state.microphone==='requesting'} onClick={()=>void voice.enableMicrophone()}>{state.microphone==='requesting'?'Microphone…':'Turn on microphone'}</button>}<small role="status">{state.connected.length===state.party.members.length-1?'Connected':'Connecting…'}</small></>}
      {state.playbackBlocked&&<button onClick={()=>void voice.resumeAudio()}>Hear the party</button>}
    </>}
    {state.invitations.map(i=><div className="party-invitation" key={i.id}><p><bdi>{i.from.name}</bdi> invited you to voice · {i.members.length+1}/4</p><small>{i.members.map(m=>m.name).join(' · ')}</small><button onClick={()=>voice.answer(i.id,true)}>Accept voice invitation</button><button onClick={()=>voice.answer(i.id,false)}>Decline voice invitation</button></div>)}
    {state.error&&<p role="status">{state.error}<button className="icon-button" aria-label="Dismiss voice notice" onClick={()=>voice.dismissNotice()}><X size={14}/></button></p>}
  </section>;
}
