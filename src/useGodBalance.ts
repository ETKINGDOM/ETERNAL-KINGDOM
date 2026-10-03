import {useCallback,useEffect,useRef,useState} from 'react';
import type {GodTokenSnapshot} from '../shared/chainConfiguration';
import {godTokenService} from './godTokenService';
import {projectChainSettings} from './projectChainSettings';

type Balance={units:bigint;display:string;account:string};
type State={context:string;status:'idle'|'loading'|'available'|'error';balance:Balance|null};
export type GodBalanceState=State&{refresh:()=>Promise<void>};

/** A read on open/account/token change, never a wallet prompt or polling loop. */
export function useGodBalance(token:GodTokenSnapshot|null|undefined,account?:string,scope=''){
  const context=JSON.stringify([token,account?.toLowerCase(),scope]);
  const current=useRef(context);current.current=context;
  const controller=useRef<AbortController|null>(null);
  const [raw,setRaw]=useState<State>({context,status:'idle',balance:null});
  const state=raw.context===context?raw:{context,status:'idle' as const,balance:null};
  const refresh=useCallback(async()=>{
    if(!token||!account||controller.current)return;
    const request=new AbortController();controller.current=request;
    const valid=()=>!request.signal.aborted&&current.current===context;
    setRaw({context,status:'loading',balance:null});
    try{
      const balance=await godTokenService(projectChainSettings).balance(token,account,AbortSignal.any([request.signal,AbortSignal.timeout(15_000)]));
      if(valid())setRaw({context,status:'available',balance});
    }catch{if(valid())setRaw({context,status:'error',balance:null});}
    finally{if(controller.current===request)controller.current=null;}
  },[context,token,account]);
  useEffect(()=>{
    controller.current?.abort();controller.current=null;
    void refresh();
    return()=>{controller.current?.abort();controller.current=null;};
  },[refresh]);
  return {...state,refresh};
}
