import {releaseObjectKey} from './releaseScope';
import { DurableObject } from 'cloudflare:workers';
import { clientPacketSchema, type Player, type ServerPacket, type ChatMessage } from '../shared/protocol';
import { canTravel, CHAT_LIMIT, CHAT_TTL, COLORS, ROOM_CAPACITY, spawnPosition, type Scene } from '../shared/world';
import { capabilities } from '../shared/capabilities';
import { parseRoomPath } from '../shared/scenes';
import { authRequest } from './auth';
import {ROOM_PROTOCOL} from '../shared/roomIdentity';
import {routingHash,sessionRoutingKey} from './sessionRouting';
import {RoomSafety} from './RoomSafety';
import {moderatorAccounts} from './moderation';
import type {ModerationMutation} from '../shared/moderation';
import {giftRecipientRequestSchema,giftRecipientResultSchema,giftTargetFor,giftTargetKey,type GiftRecipientRequest,type GiftRecipientResult} from '../shared/gifts';
import {RoomVoice} from './RoomVoice';
import type {VoiceConsent} from '../shared/voice';
import {socialPairKey} from '../shared/social';
import {projectDataScope} from './releaseScope';
import {projectChainSettings} from '../src/projectChainSettings';
import {matchesReleaseRequest} from '../shared/releaseScope';
import {isShowcase} from '../shared/chainConfiguration';
const showcase=isShowcase(projectChainSettings);
export { WalletSessionStore } from './WalletSession';
export { AccountProfileStore } from './AccountProfile';
export { SocialInbox } from './SocialInbox';
export { SocialPair } from './SocialPair';
export { CommunityHub } from './CommunityHub';
export { FaithIndex } from './FaithIndex';
export { PublicFaithDatabase } from './PublicFaithDatabase';

type RoomAuth={key:string;generation:string;origin:string;expiresAt:number;profileKey:string};
type Attachment = { player: Player; scene: Scene; lastMove: number; lastChat: number; lastEmote: number; lastProfile: number; window: number; count: number; ip: string; active?:boolean; auth?:RoomAuth;voice?:VoiceConsent;lastVoiceInvite?:number };
type ChatRow = { id: string; sender: string; name: string; text: string; time: number };
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

