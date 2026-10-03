import {useEffect,useRef,useSyncExternalStore} from 'react';
import type {useWorld} from './useWorld';
import {VoiceSession} from './voiceSession';
export function useVoice(world:ReturnType<typeof useWorld>){
  const latest=useRef(world);latest.current=world;
  const voice=useRef<VoiceSession|null>(null);
  if(!voice.current)voice.current=new VoiceSession(packet=>latest.current.send(packet));
  const session=voice.current,state=useSyncExternalStore(session.subscribe,session.getSnapshot);
  useEffect(()=>world.subscribeVoice(packet=>session.receive(packet)),[session]);
  useEffect(()=>{session.reset();return()=>session.leave();},[world.self,world.status,session]);
  useEffect(()=>{const timer=setInterval(()=>session.tick(),4000);const pageHide=()=>session.leave();window.addEventListener('pagehide',pageHide);return()=>{clearInterval(timer);window.removeEventListener('pagehide',pageHide);session.leave();};},[session]);
  useEffect(()=>{const call=state.call;if(call&&!world.players.some(p=>p.id===call.peer))session.leave();},[world.players,state.call,session]);
  return {session,state};
}
