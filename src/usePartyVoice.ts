import {useEffect,useRef,useSyncExternalStore} from 'react';
import type {CommunityChannel} from './useCommunity';
import {PartyVoiceSession} from './partyVoiceSession';
export function usePartyVoice(channel:CommunityChannel,scope:string){
  const current=useRef(channel);current.current=channel;const owned=useRef<PartyVoiceSession|null>(null);if(!owned.current)owned.current=new PartyVoiceSession(p=>current.current.send(p));
  const session=owned.current,state=useSyncExternalStore(session.subscribe,session.getSnapshot);
  useEffect(()=>channel.subscribe(p=>session.receive(p)),[session,channel.subscribe]);
  useEffect(()=>{session.reset();return()=>session.leave();},[scope,session]);
  useEffect(()=>{if(!channel.connected)session.reset();},[channel.connected,session]);
  useEffect(()=>{const tick=setInterval(()=>session.tick(),4000),hide=()=>session.leave('Voice stopped while the page was away.');const visibility=()=>{if(document.visibilityState==='hidden')hide();};window.addEventListener('pagehide',hide);document.addEventListener('visibilitychange',visibility);return()=>{clearInterval(tick);window.removeEventListener('pagehide',hide);document.removeEventListener('visibilitychange',visibility);session.leave();};},[session]);
  return {session,state};
}
