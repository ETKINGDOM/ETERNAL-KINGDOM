import { DurableObject } from 'cloudflare:workers';
import { accountProfileSchema, DEFAULT_APPEARANCE, emptyAccountProfile, withDefaultEvmRecipient, profileMutationSchema, type AccountProfile, type ProfileMutation, type ProfileSaveResult } from '../shared/profile';
import { giftTargetSchema,type GiftTarget,type GiftRecipientResult } from '../shared/gifts';
import {emptyLamp,lampStateSchema,lampSnapshot,lightDailyLamp,type LampState} from '../shared/dailyLamp';

// One object per authenticated account. Independent of expiring browser sessions;
// no expiry alarm may erase a saved profile when the wallet signs out.
export class AccountProfileStore extends DurableObject<Env>{
  constructor(ctx:DurableObjectState,env:Env){
    super(ctx,env);
    this.ctx.blockConcurrencyWhile(async()=>{
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS profile (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS write_rate (id INTEGER PRIMARY KEY CHECK (id = 1), start INTEGER NOT NULL, count INTEGER NOT NULL)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS public_identity (id INTEGER PRIMARY KEY CHECK (id = 1), person TEXT NOT NULL)');
      this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS daily_lamp (id INTEGER PRIMARY KEY CHECK (id = 1), value TEXT NOT NULL)');
    });
  }
  private lampState():LampState{
    const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM daily_lamp WHERE id=1').toArray()[0];
    return row?lampStateSchema.parse(JSON.parse(row.value)):emptyLamp();
  }
  readLamp(accountId:string){return lampSnapshot(accountId,this.lampState(),Date.now());}
  lightLamp(accountId:string){
    return this.ctx.storage.transactionSync(()=>{
      const now=Date.now(),old=this.lampState(),next=lightDailyLamp(old,now);
      if(next.total!==old.total)this.ctx.storage.sql.exec('INSERT OR REPLACE INTO daily_lamp VALUES (1,?)',JSON.stringify(next));
      return lampSnapshot(accountId,next,now);
    });
  }
  roomProfile(){
    // Random, persistent public reference, never a wallet-address digest.
    let personId=this.ctx.storage.sql.exec<{person:string}>('SELECT person FROM public_identity WHERE id = 1').toArray()[0]?.person;
    if(!personId){personId=crypto.randomUUID();this.ctx.storage.sql.exec('INSERT INTO public_identity VALUES (1,?)',personId);}
    const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM profile WHERE id = 1').toArray()[0];
    return {personId,appearance:row?accountProfileSchema.parse(JSON.parse(row.value)).appearance:{...DEFAULT_APPEARANCE}};
  }
  readProfile(accountId:string):AccountProfile{
    const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM profile WHERE id = 1').toArray()[0];
    if(!row)return withDefaultEvmRecipient(emptyAccountProfile(accountId));
    const profile=accountProfileSchema.parse(JSON.parse(row.value));
    if(profile.accountId!==accountId)throw new Error('Profile routing mismatch');
    return withDefaultEvmRecipient(profile);
  }
  saveProfile(input:ProfileMutation):ProfileSaveResult{
    const change=profileMutationSchema.parse(input);
    return this.ctx.storage.transactionSync(()=>{
      const now=Date.now(),old=this.ctx.storage.sql.exec<{start:number;count:number}>('SELECT start, count FROM write_rate WHERE id = 1').toArray()[0];
      const rate=old&&now-old.start<60_000?{...old,count:old.count+1}:{start:now,count:1};
      if(rate.count>20)return {status:'rate-limited'};
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO write_rate (id,start,count) VALUES (1,?,?)',rate.start,rate.count);
      const current=this.readProfile(change.accountId);
      if(current.revision!==change.expectedRevision)return {status:'conflict'};
      if(change.kind==='gift-publication'&&change.mode==='published'&&(!current.evmRecipient||current.evmRecipient.address!==change.address))return {status:'conflict'};
      const profile:AccountProfile=withDefaultEvmRecipient({...current,revision:current.revision+1,updatedAt:now,
        ...(change.kind==='appearance'?{appearance:change.appearance}:change.kind==='recipient'?{evmRecipient:change.address?{address:change.address,ownershipVerified:false as const}:null,giftPublication:'private' as const}:{giftPublication:change.mode}),
      });
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO profile (id,value) VALUES (1,?)',JSON.stringify(profile));
      return {status:'saved',profile};
    });
  }
  publishedRecipient(input:GiftTarget):GiftRecipientResult{
    const target=giftTargetSchema.parse(input);
    const person=this.ctx.storage.sql.exec<{person:string}>('SELECT person FROM public_identity WHERE id = 1').toArray()[0]?.person;
    if(target.kind!=='wallet'||target.personId!==person)return {status:'unpublished'};
    const row=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM profile WHERE id = 1').toArray()[0];
    if(!row)return {status:'unpublished'};
    const profile=withDefaultEvmRecipient(accountProfileSchema.parse(JSON.parse(row.value)));
    if(!profile.accountId.startsWith(`${target.family}:`))return {status:'unpublished'};
    if(profile.giftPublication==='disabled')return {status:'disabled'};
    if(profile.giftPublication!=='published'||!profile.evmRecipient)return {status:'unpublished'};
    return {status:'available',target,address:profile.evmRecipient.address,revision:String(profile.revision),ownershipVerified:false};
  }
}
