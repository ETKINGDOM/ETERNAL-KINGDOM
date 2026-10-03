import {createContext,useContext,useEffect,useRef,useState,useSyncExternalStore,type ReactNode} from 'react';
import {Play} from 'lucide-react';
import {ResponseNarrator} from './responseNarrator';
import {RitualLightStore} from './ritualLight';
import {RitualDelivery} from './ritualDelivery';

const Context=createContext<ResponseNarrator|null>(null);
const LightContext=createContext<RitualLightStore|null>(null);
const DeliveryContext=createContext<RitualDelivery|null>(null);
export function ResponseNarrationProvider({children}:{children:ReactNode}){
  const host=useRef<HTMLDivElement>(null);
  const [light]=useState(()=>new RitualLightStore(()=>performance.now()));
  const [narrator]=useState(()=>new ResponseNarrator(()=>{
    const audio=document.createElement('audio');audio.preload='none';audio.dataset.responseNarrator='true';
    host.current!.append(audio);return audio;
  }));
  const [delivery]=useState(()=>new RitualDelivery(light,narrator));
  useEffect(()=>{
    const hide=()=>{if(document.hidden)delivery.hide();};
    document.addEventListener('visibilitychange',hide);
    return()=>{document.removeEventListener('visibilitychange',hide);delivery.clear();};
  },[delivery]);
  return <Context.Provider value={narrator}><LightContext.Provider value={light}><DeliveryContext.Provider value={delivery}><div hidden ref={host}/>{children}</DeliveryContext.Provider></LightContext.Provider></Context.Provider>;
}
export function useRitualDelivery(){const delivery=useContext(DeliveryContext);if(!delivery)throw new Error('Ritual delivery requires the page provider.');return delivery;}
export function useRitualLight(){
  const light=useContext(LightContext);if(!light)throw new Error('Ritual light requires the page provider.');
  const cue=useSyncExternalStore(light.subscribe,light.getSnapshot);
  return {light,cue};
}
export function useResponseNarration(){
  const narrator=useContext(Context);
  if(!narrator)throw new Error('Response narrator requires the page provider.');
  const state=useSyncExternalStore(narrator.subscribe,narrator.getSnapshot);
  return {narrator,state};
}
export function ResponseNarrationTail({visible}:{visible:boolean}){
  const {narrator,state}=useResponseNarration();
  if(!visible)return null;
  if(state.error)return <button className="sound-button response-tail" type="button" aria-label="Play sanctuary response" title="Audio could not play automatically. Tap to listen." onClick={()=>void narrator.retry()}><Play size={16}/><span>Listen to response</span></button>;
  // An automatic response is heard once. The global sound control still mutes it.
  // Only a blocked attempt gets a recovery action, never a replay/pause control.
  return null;
}