export function allowedOrigin(request: Request): boolean {
  const origin = request.headers.get('Origin');
  if (!origin) return false;
  const target = new URL(request.url);
  if (origin === target.origin) return true;
  // Vite's local proxy only. This exception cannot activate on a deployed hostname.
  try {
    const from = new URL(origin);
    return ['localhost', '127.0.0.1'].includes(target.hostname) && ['localhost', '127.0.0.1'].includes(from.hostname) && from.port === '5173' && from.protocol === 'http:';
  } catch { return false; }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (url.pathname === '/api/capabilities' && request.method === 'GET') return json({ version: 1, stage: showcase?'showcase':'local-alpha', capabilities:showcase?Object.fromEntries(Object.keys(capabilities).map(k=>[k,k==='world'||k==='narration'?'available':'paused'])):{...capabilities,roomModeration:moderatorAccounts(env.MODERATOR_ACCOUNTS).length?'available':'unconfigured'} });
      if (url.pathname === '/api/health') return json({ ok: projectChainSettings.status==='valid', version: 1,release:projectDataScope,mode:showcase?'showcase':'alpha' });
      if(url.pathname.startsWith('/api/')&&projectChainSettings.status!=='valid')return json({error:'Release configuration unavailable.'},503);
      if(url.pathname.startsWith('/api/')&&projectChainSettings.status==='valid'&&!matchesReleaseRequest(request,projectChainSettings.config))return json({error:'This release changed. Refresh the website.'},409);
      if(showcase&&url.pathname.startsWith('/api/')&&!parseRoomPath(url.pathname))return json({error:'Explore and listen. Account and transaction features are paused.'},423);
      if(url.pathname.startsWith('/api/auth/')){
        if(!allowedOrigin(request))return json({error:'Origin not allowed'},403);
        return await authRequest(request,env);
      }
      const match = parseRoomPath(url.pathname);
      if(url.pathname==='/api/faith-feed'){
        if(!allowedOrigin(request))return json({error:'Origin not allowed'},403);
        return await env.FAITH_INDEX.getByName(releaseObjectKey('public-v1')).fetch(request);
      }
      if(url.pathname==='/api/public-faith'||url.pathname==='/api/public-faith/sync'){
        if(!allowedOrigin(request))return json({error:'Origin not allowed'},403);
        return await env.PUBLIC_FAITH_DB.getByName(releaseObjectKey('public-v1')).fetch(request);
      }
      if(url.pathname==='/api/community'){
        if(request.method!=='GET'||request.headers.get('Upgrade')?.toLowerCase()!=='websocket')return json({error:'WebSocket required'},426);
        if(!allowedOrigin(request))return json({error:'Origin not allowed'},403);
        return await env.COMMUNITY.getByName(releaseObjectKey('global-v1')).fetch(request);
      }
      if (match) {
        if (request.method !== 'GET') return json({ error: 'Method not allowed' }, 405);
        if (!allowedOrigin(request)) return json({ error: 'Origin not allowed' }, 403);
        if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket required' }, 426);
        return await env.WORLD_ROOMS.getByName(releaseObjectKey(`${match.scene}:${match.channel}`)).fetch(request);
      }
      // A hidden UI is not a security boundary: all unfinished APIs stay closed.
      if (url.pathname.startsWith('/api/')) return json({ error: 'This capability is not enabled in the alpha' }, 404);
      const response=await env.ASSETS.fetch(request);
      if(response.headers.get('Content-Type')?.startsWith('text/html')){
        const headers=new Headers(response.headers);headers.set('Cache-Control','no-cache');
        return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
      }
      return response;
    } catch {
      console.error(JSON.stringify({ event: 'request_failed', path: url.pathname }));
      return json({ error: 'The sanctuary connection is temporarily unavailable' }, 503);
    }
  },
} satisfies ExportedHandler<Env>;

