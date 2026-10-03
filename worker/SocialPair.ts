import {releaseObjectKey} from './releaseScope';
import {DurableObject} from 'cloudflare:workers';
import {INVITE_TTL,PRIVATE_LIMIT,PRIVATE_TTL,type SocialPeer,type Contact,type Conversation,type PairCommand,type PrivateMessage} from '../shared/social';
import {AUTH_SESSION_TTL} from '../shared/identity';

type Consent={status:'none'|'pending'|'accepted';by:string;expiresAt:number;cooldown:number;cooldownKind?:'declined'};
type State={members:[SocialPeer,SocialPeer];revision:number;friend:Consent;friendRequestRevision?:number;chat:Consent;blocks:string[];updatedAt:number;dirty:boolean};
const empty=():Consent=>({status:'none',by:'',expiresAt:0,cooldown:0});
type Result={status:200;conversation:Conversation}|{status:403|409|429;error:string};

// One serialization boundary per pair: consent, block, and text permissions
// change atomically, with no cross-object await inside the decision/write.
export class SocialPair extends DurableObject<Env>{
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.blockConcurrencyWhile(async()=>{
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS pair (id INTEGER PRIMARY KEY CHECK(id=1),value TEXT NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS messages (id TEXT PRIMARY KEY, clientId TEXT NOT NULL, sender TEXT NOT NULL, text TEXT NOT NULL, time INTEGER NOT NULL, UNIQUE(sender,clientId))');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rate (sender TEXT PRIMARY KEY,time INTEGER NOT NULL)');
  });}
  private load():State|null{const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM pair WHERE id=1').toArray()[0];return row?JSON.parse(row.value) as State:null;}
  // Internal room RPC: friendship/text acceptance never authorizes voice.
  // A pair that has never used social features has no block to bypass.
  async voiceAllowed(actor:string,peer:string):Promise<boolean>{const s=this.load();return actor!==peer&&(!s||s.blocks.length===0&&s.members.some(m=>m.personId===actor)&&s.members.some(m=>m.personId===peer));}
  private write(s:State){this.ctx.storage.sql.exec('INSERT OR REPLACE INTO pair VALUES (1,?)',JSON.stringify(s));}
  private friendRequestRevision(s:State){return s.friendRequestRevision??0;}
  private update(s:State,actor:SocialPeer){
    s.members=s.members.map(m=>m.personId===actor.personId?actor:m) as [SocialPeer,SocialPeer];
    s.revision++;s.updatedAt=Date.now();s.dirty=true;this.write(s);
  }
  private clean(){
    this.ctx.storage.sql.exec('DELETE FROM messages WHERE time<=?',Date.now()-PRIVATE_TTL);
    this.ctx.storage.sql.exec('DELETE FROM messages WHERE id NOT IN (SELECT id FROM messages ORDER BY time DESC,rowid DESC LIMIT ?)',PRIVATE_LIMIT);
    const s=this.load();if(!s)return;
    let changed=false;for(const kind of ['friend','chat'] as const)if(s[kind].status==='pending'&&s[kind].expiresAt<=Date.now()){s[kind]=empty();changed=true;}
    if(changed){s.revision++;s.updatedAt=Date.now();s.dirty=true;this.write(s);}
  }
  private contact(s:State,actor:string):Contact{
    const peer=s.members.find(m=>m.personId!==actor)!;const available=s.blocks.length===0;
    return {peer,revision:s.revision,friend:!available?'none':s.friend.status==='accepted'?'friends':s.friend.status==='pending'?(s.friend.by===actor?'outgoing':'incoming'):'none',friendRequestRevision:this.friendRequestRevision(s),chat:available?'open':'closed',blocked:s.blocks.includes(actor),available,updatedAt:s.updatedAt};
  }
  private view(s:State,actor:string,since=0):Conversation{
    const contact=this.contact(s,actor);
    const messages=contact.available&&contact.chat==='open'?this.ctx.storage.sql.exec<PrivateMessage>('SELECT id,clientId,sender,text,time FROM messages WHERE time>=? ORDER BY time ASC,rowid ASC',since).toArray():[];
    return {contact,messages,syncPending:s.dirty};
  }
  private async schedule(){
    const s=this.load();if(!s)return;
    const first=this.ctx.storage.sql.exec<{time:number}>('SELECT time FROM messages ORDER BY time ASC LIMIT 1').toArray()[0];
    const due=[...(s.dirty?[Date.now()+60_000]:[]),...(first?[first.time+PRIVATE_TTL]:[]),...[s.friend,s.chat].filter(c=>c.status==='pending').map(c=>c.expiresAt)];
    if(due.length)await this.ctx.storage.setAlarm(Math.min(...due));else await this.ctx.storage.deleteAlarm();
  }
  private async sync(){
    const s=this.load();if(!s?.dirty)return;
    try{
      const ok=await Promise.all(s.members.map(m=>this.env.SOCIAL_INBOXES.getByName(releaseObjectKey(m.personId)).publish(this.contact(s,m.personId))));
      const latest=this.load();if(ok.every(Boolean)&&latest?.revision===s.revision){latest.dirty=false;this.write(latest);}
    }catch{/* Durable dirty marker retries without recording contacts or text. */}
  }
  async read(actor:string,since=0):Promise<Conversation|null>{
    this.clean();const s=this.load();if(!s||!s.members.some(m=>m.personId===actor))return null;
    await this.schedule();return this.view(this.load()!,actor,since);
  }
  async change(actor:SocialPeer,command:PairCommand,initialPeer?:SocialPeer):Promise<Result>{
    this.clean();
    const result=this.ctx.storage.transactionSync(():Result=>{
      let s=this.load();const id=actor.personId,now=Date.now();
      if(!s){
        if((command.kind==='action'&&!['invite-friend','invite-chat'].includes(command.action))||!initialPeer||initialPeer.personId===id||initialPeer.personId!==command.peerId)return {status:403,error:'This person is not available in your room.'};
        s={members:[actor,initialPeer],revision:0,friend:empty(),chat:empty(),blocks:[],updatedAt:now,dirty:false};
      }
      if(!s.members.some(m=>m.personId===id)||!s.members.some(m=>m.personId===command.peerId)||id===command.peerId)return {status:403,error:'Conversation unavailable.'};
      // Legacy pairs and inbox rows both start at reminder version zero. Chat
      // writes must not invent a reminder or make a legacy reapply conflict.
      s.friendRequestRevision=this.friendRequestRevision(s);
      if(command.kind==='message'){
        // A private message requires neither friendship nor text consent. The
        // pair and saved blocks remain authoritative; directory revisions are
        // not chat permissions and cannot make simultaneous replies conflict.
        if(s.blocks.length)return {status:409,error:'This connection is unavailable.'};
        const existing=this.ctx.storage.sql.exec<PrivateMessage>('SELECT id,clientId,sender,text,time FROM messages WHERE sender=? AND clientId=?',id,command.clientId).toArray()[0];
        if(existing)return existing.text===command.text?{status:200,conversation:this.view(s,id)}:{status:409,error:'This message identifier was already used. Refresh before continuing.'};
        const last=this.ctx.storage.sql.exec<{time:number}>('SELECT time FROM rate WHERE sender=?',id).toArray()[0];
        if(last&&now-last.time<1500)return {status:429,error:'Please pause briefly between messages.'};
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rate VALUES (?,?)',id,now);
        this.ctx.storage.sql.exec('INSERT INTO messages VALUES (?,?,?,?,?)',crypto.randomUUID(),command.clientId,id,command.text,now);
        s.chat={...empty(),status:'accepted'};this.update(s,actor);this.clean();
        return {status:200,conversation:this.view(s,id)};
      }
      const action=command.action;
      if(action==='invite-friend'&&!s.blocks.length){
        if(s.friend.status==='accepted')return {status:200,conversation:this.view(s,id)};
        if(s.friend.status==='pending'&&s.friend.by===id){
          // A stale HTTP retry reads the same request. A fresh explicit click
          // re-shows that one request without another row or self-acceptance.
          const fresh=command.expectedFriendRequestRevision===undefined?command.expectedRevision===s.revision:command.expectedFriendRequestRevision===s.friendRequestRevision;
          if(!fresh)return {status:200,conversation:this.view(s,id)};
          s.friendRequestRevision++;s.friend.expiresAt=now+INVITE_TTL;
          this.update(s,actor);return {status:200,conversation:this.view(s,id)};
        }
      }
      // Blocking always revokes, even from a stale tab; acceptance never does.
      const freshFriendInvite=action==='invite-friend'&&command.expectedFriendRequestRevision!==undefined&&command.expectedFriendRequestRevision===s.friendRequestRevision;
      if(action==='invite-friend'&&command.expectedFriendRequestRevision!==undefined&&!freshFriendInvite)return {status:409,error:'This friend request changed. Refresh friends and try again.'};
      if(action!=='block'&&command.expectedRevision!==s.revision&&!freshFriendInvite)return {status:409,error:'This connection changed. Refresh and review it again.'};
      if(action==='block'){
        s.blocks=[...new Set([...s.blocks,id])];s.friend=empty();s.chat=empty();this.ctx.storage.sql.exec('DELETE FROM messages');
      }else if(action==='unblock'){
        if(!s.blocks.includes(id))return {status:409,error:'There is no block from your account to remove.'};
        s.blocks=s.blocks.filter(x=>x!==id);s.friend=empty();s.chat=empty();
      }else{
        if(s.blocks.length)return {status:403,error:'This connection is unavailable.'};
        const kind=action.endsWith('friend')?'friend':'chat',consent=s[kind];
        if(action.startsWith('invite-')){
          if(consent.status!=='none')return {status:409,error:'An invitation or permission already exists. Refresh first.'};
          // Friendship has no decline/cancel/remove cooldown, including legacy
          // saved values. The retained text-consent interface is independent.
          if(kind==='chat'&&consent.cooldown>now)return {status:429,error:'Please wait a day before sending another invitation of this kind.'};
          if(kind==='friend')s.friendRequestRevision++;
          s[kind]={status:'pending',by:id,expiresAt:now+INVITE_TTL,cooldown:0};
        }else if(action.startsWith('accept-')){
          if(consent.status!=='pending'||consent.by===id||consent.expiresAt<=now)return {status:409,error:'There is no incoming invitation to accept.'};
          s[kind]={...consent,status:'accepted',expiresAt:0};
        }else if(action.startsWith('decline-')||action.startsWith('cancel-')){
          if(consent.status!=='pending'||(action.startsWith('decline-')?consent.by===id:consent.by!==id))return {status:409,error:'This invitation can no longer be changed.'};
          s[kind]=kind==='friend'?empty():{...empty(),cooldown:now+PRIVATE_TTL};
        }else{
          if(action==='remove-friend'&&s.friend.status!=='accepted'||action==='close-chat'&&s.chat.status!=='accepted')return {status:409,error:'This permission is no longer open.'};
          if(action==='remove-friend')s.friend=empty();
          else {s.chat={...empty(),cooldown:now+PRIVATE_TTL};this.ctx.storage.sql.exec('DELETE FROM messages');}
        }
      }
      this.update(s,actor);
      return {status:200,conversation:this.view(s,id)};
    });
    // Arm the durable retry before cross-object publication. The pair remains
    // authoritative if one inbox is temporarily unavailable or out of date.
    await this.schedule();await this.sync();await this.schedule();
      if(result.status===200){const latest=this.load()!;this.ctx.waitUntil(this.env.COMMUNITY.getByName(releaseObjectKey('global-v1')).notifySocial(latest.members.map(m=>m.personId)).catch(()=>{}));return {status:200,conversation:this.view(latest,actor.personId,command.sessionExpiresAt-AUTH_SESSION_TTL)};}return result;
  }
  async alarm(){this.clean();await this.sync();await this.schedule();}
}
