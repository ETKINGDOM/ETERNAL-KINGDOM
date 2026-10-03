import {releaseObjectKey} from './releaseScope';
import { DurableObject } from 'cloudflare:workers';
import { getAddress, hexToBytes, verifyMessage, type Hex } from 'viem';
import { createSiweMessage } from 'viem/siwe';
import { ed25519 } from '@noble/curves/ed25519.js';
import { AUTH_CHALLENGE_TTL, AUTH_SESSION_TTL, AUTH_STATEMENT, walletAccountId, walletSessionSchema, type WalletAccountIdentity, type WalletSession } from '../shared/identity';
import { solanaLoginMessage, solanaPublicKey } from '../shared/solanaIdentity';
import {ROOM_TICKET_TTL,type RoomAdmission} from '../shared/roomIdentity';
import {routingHash} from './sessionRouting';

type Challenge=WalletAccountIdentity&{message:string;expiresAt:number;revision:string;origin:string};
type Session=WalletSession&{origin:string};
type RoomTicket={digest:string;path:string;expiresAt:number;generation:string};
export class WalletSessionStore extends DurableObject<Env>{
  private schemaReady=false;
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    this.ctx.blockConcurrencyWhile(async()=>{
      this.ensureSchema();
    });
  }
  private ensureSchema(){
    if(this.schemaReady)return;
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS auth_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
    this.schemaReady=true;
  }
  private read<T>(key:string):T|null{
    this.ensureSchema();
    const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM auth_state WHERE key = ?',key).toArray()[0];
    // Only this class writes this internal table; no client-controlled JSON is stored.
    return row?JSON.parse(row.value) as T:null;
  }
  private write(key:string,value:unknown){this.ensureSchema();this.ctx.storage.sql.exec('INSERT OR REPLACE INTO auth_state (key,value) VALUES (?,?)',key,JSON.stringify(value));}
  private remove(key:string){this.ensureSchema();this.ctx.storage.sql.exec('DELETE FROM auth_state WHERE key = ?',key);}
  async allow(limit:number){
    const now=Date.now(),old=this.read<{start:number;count:number}>('rate');
    const rate=old&&now-old.start<60_000?old:{start:now,count:0};
    rate.count++;this.write('rate',rate);
    if(!await this.ctx.storage.getAlarm())await this.ctx.storage.setAlarm(now+AUTH_SESSION_TTL);
    return rate.count<=limit;
  }
  async challenge(origin:string,input:WalletAccountIdentity){
    if(!await this.allow(10))return null;
    await this.logout();
    const account:WalletAccountIdentity=input.family==='evm'?{...input,address:getAddress(input.address)}:input;
    const now=Date.now(),expiresAt=now+AUTH_CHALLENGE_TTL;
    const revision=crypto.randomUUID(),nonce=crypto.randomUUID().replaceAll('-','');
    const message=account.family==='evm'?createSiweMessage({address:getAddress(account.address),chainId:account.chainId,domain:new URL(origin).host,uri:origin,version:'1',nonce,
      statement:AUTH_STATEMENT,issuedAt:new Date(now),expirationTime:new Date(expiresAt)}):
      solanaLoginMessage({...account,origin,nonce,statement:AUTH_STATEMENT,issuedAt:new Date(now).toISOString(),expirationTime:new Date(expiresAt).toISOString()});
    this.remove('session');this.write('revision',revision);
    this.write('challenge',{...account,message,expiresAt,revision,origin} satisfies Challenge);
    await this.ctx.storage.setAlarm(expiresAt);
    return {message,expiresAt};
  }
  async verify(origin:string,signature:string):Promise<WalletSession|null>{
    const challenge=this.read<Challenge>('challenge');
    if(!challenge||challenge.origin!==origin||challenge.expiresAt<=Date.now())return null;
    // Consume before asynchronous cryptography. Concurrent replay cannot win.
    this.remove('challenge');
    let valid=false;
    try{
      if(challenge.family==='evm'&&/^0x[0-9a-fA-F]{130}$/.test(signature)){
        valid=await verifyMessage({address:getAddress(challenge.address),message:challenge.message,signature:signature as Hex});
      }else if(challenge.family==='solana'&&/^0x[0-9a-fA-F]{128}$/.test(signature)){
        // Login proof needs strict verification, not permissive consensus rules:
        // reject non-canonical and small-order keys/signatures (including identity).
        valid=ed25519.verify(hexToBytes(signature as Hex),new TextEncoder().encode(challenge.message),solanaPublicKey(challenge.address),{zip215:false});
      }
    }catch{/* Invalid signatures are not logged. */}
    if(!valid||challenge.expiresAt<=Date.now()||this.read<string>('revision')!==challenge.revision)return null;
    const session:Session={...walletSessionSchema.parse({...challenge,accountId:walletAccountId(challenge),expiresAt:Date.now()+AUTH_SESSION_TTL}),origin};
    this.write('session',session);await this.ctx.storage.setAlarm(session.expiresAt);
    return this.publicSession(session);
  }
  current(origin:string):WalletSession|null{
    const session=this.read<Session>('session');
    if(!session||session.origin!==origin||session.expiresAt<=Date.now()||!walletSessionSchema.safeParse(session).success){if(session&&(session.expiresAt<=Date.now()||!('family' in session)))this.remove('session');return null;}
    return this.publicSession(session);
  }
  async roomTicket(origin:string,input:RoomAdmission){
    const session=this.current(origin),generation=this.read<string>('revision');
    if(!session||session.accountId!==input.accountId||session.expiresAt!==input.sessionExpiresAt||!generation)return null;
    const now=Date.now(),rate=this.read<{start:number;count:number}>('room-rate');
    const next=rate&&now-rate.start<60_000?{...rate,count:rate.count+1}:{start:now,count:1};
    if(next.count>30)return null;this.write('room-rate',next);
    const ticket=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-','');
    const digest=await routingHash(ticket);
    if(!this.presenceCurrent(origin,generation))return null;
    const tickets=(this.read<RoomTicket[]>('room-tickets')??[]).filter(t=>t.expiresAt>Date.now()).slice(-7);
    const expiresAt=Math.min(Date.now()+ROOM_TICKET_TTL,session.expiresAt);
    this.write('room-tickets',[...tickets,{digest,path:`/api/rooms/${input.scene}/${input.channel}`,expiresAt,generation}]);
    return {ticket,expiresAt};
  }
  async consumeRoomTicket(origin:string,ticket:string,path:string,sessionKey:string){
    const digest=await routingHash(ticket),tickets=this.read<RoomTicket[]>('room-tickets')??[];
    const found=tickets.find(t=>t.digest===digest);
    this.write('room-tickets',tickets.filter(t=>t.digest!==digest&&t.expiresAt>Date.now()));
    if(!found||found.path!==path||found.expiresAt<=Date.now()||!this.presenceCurrent(origin,found.generation))return null;
    const session=this.current(origin)!;
    // Only allowlisted map/channel paths reach this method: at most 18 entries.
    const registry=this.read<{key:string;rooms:string[]}>('room-registry')??{key:sessionKey,rooms:[]};
    const room=path.slice('/api/rooms/'.length).replace('/',':');
    this.write('room-registry',{key:sessionKey,rooms:[...new Set([...registry.rooms,room])]});
    return {session,generation:found.generation};
  }
  presenceCurrent(origin:string,generation:string){return Boolean(this.current(origin))&&this.read<string>('revision')===generation;}
  async communityTicket(origin:string,input:{accountId:string;sessionExpiresAt:number}){
    const session=this.current(origin),generation=this.read<string>('revision');
    if(!session||session.accountId!==input.accountId||session.expiresAt!==input.sessionExpiresAt||!generation||!await this.allow(30))return null;
    const ticket=crypto.randomUUID().replaceAll('-','')+crypto.randomUUID().replaceAll('-',''),digest=await routingHash(ticket);
    if(!this.presenceCurrent(origin,generation))return null;
    const expiresAt=Math.min(Date.now()+ROOM_TICKET_TTL,session.expiresAt);
    this.write('community-tickets',[...(this.read<RoomTicket[]>('community-tickets')??[]).filter(t=>t.expiresAt>Date.now()).slice(-7),{digest,path:'/api/community',expiresAt,generation}]);
    return {ticket,expiresAt};
  }
  async consumeCommunityTicket(origin:string,ticket:string,sessionKey:string){
    const digest=await routingHash(ticket),tickets=this.read<RoomTicket[]>('community-tickets')??[],found=tickets.find(t=>t.digest===digest);
    this.write('community-tickets',tickets.filter(t=>t.digest!==digest&&t.expiresAt>Date.now()));
    if(!found||found.expiresAt<=Date.now()||!this.presenceCurrent(origin,found.generation))return null;
    this.write('community-registry',sessionKey);
    return {session:this.current(origin)!,generation:found.generation};
  }
  private async revokeRooms(){
    const registry=this.read<{key:string;rooms:string[]}>('room-registry');
    // Keep the registry until expiry, so a failed logout can retry revocation.
    if(registry)await Promise.all(registry.rooms.map(room=>this.env.WORLD_ROOMS.getByName(releaseObjectKey(room)).revalidateSession(registry.key)));
    const community=this.read<string>('community-registry');
    if(community)await this.env.COMMUNITY.getByName(releaseObjectKey('global-v1')).revalidateSession(community);
  }
  async logout(){
    this.remove('session');this.remove('challenge');this.remove('room-tickets');this.remove('community-tickets');this.write('revision',crypto.randomUUID());
    await this.revokeRooms();
  }
  private publicSession(session:Session):WalletSession{
    return walletSessionSchema.parse(session);
  }
  async alarm(){
    const active=this.read<Session>('session')??this.read<Challenge>('challenge');
    if(active&&active.expiresAt>Date.now()){await this.ctx.storage.setAlarm(active.expiresAt);return;}
    this.remove('session');this.remove('challenge');this.remove('room-tickets');
    const generation=crypto.randomUUID();this.write('revision',generation);
    await this.revokeRooms();
    // deleteAll also drops SQL tables without necessarily evicting this instance.
    // Recreate lazily on the next request, leaving idle objects fully empty.
    await this.ctx.blockConcurrencyWhile(async()=>{if(this.read<string>('revision')!==generation)return;await this.ctx.storage.deleteAll();this.schemaReady=false;});
  }
}