export class WorldRoom extends DurableObject<Env> {
  private safety:RoomSafety;
  private voice:RoomVoice;
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.safety=new RoomSafety(ctx.storage);
    const find=(id:string)=>this.ctx.getWebSockets().find(ws=>this.state(ws).player.id===id);
    this.voice=new RoomVoice({
      connections:()=>this.ctx.getWebSockets().map(ws=>this.state(ws).player.id),
      read:id=>{const ws=find(id);if(!ws)return;const s=this.state(ws);return {id,active:Boolean(s.active&&ws.readyState===WebSocket.OPEN),personId:s.player.identity?.kind==='wallet'?s.player.identity.personId:undefined,voice:s.voice,lastVoiceInvite:s.lastVoiceInvite};},
      write:c=>{const ws=find(c.id);if(!ws)return;const s=this.state(ws);s.voice=c.voice;s.lastVoiceInvite=c.lastVoiceInvite;ws.serializeAttachment(s);},
      send:(id,packet)=>{const ws=find(id);if(ws)this.send(ws,packet);},
      allowed:async(a,b)=>{
        const first=find(a),second=find(b);if(!first||!second)return false;
        for(const ws of [first,second]){const auth=this.state(ws).auth;if(!auth||!await this.authenticated(ws,auth))return false;}
        const x=this.state(first).player.identity,y=this.state(second).player.identity;
        return x?.kind==='wallet'&&y?.kind==='wallet'&&await this.env.SOCIAL_PAIRS.getByName(releaseObjectKey(socialPairKey(x.personId,y.personId))).voiceAllowed(x.personId,y.personId);
      },
    });
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS chat (id TEXT PRIMARY KEY, sender TEXT NOT NULL, name TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL)');
      this.ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS chat_time ON chat(time)');
      this.safety.initialize();
    });
  }

  private state(ws: WebSocket): Attachment {
    const state=ws.deserializeAttachment() as Attachment;
    state.player.posture??='standing'; // Connections created before the posture feature.
    state.player.identity??={kind:'guest'};
    state.active??=true;
    return state;
  }
  private sockets(): WebSocket[] { return this.ctx.getWebSockets().filter(ws => ws.readyState === WebSocket.OPEN); }
  private visibleSockets():WebSocket[]{return this.sockets().filter(ws=>this.state(ws).active);}
  private send(ws: WebSocket, packet: ServerPacket): void {
    try { ws.send(JSON.stringify(packet)); } catch { try { ws.close(1011, 'Connection interrupted'); } catch { /* Already closed. */ } }
  }
  private broadcast(packet: ServerPacket, except?: WebSocket): void {
    for (const ws of this.visibleSockets()) if (ws !== except) this.send(ws, packet);
  }
  private cleanHistory(): void {
    this.ctx.storage.sql.exec('DELETE FROM chat WHERE time <= ?', Date.now() - CHAT_TTL);
    this.ctx.storage.sql.exec('DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY time DESC, rowid DESC LIMIT ?)', CHAT_LIMIT);
    this.safety.clean();
  }
  private async scheduleExpiry(): Promise<void> {
    const next = this.ctx.storage.sql.exec<{ time: number }>('SELECT time FROM chat ORDER BY time ASC LIMIT 1').toArray()[0];
    const due=[...this.voice.expiries(),...this.safety.nextExpiry(),...(next?[next.time+CHAT_TTL]:[]),...this.sockets().flatMap(ws=>{const auth=this.state(ws).auth;return auth?[auth.expiresAt]:[];})];
    if (due.length) await this.ctx.storage.setAlarm(Math.min(...due));
    else await this.ctx.storage.deleteAlarm();
  }
  private removePresence(ws:WebSocket,reason='Left the room'){
    this.voice.end(this.state(ws).player.id);
    const state=this.state(ws),visible=state.active;state.active=false;ws.serializeAttachment(state);
    try{ws.close(1000,reason);}catch{/* Already closed. */}
    if(visible)this.broadcast({v:1,type:'left',id:state.player.id},ws);
  }
  private expireSessions(){for(const ws of this.sockets()){const auth=this.state(ws).auth;if(auth&&auth.expiresAt<=Date.now())this.removePresence(ws,'Wallet session expired');}}
  private async authenticated(ws:WebSocket,auth:RoomAuth){
    let current=false;
    try{current=await this.env.WALLET_SESSIONS.getByName(releaseObjectKey(auth.key)).presenceCurrent(auth.origin,auth.generation);}catch{/* Fail closed, never log private routing state. */}
    if(!current||auth.expiresAt<=Date.now()){this.removePresence(ws,'Wallet identity changed');return false;}
    return ws.readyState===WebSocket.OPEN&&this.state(ws).auth?.generation===auth.generation;
  }
  async revalidateSession(key:string){
    await Promise.all(this.sockets().filter(ws=>this.state(ws).auth?.key===key).map(ws=>this.authenticated(ws,this.state(ws).auth!)));
    await this.scheduleExpiry();
  }
  async socialPeer(actorId:string,peerId:string){
    if(actorId===peerId)return null;
    const find=(id:string)=>this.visibleSockets().find(ws=>{const p=this.state(ws).player;return p.identity?.kind==='wallet'&&p.identity.personId===id;});
    const actor=find(actorId),peer=find(peerId);if(!actor||!peer)return null;
    for(const ws of [actor,peer]){const auth=this.state(ws).auth;if(!auth||!await this.authenticated(ws,auth))return null;}
    if(!this.state(actor).active||!this.state(peer).active)return null;
    const p=this.state(peer).player;return p.identity?.kind==='wallet'?{personId:p.identity.personId,name:p.name,family:p.identity.family}:null;
  }
  private subject(player:Player){return player.identity?.kind==='wallet'?`wallet:${player.identity.personId}`:`guest:${player.id}`;}
  async giftRecipient(input:GiftRecipientRequest):Promise<GiftRecipientResult>{
    const request=giftRecipientRequestSchema.parse(input);
    if(request.target.kind!=='wallet')return {status:'unconfigured'};
    this.expireSessions();
    const matches=(ws:WebSocket)=>{const state=this.state(ws);return state.active&&state.scene===request.scene&&state.player.id===request.connectionId&&giftTargetKey(giftTargetFor(state.player))===giftTargetKey(request.target);};
    const peer=this.visibleSockets().find(matches);if(!peer)return {status:'unpublished'};
    const auth=this.state(peer).auth;if(!auth||!await this.authenticated(peer,auth)||!matches(peer))return {status:'unpublished'};
    using recipient=await this.env.ACCOUNT_PROFILES.getByName(releaseObjectKey(auth.profileKey)).publishedRecipient(request.target);
    // Read-time snapshot, never a transfer authorization. Departure/logout may
    // interleave with the RPC; reject rather than bind to another connection.
    if(peer.readyState!==WebSocket.OPEN||!matches(peer)||this.state(peer).auth?.generation!==auth.generation||auth.expiresAt<=Date.now())return {status:'unpublished'};
    return giftRecipientResultSchema.parse(recipient);
  }
  // Internal RPC only; the same-origin HTTP adapter authenticates and checks
  // the configured wallet allowlist before invoking these room-scoped methods.
  async moderationList(before?:number){this.cleanHistory();await this.scheduleExpiry();return this.safety.list(before);}
  async moderationChange(actor:string,command:ModerationMutation){
    this.cleanHistory();const result=this.safety.change(actor,command);await this.scheduleExpiry();
    if(result.ok){
      if(result.removed)this.broadcast({v:1,type:'chat-removed',id:result.removed});
      if(result.mute)for(const ws of this.visibleSockets())if(this.subject(this.state(ws).player)===result.mute.subject)this.send(ws,{v:1,type:'public-mute',until:this.safety.mutedUntil(result.mute.subject)});
    }
    return result;
  }

  async fetch(request: Request): Promise<Response> {
    const match = parseRoomPath(new URL(request.url).pathname);
    if (!match || !allowedOrigin(request) || request.method !== 'GET') return json({ error: 'Invalid room request' }, 403);
    if (request.headers.get('Upgrade')?.toLowerCase() !== 'websocket') return json({ error: 'WebSocket required' }, 426);
    this.expireSessions();
    let auth:RoomAuth|undefined,identity:Player['identity']={kind:'guest'},appearance={name:'Pilgrim',color:COLORS[0] as typeof COLORS[number]};
    const protocols=request.headers.get('Sec-WebSocket-Protocol')?.split(',').map(p=>p.trim());
    if(showcase&&protocols)return json({error:'Guest visits only during showcase.'},423);
    if(protocols){
      if(protocols.length!==2||protocols[0]!==ROOM_PROTOCOL||!/^ticket\.[0-9a-f]{64}$/.test(protocols[1]))return json({error:'Invalid room identity'},401);
      const key=await sessionRoutingKey(request);if(!key)return json({error:'Wallet session required'},401);
      const origin=request.headers.get('Origin')!;
      const proof=await this.env.WALLET_SESSIONS.getByName(releaseObjectKey(key)).consumeRoomTicket(origin,protocols[1].slice(7),new URL(request.url).pathname,key);
      if(!proof)return json({error:'Room ticket expired or already used'},401);
      const profileKey=await routingHash(proof.session.accountId);
      const saved=await this.env.ACCOUNT_PROFILES.getByName(releaseObjectKey(profileKey)).roomProfile();
      appearance=saved.appearance;identity={kind:'wallet',personId:saved.personId,family:proof.session.family};
      auth={key,generation:proof.generation,origin,expiresAt:proof.session.expiresAt,profileKey};
    }
    // Re-read after cross-object calls: concurrent upgrades also occupy capacity.
    const sockets = this.sockets();
    if (sockets.length >= ROOM_CAPACITY) return json({ error: 'This room is full. Choose another channel.' }, 503);
    const ip = request.headers.get('CF-Connecting-IP') ?? 'local';
    if (sockets.filter(ws => this.state(ws).ip === ip).length >= 6) return json({ error: 'Too many connections from this network' }, 429);
    const scene = match.scene;
    const pair = new WebSocketPair();
    const id = crypto.randomUUID();
    const player: Player = { id, ...appearance, identity, ...spawnPosition(scene,sockets.length), emote: 'none', emoteUntil: 0 };
    this.ctx.acceptWebSocket(pair[1]);
    pair[1].serializeAttachment({ player, scene, lastMove: Date.now(), lastChat: 0, lastEmote: 0, lastProfile: 0, window: Date.now(), count: 0, ip,active:false,...(auth?{auth}:{}) } satisfies Attachment);
    // Register the pending socket before the last async check. A simultaneous
    // logout can now close it, so a late response cannot resurrect old identity.
    if(auth&&!await this.authenticated(pair[1],auth))return json({error:'Wallet identity changed'},401);
    await this.scheduleExpiry();
    if(pair[1].readyState!==WebSocket.OPEN)return json({error:'Room connection closed'},401);
    const admitted=this.state(pair[1]);admitted.active=true;pair[1].serializeAttachment(admitted);
    this.cleanHistory();
    const history = showcase?[]:this.ctx.storage.sql.exec<ChatRow>('SELECT id, sender, name, text, time FROM chat WHERE id NOT IN (SELECT id FROM chat_hidden) ORDER BY time ASC, rowid ASC').toArray();
    this.send(pair[1], { v: 1, type: 'welcome', self: id, players: this.visibleSockets().map(ws => this.state(ws).player), history,reviewConfigured:moderatorAccounts(this.env.MODERATOR_ACCOUNTS).length>0,mutedUntil:this.safety.mutedUntil(this.subject(player)) });
    this.broadcast({ v: 1, type: 'player', player }, pair[1]);
    return new Response(null, { status: 101, webSocket: pair[0],...(auth?{headers:{'Sec-WebSocket-Protocol':ROOM_PROTOCOL}}:{}) });
  }

  async webSocketMessage(ws: WebSocket, raw: string | ArrayBuffer): Promise<void> {
    if (typeof raw !== 'string' || new TextEncoder().encode(raw).byteLength > 18_000) { ws.close(1009, 'Message too large'); return; }
    this.expireSessions();
    let state = this.state(ws);
    if(!state.active||ws.readyState!==WebSocket.OPEN)return;
    const now = Date.now();
    if (now - state.window >= 1000) { state.window = now; state.count = 0; }
    state.count++;
    ws.serializeAttachment(state);
    if (state.count > 24) { ws.close(1008, 'Too many messages'); return; }
    let input: unknown;
    try { input = JSON.parse(raw); } catch { this.send(ws, { v: 1, type: 'error', message: 'Invalid message' }); return; }
    const parsed = clientPacketSchema.safeParse(input);
    if (!parsed.success) { this.send(ws, { v: 1, type: 'error', message: 'Unsupported or invalid message' }); return; }
    const packet = parsed.data;
    // Enforce view/listen-only at the socket too, not just at the UI. Profile
    // handshake is accepted only for the fixed anonymous visitor appearance.
    if(showcase&&!(packet.type==='ping'||packet.type==='move'||packet.type==='posture'||packet.type==='emote'||packet.type==='profile'&&packet.name==='Pilgrim'&&packet.color===COLORS[0])){
      this.send(ws,{v:1,type:'error',message:'Explore and listen. Interaction features are paused.'});return;
    }
    if(packet.type==='voice-invite'||packet.type==='voice-control'||packet.type==='voice-signal'){
      await this.voice.handle(state.player.id,packet);await this.scheduleExpiry();return;
    }
    if(new TextEncoder().encode(raw).byteLength>2048){ws.close(1009,'Message too large');return;}
    if (packet.type === 'ping') { this.send(ws, { v: 1, type: 'pong' }); return; }
    if(state.auth&&(packet.type==='chat'||packet.type==='refresh-profile'||packet.type==='report')){
      if(!await this.authenticated(ws,state.auth))return;
      state=this.state(ws);
    }
    if(packet.type==='report'){
      const network=`network:${await routingHash(state.ip)}`;
      state=this.state(ws);if(!state.active||ws.readyState!==WebSocket.OPEN)return;
      this.cleanHistory();
      const reporter=state.player.identity?.kind==='wallet'?`reporter:${this.subject(state.player)}`:`reporter:${network}`;
      const result=this.safety.report(reporter,network,packet.messageId,packet.reason);await this.scheduleExpiry();
      this.send(ws,{v:1,type:'report-receipt',receipt:{...result,requestId:packet.requestId,reviewConfigured:moderatorAccounts(this.env.MODERATOR_ACCOUNTS).length>0}});return;
    }
    if(packet.type==='refresh-profile'){
      if(!state.auth)return;
      if(now-state.lastProfile<1000)return;
      state.lastProfile=now;ws.serializeAttachment(state);
      let saved;
      try{saved=await this.env.ACCOUNT_PROFILES.getByName(releaseObjectKey(state.auth.profileKey)).roomProfile();}catch{this.send(ws,{v:1,type:'error',message:'Saved appearance is unavailable. Try again shortly.'});return;}
      state=this.state(ws);if(!state.active||ws.readyState!==WebSocket.OPEN)return;
      state.player.name=saved.appearance.name;state.player.color=saved.appearance.color;
      ws.serializeAttachment(state);this.broadcast({v:1,type:'player',player:state.player});return;
    }
    if (packet.type === 'profile') {
      if(state.auth){this.send(ws,{v:1,type:'error',message:'Verified appearance comes from your saved profile.'});return;}
      // Profile edits share the socket rate budget; do not silently discard a
      // user's first edit immediately after the initial profile handshake.
      state.player.name = packet.name;
      state.player.color = packet.color;
      state.lastProfile = now;
    } else if (packet.type === 'move') {
      if (now - state.lastMove < 75) return;
      const allowedDistance = Math.min(80, (now - state.lastMove) * 0.24 + 12);
      if (Math.hypot(packet.x - state.player.x, packet.y - state.player.y) > allowedDistance || !canTravel(state.scene, state.player, packet)) {
        this.send(ws, { v: 1, type: 'player', player: state.player });
        return;
      }
      if(packet.x!==state.player.x||packet.y!==state.player.y)state.player.posture='standing';
      state.player.x = packet.x;
      state.player.y = packet.y;
      state.lastMove = now;
    } else if (packet.type === 'posture') {
      // Explicit public gesture only: never accept faith text in this packet.
      // The existing per-socket budget applies; standing is never cooldown-blocked.
      state.player.posture=packet.posture;
    } else if (packet.type === 'emote') {
      if (now - state.lastEmote < 1500) return;
      state.lastEmote = now;
      state.player.emote = packet.emote;
      state.player.emoteUntil = now + 4500;
    } else if (packet.type === 'chat') {
      const until=this.safety.mutedUntil(this.subject(state.player));
      if(until){this.send(ws,{v:1,type:'public-mute',until});this.send(ws,{v:1,type:'error',message:'Public text chat is temporarily muted in this room. You can still explore.'});return;}
      if (now - state.lastChat < 1200) { this.send(ws, { v: 1, type: 'error', message: 'Take a breath. Please wait a moment between messages.' }); return; }
      state.lastChat = now;
      ws.serializeAttachment(state);
      const message: ChatMessage = { id: crypto.randomUUID(), sender: state.player.id, name: state.player.name, text: packet.text, time: now };
      this.ctx.storage.sql.exec('INSERT INTO chat (id, sender, name, text, time) VALUES (?, ?, ?, ?, ?)', message.id, message.sender, message.name, message.text, now);
      this.safety.author(message.id,this.subject(state.player));
      this.cleanHistory();
      await this.scheduleExpiry();
      // A moderation decision may interleave while the alarm is scheduled.
      if(this.ctx.storage.sql.exec('SELECT id FROM chat WHERE id=? AND id NOT IN (SELECT id FROM chat_hidden)',message.id).toArray().length)this.broadcast({ v: 1, type: 'chat', message });
      return;
    }
    ws.serializeAttachment(state);
    this.broadcast({ v: 1, type: 'player', player: state.player });
  }

  webSocketClose(ws: WebSocket): void {
    this.removePresence(ws);
  }
  webSocketError(ws: WebSocket): void { this.webSocketClose(ws); }
  async alarm(): Promise<void> { this.expireSessions();this.voice.clean();this.cleanHistory(); await this.scheduleExpiry(); }
}
