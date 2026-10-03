import {useEffect,useRef,useState} from 'react';
import type {WalletSession} from '../shared/identity';
import {evmReceivingAddressSchema,type AccountProfile,type Appearance,type ProfileMutation} from '../shared/profile';
import {hostedProfiles,ProfileRequestError} from './profileStorage';

type State={scope:string;profile:AccountProfile|null;busy:boolean;error:string;needsReload:boolean;editorVersion:number};
const empty:State={scope:'',profile:null,busy:false,error:'',needsReload:false,editorVersion:0};
export function useAccountProfile(session:WalletSession|null){
  const scope=session?`${session.accountId}/${session.expiresAt}`:'';
  const scopeRef=useRef(scope);scopeRef.current=scope;
  const active=useRef<AbortController|null>(null),serial=useRef(0),locked=useRef(false);
  const [state,setState]=useState<State>(empty);
  const current=state.scope===scope?state:null;
  async function refresh(){
    if(!session||locked.current)return;
    const key=scope,version=++serial.current,controller=new AbortController();active.current?.abort();active.current=controller;
    setState(old=>({...empty,...(old.scope===key?old:{}),scope:key,busy:true,error:''}));
    try{
      const profile=await hostedProfiles.load(session.accountId,controller.signal);
      if(scopeRef.current===key&&serial.current===version)setState(old=>({scope:key,profile,busy:false,error:'',needsReload:false,editorVersion:old.editorVersion+1}));
    }catch(error){if(scopeRef.current===key&&serial.current===version)setState(old=>({...old,busy:false,needsReload:true,error:error instanceof ProfileRequestError?error.message:'Saved profile is unavailable. Reload to try again; nothing has been overwritten.'}));}
  }
  useEffect(()=>{
    locked.current=false;if(!session)setState(empty);else void refresh();
    return()=>{serial.current++;active.current?.abort();};
  },[scope]);
  async function save(change:ProfileMutation):Promise<boolean>{
    if(!session||!current?.profile||current.busy||current.needsReload||locked.current||session.expiresAt<=Date.now())return false;
    const key=scope,version=++serial.current,controller=new AbortController();active.current?.abort();active.current=controller;locked.current=true;
    setState(old=>({...old,busy:true,error:''}));
    try{
      const profile=await hostedProfiles.save(change,controller.signal);
      if(scopeRef.current!==key||version!==serial.current)return false;
      setState(old=>({...old,profile,busy:false,needsReload:false}));return true;
    }catch(error){
      if(scopeRef.current===key&&serial.current===version)setState(old=>({...old,busy:false,needsReload:true,error:error instanceof ProfileRequestError?error.message:'Save could not be confirmed. Reload the saved profile before trying again.'}));
      return false;
    }finally{if(scopeRef.current===key&&version===serial.current)locked.current=false;}
  }
  const saveAppearance=(appearance:Appearance)=>current?.profile?save({kind:'appearance',accountId:current.profile.accountId,expectedRevision:current.profile.revision,appearance}):Promise.resolve(false);
  const saveRecipient=(address:string|null)=>current?.profile?save({kind:'recipient',accountId:current.profile.accountId,expectedRevision:current.profile.revision,address:address===null?null:evmReceivingAddressSchema.parse(address),confirmed:true}):Promise.resolve(false);
  const saveGiftPublication=(mode:AccountProfile['giftPublication'])=>current?.profile?save({kind:'gift-publication',accountId:current.profile.accountId,expectedRevision:current.profile.revision,mode,address:mode==='published'?current.profile.evmRecipient?.address??null:null,confirmed:true}):Promise.resolve(false);
  return {profile:current?.profile??null,busy:Boolean(session)&&(!current||current.busy),error:current?.error??'',needsReload:current?.needsReload??false,editorVersion:current?.editorVersion??0,refresh,saveAppearance,saveRecipient,saveGiftPublication};
}
