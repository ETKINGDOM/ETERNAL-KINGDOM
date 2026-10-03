import {releaseHeaders,releaseSocketUrl} from './releaseScope';
import {useCallback,useEffect,useRef,useState} from 'react';
import {z} from 'zod';
import type {WalletSession} from '../shared/identity';
import {COMMUNITY_PROTOCOL,communityServerSchema,type CommunityClient,type CommunityServer} from '../shared/community';
import type {SocialPeer} from '../shared/social';
const ticketSchema=z.object({ticket:z.string().regex(/^[a-f0-9]{64}$/),expiresAt:z.number().positive()}).strict();
export type CommunityChannel={send:(packet:CommunityClient)=>boolean;subscribe:(fn:(packet:CommunityServer)=>void)=>()=>void;connected:boolean};
export function useCommunity(session:WalletSession|null,enabled:boolean){
  const scope=session?`${session.accountId}:${session.expiresAt}`:'guest',current=useRef(scope);current.current=scope;
  const [state,setState]=useState<{scope:string;connected:boolean;self:SocialPeer|null;online:string[]}>({scope,connected:false,self:null,online:[]});
  const socket=useRef<WebSocket|null>(null),connectedScope=useRef(''),listeners=useRef(new Set<(p:CommunityServer)=>void>());
  const subscribe=useCallback((fn:(p:CommunityServer)=>void)=>{listeners.current.add(fn);return()=>{listeners.current.delete(fn);};},[]);
  const send=useCallback((packet:CommunityClient)=>{if(connectedScope.current!==current.current||socket.current?.readyState!==WebSocket.OPEN)return false;socket.current.send(JSON.stringify(packet));return true;},[]);
  useEffect(()=>{
    let disposed=false,attempts=0,retry:ReturnType<typeof setTimeout>,heartbeat:ReturnType<typeof setInterval>;
    const controller=new AbortController();setState({scope,connected:false,self:null,online:[]});
    const disconnect=()=>{setState({scope,connected:false,self:null,online:[]});for(const fn of listeners.current)fn({v:1,type:'party-state',party:null,invitations:[],outgoing:[]});};
    async function connect(){
      if(!session||!enabled||disposed||session.expiresAt<=Date.now())return;
      try{
        const response=await fetch('/api/auth/community-ticket',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...releaseHeaders()},body:JSON.stringify({accountId:session.accountId,sessionExpiresAt:session.expiresAt}),signal:AbortSignal.any([controller.signal,AbortSignal.timeout(10_000)])});
        if(!response.ok)throw Error('Unavailable');const proof=ticketSchema.parse(await response.json());
        if(disposed||scope!==current.current||proof.expiresAt<=Date.now())return;
        const ws=new WebSocket(releaseSocketUrl(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/community`),[COMMUNITY_PROTOCOL,`ticket.${proof.ticket}`]);socket.current=ws;connectedScope.current=scope;
        ws.onmessage=event=>{
          if(disposed||socket.current!==ws||typeof event.data!=='string'||event.data.length>30_000)return;
          let input:unknown;try{input=JSON.parse(event.data);}catch{return;}const result=communityServerSchema.safeParse(input);if(!result.success)return;const p=result.data;
          if(p.type==='community-ready'){attempts=0;setState(old=>({...old,scope,connected:true,self:p.self}));}
          if(p.type==='community-presence')setState(old=>({...old,online:p.online}));
          for(const fn of listeners.current)fn(p);
        };
        ws.onclose=()=>{if(disposed||socket.current!==ws)return;clearInterval(heartbeat);disconnect();retry=setTimeout(()=>void connect(),Math.min(3000*2**attempts++,30000));};
        heartbeat=setInterval(()=>{if(ws.readyState===WebSocket.OPEN)send({v:1,type:'community-ping'});},10_000);
      }catch{if(!disposed){disconnect();retry=setTimeout(()=>void connect(),Math.min(3000*2**attempts++,30000));}}
    }
    void connect();return()=>{disposed=true;controller.abort();clearTimeout(retry);clearInterval(heartbeat);connectedScope.current='';const ws=socket.current;socket.current=null;ws?.close();};
  },[scope,enabled,send]);
  const active=state.scope===scope?state:{scope,connected:false,self:null,online:[]};
  return {...active,send,subscribe};
}
