import {DurableObject} from 'cloudflare:workers';
import {CONTACT_LIMIT,contactSchema,type Contact} from '../shared/social';

// Bounded per-person directory, not an authorization source or message store.
export class SocialInbox extends DurableObject<Env>{
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.blockConcurrencyWhile(async()=>{
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS contacts (peer TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT, time INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rate (kind TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL)');
  });}
  reserve(peer:string){
    this.ctx.storage.sql.exec('DELETE FROM contacts WHERE value IS NULL AND time < ?',Date.now()-24*60*60_000);
    if(this.ctx.storage.sql.exec('SELECT peer FROM contacts WHERE peer=?',peer).toArray().length)return true;
    if(this.ctx.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM contacts').one().n>=CONTACT_LIMIT)return false;
    this.ctx.storage.sql.exec('INSERT INTO contacts VALUES (?,-1,NULL,?)',peer,Date.now());return true;
  }
  allowInvitation(){
    const now=Date.now(),old=this.ctx.storage.sql.exec<{start:number;count:number}>('SELECT start,count FROM rate WHERE kind=?','invite').toArray()[0];
    const next=old&&now-old.start<60*60_000?{...old,count:old.count+1}:{start:now,count:1};
    if(next.count>20)return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rate VALUES (?,?,?)','invite',next.start,next.count);return true;
  }
  publish(input:Contact){
    const contact=contactSchema.parse(input);if(!this.reserve(contact.peer.personId))return false;
    this.ctx.storage.sql.exec('UPDATE contacts SET revision=?,value=?,time=? WHERE peer=? AND revision<=?',contact.revision,JSON.stringify(contact),Date.now(),contact.peer.personId,contact.revision);return true;
  }
  list():Contact[]{return this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM contacts WHERE value IS NOT NULL ORDER BY time DESC LIMIT ?',CONTACT_LIMIT).toArray().map(row=>contactSchema.parse(JSON.parse(row.value)));}
}
