import {socialPairKey,socialRequestSchema,type SocialPeer} from '../shared/social';
import type {WalletSession} from '../shared/identity';
import {routingHash} from './sessionRouting';
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});

export async function socialRequest(body:unknown,session:WalletSession,env:Env):Promise<Response>{
  const parsed=socialRequestSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid social request.'},400);
  const input=parsed.data;
  if(input.accountId!==session.accountId||input.sessionExpiresAt!==session.expiresAt)return json({error:'Wallet session changed. Sign in again.'},403);
  const saved=await env.ACCOUNT_PROFILES.getByName(await routingHash(session.accountId)).roomProfile();
  const actor:SocialPeer={personId:saved.personId,name:saved.appearance.name,family:session.family};
  const inbox=env.SOCIAL_INBOXES.getByName(actor.personId);
  if(input.peerId===actor.personId)return json({error:'Choose another person.'},400);
  if(input.kind==='snapshot'){
    const selected=input.peerId?await env.SOCIAL_PAIRS.getByName(socialPairKey(actor.personId,input.peerId)).read(actor.personId):null;
    return json({self:actor.personId,contacts:await inbox.list(),selected});
  }
  const pair=env.SOCIAL_PAIRS.getByName(socialPairKey(actor.personId,input.peerId));
  let initialPeer:SocialPeer|undefined;
  const inviting=input.kind==='action'&&input.action.startsWith('invite-');
  if(inviting||input.kind==='message'){
    const previous=await pair.read(actor.personId);
    if(previous&&!previous.contact.available)return json({error:'This connection is unavailable.'},403);
    if(!previous){
      if(input.scene&&input.channel)initialPeer=await env.WORLD_ROOMS.getByName(`${input.scene}:${input.channel}`).socialPeer(actor.personId,input.peerId)??undefined;
      if(!initialPeer)return json({error:'This person is not available in your room.'},403);
    }
    const targetInbox=env.SOCIAL_INBOXES.getByName(input.peerId);
    if((inviting||!previous)&&(!await inbox.allowInvitation()||!await targetInbox.allowInvitation()))return json({error:'Connection limit reached. Please try later.'},429);
    if(!await inbox.reserve(input.peerId)||!await targetInbox.reserve(actor.personId))return json({error:'The alpha connection directory is full.'},429);
  }
  const result=await pair.change(actor,input,initialPeer);
  return result.status===200?json(result.conversation):json({error:result.error},result.status);
}
