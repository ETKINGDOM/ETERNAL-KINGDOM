import {releaseObjectKey} from './releaseScope';
import {socialPairKey,socialRequestSchema,type SocialPeer} from '../shared/social';
import {AUTH_SESSION_TTL,type WalletSession} from '../shared/identity';
import {routingHash} from './sessionRouting';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function socialRequest(body:unknown,session:WalletSession,env:Env,friendReminders=false):Promise<Response>{
  const parsed=socialRequestSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid social request.'},400);
  const input=parsed.data;
  // Old open tabs use strict contact schemas. Keep their response shape while
  // current clients opt into a notification version (not an auth permission).
  const reply=(value:unknown)=>json(friendReminders?value:JSON.parse(JSON.stringify(value,(key,value)=>key==='friendRequestRevision'?undefined:value)));
  if(input.accountId!==session.accountId||input.sessionExpiresAt!==session.expiresAt)return json({error:'Wallet session changed. Sign in again.'},403);
  const saved=await env.ACCOUNT_PROFILES.getByName(releaseObjectKey(await routingHash(session.accountId))).roomProfile();
  const actor:SocialPeer={personId:saved.personId,name:saved.appearance.name,family:session.family};
  const inbox=env.SOCIAL_INBOXES.getByName(releaseObjectKey(actor.personId));
  // Derived from the server-verified session, never a client history selector.
  const since=session.expiresAt-AUTH_SESSION_TTL;
  if(input.peerId===actor.personId)return json({error:'Choose another person.'},400);
  if(input.kind==='snapshot'){
    const selected=input.peerId?await env.SOCIAL_PAIRS.getByName(releaseObjectKey(socialPairKey(actor.personId,input.peerId))).read(actor.personId,since):null;
    return reply({self:actor.personId,contacts:await inbox.list(since),selected});
  }
  const pair=env.SOCIAL_PAIRS.getByName(releaseObjectKey(socialPairKey(actor.personId,input.peerId)));
  let initialPeer:SocialPeer|undefined;
  const inviting=input.kind==='action'&&input.action.startsWith('invite-');
  if(inviting||input.kind==='message'){
    const previous=await pair.read(actor.personId);
    if(previous&&!previous.contact.available)return json({error:'This connection is unavailable.'},403);
    if(!previous){
      if(input.scene&&input.channel)initialPeer=await env.WORLD_ROOMS.getByName(releaseObjectKey(`${input.scene}:${input.channel}`)).socialPeer(actor.personId,input.peerId)??undefined;
      if(!initialPeer)return json({error:'This person is not available in your room.'},403);
    }
    const targetInbox=env.SOCIAL_INBOXES.getByName(releaseObjectKey(input.peerId));
    // An established pair reuses one friend-request slot, including after a
    // decline/cancel/remove. Only a new friend target consumes admission quota.
    // General API limits still protect the service; there is no pair cooldown.
    const friendRepeat=input.kind==='action'&&input.action==='invite-friend'&&previous&&((previous.contact.friendRequestRevision??0)>0||previous.contact.friend!=='none');
    if(inviting&&!friendRepeat&&(!await inbox.allowInvitation()||!await targetInbox.allowInvitation()))return json({error:'Too many new invitations. Please try again later.'},429);
    if(input.kind==='message'&&!await inbox.allowMessage())return json({error:'Please pause briefly between messages.'},429);
    const friend=input.kind==='action'&&input.action==='invite-friend';
    if(!await inbox.reserve(input.peerId,friend)||!await targetInbox.reserve(actor.personId,friend))return json({error:friend?'Friend directory is full.':'Recent conversations are temporarily unavailable.'},429);
  }
  const result=await pair.change(actor,input,initialPeer);
  return result.status===200?reply(result.conversation):json({error:result.error},result.status);
}
