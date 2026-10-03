import {releaseObjectKey} from './releaseScope';
import { z } from 'zod';
import { AUTH_SESSION_TTL, walletAccountSchema } from '../shared/identity';
import { profileMutationSchema, profileReadSchema } from '../shared/profile';
import {roomAdmissionSchema} from '../shared/roomIdentity';
import {routingHash as hash,sessionToken} from './sessionRouting';
import {socialRequest} from './social';
import {FRIEND_REMINDER_HEADER} from '../shared/social';
import {moderationRequest} from './moderation';
import {giftRecipientRequestSchema} from '../shared/gifts';
import {lampRequestSchema} from '../shared/dailyLamp';
import {communityAdmissionSchema} from '../shared/community';

// Keep the previous local EVM request shape compatible; all new clients send family.
const beginSchema=z.preprocess(value=>typeof value==='object'&&value!==null&&!('family' in value)?{...value,family:'evm'}:value,walletAccountSchema);
const proofSchema=z.object({signature:z.string().regex(/^0x(?:[0-9a-fA-F]{128}|[0-9a-fA-F]{130})$/)}).strict();
const json=(data:unknown,status=200,cookie?:string)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...(cookie?{'Set-Cookie':cookie}:{})}});
async function boundedJson(request:Request):Promise<unknown>{
  if(!request.headers.get('Content-Type')?.startsWith('application/json'))throw new Error('Invalid body');
  const reader=request.body?.getReader();if(!reader)return {};
  const chunks:Uint8Array[]=[];let size=0;
  try{while(true){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>2048){await reader.cancel();throw new Error('Invalid body');}chunks.push(part.value);}}
  finally{reader.releaseLock();}
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
  return JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(bytes));
}
export async function authRequest(request:Request,env:Env):Promise<Response>{
  if(request.method!=='POST')return json({error:'Method not allowed'},405);
  // The router verifies Origin before calling us. All operations, including
  // session lookup and logout, require a same-origin JSON POST (no CORS).
  const origin=request.headers.get('Origin')!,path=new URL(request.url).pathname;
  const profileRoute=path==='/api/auth/profile'||path==='/api/auth/profile/save';
  const roomRoute=path==='/api/auth/room-ticket';
  const socialRoute=path==='/api/auth/social';
  const moderationRoute=path==='/api/auth/moderation';
  const giftReadRoute=path==='/api/auth/gift-recipient';
  const lampRoute=path==='/api/auth/lamp'||path==='/api/auth/lamp/light';
  const communityRoute=path==='/api/auth/community-ticket';
  if(!profileRoute&&!roomRoute&&!socialRoute&&!moderationRoute&&!giftReadRoute&&!lampRoute&&!communityRoute&&!['/api/auth/challenge','/api/auth/verify','/api/auth/session','/api/auth/logout'].includes(path))return json({error:'Not found'},404);
  const secure=new URL(origin).protocol==='https:',cookieName=secure?'__Host-ek-session':'ek-local-session';
  if(!secure&&!['localhost','127.0.0.1'].includes(new URL(origin).hostname))return json({error:'HTTPS is required'},403);
  const limiter=env.WALLET_SESSIONS.getByName(releaseObjectKey(`rate:${await hash(request.headers.get('CF-Connecting-IP')??'local')}`));
  if(!await limiter.allow(120))return json({error:'Please wait before trying again'},429);
  let body:unknown;try{body=await boundedJson(request);}catch{return json({error:'Invalid request'},400);}
  if(giftReadRoute){
    const parsed=giftRecipientRequestSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid recipient request'},400);
    const giftLimiter=env.WALLET_SESSIONS.getByName(releaseObjectKey(`gift-rate:${await hash(request.headers.get('CF-Connecting-IP')??'local')}`));
    if(!await giftLimiter.allow(30))return json({error:'Please wait before checking another recipient'},429);
    if(parsed.data.target.kind==='guest')return json({recipient:{status:'unconfigured'}});
    using recipient=await env.WORLD_ROOMS.getByName(releaseObjectKey(`${parsed.data.scene}:${parsed.data.channel}`)).giftRecipient(parsed.data);
    return json({recipient});
  }
  const token=sessionToken(request);
  const cookie=(value:string,age:number)=>`${cookieName}=${value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
  if(path==='/api/auth/challenge'){
    const parsed=beginSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid wallet account or network'},400);
    const nextToken=token??Array.from(crypto.getRandomValues(new Uint8Array(32)),b=>b.toString(16).padStart(2,'0')).join('');
    const result=await env.WALLET_SESSIONS.getByName(releaseObjectKey(`browser:${await hash(nextToken)}`)).challenge(origin,parsed.data);
    return result?json(result,200,cookie(nextToken,AUTH_SESSION_TTL/1000)):json({error:'Please wait before requesting another login'},429);
  }
  if(!token)return path==='/api/auth/verify'||profileRoute||roomRoute||socialRoute||moderationRoute||lampRoute||communityRoute?json({error:'Please verify your wallet.'},401):json({session:null},200,path.endsWith('logout')?cookie('',0):undefined);
  const store=env.WALLET_SESSIONS.getByName(releaseObjectKey(`browser:${await hash(token)}`));
  if(path==='/api/auth/logout'){await store.logout();return json({session:null},200,cookie('',0));}
  if(path==='/api/auth/session')return json({session:await store.current(origin)});
  if(communityRoute){
    const input=communityAdmissionSchema.safeParse(body);if(!input.success)return json({error:'Invalid community request.'},400);
    const ticket=await store.communityTicket(origin,input.data);return ticket?json(ticket):json({error:'Community identity unavailable.'},403);
  }
  if(lampRoute){
    const session=await store.current(origin);if(!session)return json({error:'Please verify your wallet.'},401);
    const input=lampRequestSchema.safeParse(body);if(!input.success)return json({error:'Invalid lamp request.'},400);
    if(input.data.accountId!==session.accountId||input.data.sessionExpiresAt!==session.expiresAt)return json({error:'Wallet session changed.'},403);
    const profile=env.ACCOUNT_PROFILES.getByName(releaseObjectKey(await hash(session.accountId)));
    const lamp=path.endsWith('/light')?await profile.lightLamp(session.accountId):await profile.readLamp(session.accountId);
    return json({lamp});
  }
  if(moderationRoute){const session=await store.current(origin);return session?moderationRequest(body,session,env):json({error:'Please verify your wallet.'},401);}
  if(socialRoute){const session=await store.current(origin);return session?socialRequest(body,session,env,request.headers.get(FRIEND_REMINDER_HEADER)==='1'):json({error:'Please verify your wallet.'},401);}
  if(roomRoute){
    const parsed=roomAdmissionSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid room request'},400);
    const ticket=await store.roomTicket(origin,parsed.data);
    return ticket?json(ticket):json({error:'Room identity could not be confirmed. Verify your wallet again or wait before retrying.'},403);
  }
  if(profileRoute){
    const session=await store.current(origin);if(!session)return json({error:'Please verify your wallet.'},401);
    if(path==='/api/auth/profile'){
      const parsed=profileReadSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid profile request'},400);
      // The body is a stale-tab guard, never an authorization source.
      if(parsed.data.accountId!==session.accountId)return json({error:'Wallet session changed'},403);
      const profile=await env.ACCOUNT_PROFILES.getByName(releaseObjectKey(await hash(session.accountId))).readProfile(session.accountId);
      return json({profile});
    }
    const parsed=profileMutationSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid profile change or missing confirmation'},400);
    if(parsed.data.accountId!==session.accountId)return json({error:'Wallet session changed'},403);
    const result=await env.ACCOUNT_PROFILES.getByName(releaseObjectKey(await hash(session.accountId))).saveProfile(parsed.data);
    if(result.status==='conflict')return json({error:'Profile changed. Reload before saving.'},409);
    if(result.status==='rate-limited')return json({error:'Please wait before saving again'},429);
    return json({profile:result.profile});
  }
  const parsed=proofSchema.safeParse(body);if(!parsed.success)return json({error:'Invalid login signature'},400);
  const session=await store.verify(origin,parsed.data.signature);
  return session?json({session},200,cookie(token,AUTH_SESSION_TTL/1000)):json({error:'Signature was not accepted. Request a new login challenge.'},401);
}
