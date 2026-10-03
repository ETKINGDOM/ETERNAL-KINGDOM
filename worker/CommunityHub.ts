import {DurableObject} from 'cloudflare:workers';
import {COMMUNITY_PROTOCOL,partyClientSchema,type CommunityServer} from '../shared/community';
import {socialPairKey,type SocialPeer} from '../shared/social';
import {routingHash,sessionRoutingKey} from './sessionRouting';
import {CommunityVoice,type CommunityPerson,type PartyState} from './CommunityVoice';
type Attachment={person:CommunityPerson;auth:{key:string;generation:string;origin:string;expiresAt:number;profileKey:string};active:boolean;seen:number;verifiedAt:number;watch:string[];rateAt:number;rate:number;inviteAt:number;voiceLease?:number};
const json=(error:string,status=400)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
// Independent of map sockets. Stores only party consent and presence references;
// no private messages, microphone bytes, recordings, SDP or wallet addresses.
export class CommunityHub extends DurableObject<Env>{
  private voice:CommunityVoice;
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.blockConcurrencyWhile(async()=>{this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS parties(id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)');});
    this.voice=new CommunityVoice({load:()=>{const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM parties WHERE id=1').toArray()[0],s:PartyState=row?JSON.parse(row.value):{parties:[],invitations:[]};for(const g of s.parties)for(const m of g.members){const ws=this.socket(m.connection);if(ws)m.lease=Math.max(m.lease,this.data(ws).voiceLease??0);}return s;},save:(s,ephemeral)=>{for(const g of s.parties)for(const m of g.members){const ws=this.socket(m.connection);if(ws){const a=this.data(ws);if(a.voiceLease!==m.lease){a.voiceLease=m.lease;ws.serializeAttachment(a);}}}if(!ephemeral)this.ctx.storage.sql.exec('INSERT OR REPLACE INTO parties VALUES(1,?)',JSON.stringify(s));},
      person:id=>{const ws=this.socket(id);return ws?this.data(ws).person:undefined;},connections:id=>this.sockets().filter(ws=>this.data(ws).person.personId===id).map(ws=>this.data(ws).person.connection),send:(id,p)=>{const ws=this.socket(id);if(ws)this.send(ws,p);},
      allowed:async(a,b)=>{for(const id of [a,b]){const ws=this.sockets().find(w=>this.data(w).person.personId===id);if(!ws||!await this.verify(ws))return false;}return this.env.SOCIAL_PAIRS.getByName(socialPairKey(a,b)).voiceAllowed(a,b);},
      allowInvite:id=>{const ws=this.socket(id);if(!ws)return false;const s=this.data(ws);if(Date.now()-s.inviteAt<2000)return false;s.inviteAt=Date.now();ws.serializeAttachment(s);return true;},
    });
  }
  private data(ws:WebSocket){return ws.deserializeAttachment() as Attachment;}
  private sockets(){return this.ctx.getWebSockets().filter(ws=>ws.readyState===WebSocket.OPEN&&this.data(ws)?.active);}
  private socket(id:string){return this.sockets().find(ws=>this.data(ws).person.connection===id);}
  private send(ws:WebSocket,packet:CommunityServer){try{ws.send(JSON.stringify(packet));}catch{/* No signal/message logging. */}}
  private async verify(ws:WebSocket){
    const s=this.data(ws);let valid=false;try{valid=s.auth.expiresAt>Date.now()&&await this.env.WALLET_SESSIONS.getByName(s.auth.key).presenceCurrent(s.auth.origin,s.auth.generation);}catch{/* Fail closed. */}
    if(!valid){this.close(ws);return false;}if(ws.readyState!==WebSocket.OPEN||!this.data(ws).active)return false;
    const latest=this.data(ws);latest.verifiedAt=Date.now();ws.serializeAttachment(latest);return true;
  }
  private close(ws:WebSocket){const s=this.data(ws);if(!s?.active)return;s.active=false;ws.serializeAttachment(s);this.voice.clean(s.person.connection);try{ws.close(1000,'Community session ended');}catch{}this.presence();}
  private presence(){const online=new Set(this.sockets().map(ws=>this.data(ws).person.personId));for(const ws of this.sockets())this.send(ws,{v:1,type:'community-presence',online:this.data(ws).watch.filter(id=>online.has(id))});}
  private async watch(ws:WebSocket){const s=this.data(ws),contacts=await this.env.SOCIAL_INBOXES.getByName(s.person.personId).list();if(!this.socket(s.person.connection))return;
    const saved=await this.env.ACCOUNT_PROFILES.getByName(s.auth.profileKey).roomProfile();if(!this.socket(s.person.connection))return;
    const latest=this.data(ws);latest.watch=contacts.filter(c=>c.available).map(c=>c.peer.personId);latest.person.name=saved.appearance.name;latest.person.color=saved.appearance.color;ws.serializeAttachment(latest);this.presence();}
  async notifySocial(ids:string[]){for(const ws of this.sockets())if(ids.includes(this.data(ws).person.personId))this.send(ws,{v:1,type:'social-changed'});}
  async revalidateSession(key:string){await Promise.all(this.sockets().filter(ws=>this.data(ws).auth.key===key).map(ws=>this.verify(ws)));await this.schedule();}
  private async schedule(){const due=[...this.voice.deadlines(),...this.sockets().flatMap(ws=>[this.data(ws).auth.expiresAt,this.data(ws).seen+45_000])];if(due.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+100,Math.min(...due)));else await this.ctx.storage.deleteAlarm();}
  async fetch(request:Request){
    const protocol=request.headers.get('Sec-WebSocket-Protocol')?.split(',').map(s=>s.trim()),key=await sessionRoutingKey(request),origin=request.headers.get('Origin');
    if(!key||!origin||protocol?.length!==2||protocol[0]!==COMMUNITY_PROTOCOL||!/^ticket\.[a-f0-9]{64}$/.test(protocol[1]))return json('Community login required.',401);
    const proof=await this.env.WALLET_SESSIONS.getByName(key).consumeCommunityTicket(origin,protocol[1].slice(7),key);if(!proof)return json('Community ticket expired.',401);
    const profileKey=await routingHash(proof.session.accountId),saved=await this.env.ACCOUNT_PROFILES.getByName(profileKey).roomProfile();
    if(this.sockets().length>=256||this.sockets().filter(ws=>this.data(ws).person.personId===saved.personId).length>=3)return json('Community connection capacity reached.',429);
    const pair=new WebSocketPair(),connection=crypto.randomUUID();this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({person:{personId:saved.personId,name:saved.appearance.name,family:proof.session.family,color:saved.appearance.color,connection},auth:{key,generation:proof.generation,origin,expiresAt:proof.session.expiresAt,profileKey},active:true,seen:Date.now(),verifiedAt:0,watch:[],rateAt:Date.now(),rate:0,inviteAt:0} satisfies Attachment);
    if(!await this.verify(pair[1]))return json('Community session changed.',401);
    this.send(pair[1],{v:1,type:'community-ready',self:{personId:saved.personId,name:saved.appearance.name,family:proof.session.family}});this.voice.snapshot(connection);await this.watch(pair[1]);await this.schedule();
    return new Response(null,{status:101,webSocket:pair[0],headers:{'Sec-WebSocket-Protocol':COMMUNITY_PROTOCOL}});
  }
  async webSocketMessage(ws:WebSocket,message:string|ArrayBuffer){
    if(typeof message!=='string'||message.length>20_000||!this.data(ws)?.active){this.close(ws);return;}
    let raw:unknown;try{raw=JSON.parse(message);}catch{return;}
    const result=partyClientSchema.safeParse(raw);if(!result.success)return;
    const s=this.data(ws),now=Date.now();if(now-s.rateAt>60_000){s.rateAt=now;s.rate=0;}if(++s.rate>120){this.close(ws);return;}s.seen=now;ws.serializeAttachment(s);
    if((result.data.type!=='community-ping'||now-s.verifiedAt>20_000)&&!await this.verify(ws))return;
    if(result.data.type==='community-watch')await this.watch(ws);else await this.voice.handle(s.person.connection,result.data);
    await this.schedule();
  }
  async webSocketClose(ws:WebSocket){this.close(ws);await this.schedule();}
  async webSocketError(ws:WebSocket){this.close(ws);await this.schedule();}
  async alarm(){for(const ws of this.sockets())if(this.data(ws).seen+45_000<=Date.now()||this.data(ws).auth.expiresAt<=Date.now())this.close(ws);this.voice.clean();await this.schedule();}
}
