import {useCallback,useEffect,useRef,useState} from 'react';
import type {WalletSession} from '../shared/identity';
import type {Scene} from '../shared/scenes';
import type {Contact,SocialAction,SocialPeer} from '../shared/social';
import {hostedSocial,SocialRejection} from './socialStorage';
import {retainConversations,snapshotContacts,changedConversations,type ConversationCache} from './socialChatState';
import type {CommunityChannel} from './useCommunity';

type Cache=ConversationCache;
type Pending={peerId:string;clientId:string;text:string};
type State={scope:string;self:string;contacts:Contact[];conversations:Cache;busy:boolean;error:string;uncertain:boolean;notice:string;ack:Pending|null};
const blank=(scope:string):State=>({scope,self:'',contacts:[],conversations:{},busy:false,error:'',uncertain:false,notice:'',ack:null});

/** One account-scoped private channel for both the bottom bar and friends UI.
 * Text stays in memory; no public-room packet, local storage or telemetry. */
export function useSocialChat(session:WalletSession|null,enabled:boolean,scene:Scene,channel:number,community?:CommunityChannel){
  const scope=session?`${session.accountId}:${session.expiresAt}`:'guest';
  const [raw,setRaw]=useState(()=>blank(scope)),[target,setTarget]=useState<SocialPeer|null>(null);
  const state=raw.scope===scope?raw:blank(scope);
  const current=useRef({scope,session,enabled,scene,channel,target});current.current={scope,session,enabled,scene,channel,target};
  const cache=useRef<Cache>({}),pending=useRef<Pending|null>(null),locked=useRef(false),reading=useRef(false),turn=useRef(0),abort=useRef<AbortController|null>(null);
  const mounted=useRef(false);
  const notifications=useRef(community);notifications.current=community;
  const queued=useRef(false),lastRead=useRef(0);
  const valid=(id:number,s:string)=>mounted.current&&turn.current===id&&current.current.scope===s;
  const refresh=useCallback(async()=>{
    const c=current.current;if(!c.enabled||!c.session||c.session.expiresAt<=Date.now()||locked.current||reading.current)return;
    reading.current=true;abort.current?.abort();const control=new AbortController();abort.current=control;const id=++turn.current;
    const guard={accountId:c.session.accountId,sessionExpiresAt:c.session.expiresAt};
    try{
      const snap=await hostedSocial.snapshot({...guard,kind:'snapshot',...(c.target?{peerId:c.target.personId}:{})},control.signal);
      if(!valid(id,c.scope))return;
      const contacts=snapshotContacts(snap),pendingId=pending.current?.peerId;
      let next=retainConversations(cache.current,contacts,c.target?.personId,pendingId);
      if(snap.selected)next[snap.selected.contact.peer.personId]=snap.selected;
      // Read only changed, available conversations, with a bounded first-page
      // catch-up. A shared push adapter can replace this visible-tab poll later.
      const changed=changedConversations(contacts,next,c.target?.personId,pendingId);
      const more=await Promise.all(changed.map(peerId=>hostedSocial.snapshot({...guard,kind:'snapshot',peerId},control.signal)));
      if(!valid(id,c.scope))return;
      for(const value of more)if(value.selected)next[value.selected.contact.peer.personId]=value.selected;
      next=retainConversations(next,contacts,c.target?.personId,pendingId);cache.current=next;
      const p=pending.current,confirmed=p&&next[p.peerId]?.messages.some(m=>m.sender===snap.self&&m.clientId===p.clientId);
      if(confirmed)pending.current=null;
      setRaw(old=>({...old,scope:c.scope,self:snap.self,contacts,conversations:next,error:'',uncertain:false,ack:confirmed?p:old.ack}));
      lastRead.current=Date.now();notifications.current?.send({v:1,type:'community-watch'});
    }catch{if(valid(id,c.scope))setRaw(old=>({...old,error:'Could not refresh private chat. Check your connection.',uncertain:Boolean(pending.current)||old.uncertain}));}
    finally{if(valid(id,c.scope)){reading.current=false;if(queued.current){queued.current=false;queueMicrotask(()=>void refresh());}}}
  },[]);
  useEffect(()=>{
    mounted.current=true;turn.current++;abort.current?.abort();cache.current={};pending.current=null;locked.current=false;reading.current=false;queued.current=false;lastRead.current=0;setRaw(blank(scope));setTarget(null);
    void refresh();
    const tick=()=>{if(document.visibilityState==='visible'&&Date.now()-lastRead.current>=(notifications.current?.connected?30_000:4500))void refresh();};
    const timer=window.setInterval(tick,5000);document.addEventListener('visibilitychange',tick);window.addEventListener('focus',tick);
    return()=>{mounted.current=false;turn.current++;abort.current?.abort();window.clearInterval(timer);document.removeEventListener('visibilitychange',tick);window.removeEventListener('focus',tick);};
  },[scope,enabled,refresh]);
  useEffect(()=>community?.subscribe(packet=>{if(packet.type==='social-changed'){if(locked.current||reading.current)queued.current=true;else void refresh();}}),[community?.subscribe,refresh]);
  useEffect(()=>{void refresh();},[target?.personId,refresh]);
  const choose=useCallback((peer:SocialPeer|null)=>{setTarget(peer);},[]);
  async function change(peer:SocialPeer,action:SocialAction|'message',text=''){
    const c=current.current;if(!c.enabled||!c.session||c.session.expiresAt<=Date.now()||locked.current||state.uncertain||raw.scope!==scope)return false;
    if(action==='message'&&!text.trim())return false;
    abort.current?.abort();reading.current=false;locked.current=true;const control=new AbortController();abort.current=control;const id=++turn.current;
    const previous=cache.current[peer.personId]?.contact??state.contacts.find(x=>x.peer.personId===peer.personId);
    const base={accountId:c.session.accountId,sessionExpiresAt:c.session.expiresAt,peerId:peer.personId,expectedRevision:previous?.revision??0,scene:c.scene,channel:c.channel};
    const p:Pending=pending.current?.peerId===peer.personId&&pending.current.text===text.trim()?pending.current:{peerId:peer.personId,clientId:crypto.randomUUID(),text:text.trim()};
    if(action==='message')pending.current=p;
    setRaw(old=>({...old,busy:true,error:'',notice:''}));
    try{
      const result=await hostedSocial.change(action==='message'?{...base,kind:'message',clientId:p.clientId,text:p.text}:{...base,kind:'action',action},control.signal);
      if(!valid(id,c.scope))return false;
      cache.current={...cache.current,[peer.personId]:result};
      if(action==='message')pending.current=null;
      notifications.current?.send({v:1,type:'community-watch'});
      setRaw(old=>({...old,contacts:[result.contact,...old.contacts.filter(x=>x.peer.personId!==peer.personId)],conversations:cache.current,busy:false,error:'',uncertain:false,ack:action==='message'?p:old.ack,notice:action==='invite-friend'?'Friend request sent.':action==='accept-friend'?'Friend added.':action==='remove-friend'?'Friend removed.':''}));
      return true;
    }catch(error){if(valid(id,c.scope)){
      const rejected=error instanceof SocialRejection;if(rejected&&action==='message')pending.current=null;
      setRaw(old=>({...old,error:rejected?error.message:action==='message'?'Could not confirm your message. Refresh to check.':'Could not confirm the change. Refresh to check.',uncertain:!rejected,busy:false}));
    }return false;}
    finally{if(valid(id,c.scope)){locked.current=false;if(queued.current){queued.current=false;queueMicrotask(()=>void refresh());}}}
  }
  const privateLines=Object.values(state.conversations).flatMap(conversation=>conversation.contact.available?conversation.messages.map(m=>({...m,peer:conversation.contact.peer,mine:m.sender===state.self})):[]).sort((a,b)=>a.time-b.time||a.id.localeCompare(b.id)).slice(-40);
  return {...state,target:session&&raw.scope===scope?target:null,choose,refresh,change,privateLines};
}
export type SocialChat=ReturnType<typeof useSocialChat>;
