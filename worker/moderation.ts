import {releaseObjectKey} from './releaseScope';
import {z} from 'zod';
import {accountIdSchema} from '../shared/profile';
import {moderationRequestSchema} from '../shared/moderation';
import type {WalletSession} from '../shared/identity';
import {routingHash} from './sessionRouting';
const accountsSchema=z.array(accountIdSchema).max(20);
export function moderatorAccounts(config:unknown):string[]{
  if(typeof config!=='string'||config.length>2500)return [];
  try{const result=accountsSchema.safeParse(JSON.parse(config));return result.success?result.data:[];}catch{return [];}
}
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export async function moderationRequest(body:unknown,session:WalletSession,env:Env){
  const parsed=moderationRequestSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid moderation request.'},400);
  const input=parsed.data;
  if(input.accountId!==session.accountId||input.sessionExpiresAt!==session.expiresAt)return json({error:'Wallet session changed. Verify again.'},403);
  if(!moderatorAccounts(env.MODERATOR_ACCOUNTS).includes(session.accountId))return json({error:'This verified wallet does not have moderator access. Access must be configured by the project operator.'},403);
  const room=env.WORLD_ROOMS.getByName(releaseObjectKey(`${input.scene}:${input.channel}`));
  if(input.kind==='list')return json(await room.moderationList(input.before));
  const result=await room.moderationChange(await routingHash(session.accountId),input);
  return result.ok?json({ok:true}):json({error:result.error},409);
}
