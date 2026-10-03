import {DurableObject} from 'cloudflare:workers';
import {CONTACT_LIMIT,FRIEND_LIMIT,contactSchema,type Contact} from '../shared/social';

// Bounded per-person directory, not an authorization source or message store.
export class SocialInbox extends DurableObject<Env>{
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.blockConcurrencyWhile(async()=>{
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS contacts (peer TEXT PRIMARY KEY, revision INTEGER NOT NULL, value TEXT, time INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS friend_slots (peer TEXT PRIMARY KEY,time INTEGER NOT NULL)');
    // Additive side table: old Workers still read/write the unchanged contacts
    // table and strict legacy JSON after a rollback or an old-tab request.
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS friend_reminders (peer TEXT PRIMARY KEY,version INTEGER NOT NULL)');
    this.ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS rate (kind TEXT PRIMARY KEY, start INTEGER NOT NULL, count INTEGER NOT NULL)');
  });}
  reserve(peer:string,friend=false){
    this.ctx.storage.sql.exec('DELETE FROM contacts WHERE value IS NULL AND time < ?',Date.now()-24*60*60_000);
    this.ctx.storage.sql.exec('DELETE FROM friend_slots WHERE time < ?',Date.now()-24*60*60_000);
    this.ctx.storage.sql.exec('DELETE FROM friend_reminders WHERE peer NOT IN (SELECT peer FROM contacts)');
    const existing=this.ctx.storage.sql.exec<{value:string|null}>('SELECT value FROM contacts WHERE peer=?',peer).toArray()[0];
    if(friend){
      const owned=existing?.value&&contactSchema.parse(JSON.parse(existing.value)).friend!=='none'||this.ctx.storage.sql.exec('SELECT peer FROM friend_slots WHERE peer=?',peer).toArray().length>0;
      if(!owned&&this.ctx.storage.sql.exec<{n:number}>("SELECT COUNT(*) AS n FROM (SELECT peer FROM friend_slots UNION SELECT peer FROM contacts WHERE value IS NOT NULL AND json_extract(value,'$.friend')!='none')").one().n>=FRIEND_LIMIT)return false;
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO friend_slots VALUES (?,?)',peer,Date.now());
    }
    if(existing)return true;
    // Recycle only a non-friend directory entry; the pair remains independent.
    // Friends never occupy all recent-chat slots or prevent a new direct chat.
    if(this.ctx.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM contacts').one().n>=CONTACT_LIMIT){
      const removable=this.ctx.storage.sql.exec<{peer:string}>("SELECT peer FROM contacts WHERE (value IS NULL OR json_extract(value,'$.friend')='none') AND peer NOT IN (SELECT peer FROM friend_slots) ORDER BY time ASC,peer ASC LIMIT 1").toArray()[0];
      if(!removable)return false;
      this.ctx.storage.sql.exec('DELETE FROM contacts WHERE peer=?',removable.peer);
      this.ctx.storage.sql.exec('DELETE FROM friend_reminders WHERE peer=?',removable.peer);
    }
    this.ctx.storage.sql.exec('INSERT INTO contacts VALUES (?,-1,NULL,?)',peer,Date.now());return true;
  }
  allowInvitation(){
    const now=Date.now(),old=this.ctx.storage.sql.exec<{start:number;count:number}>('SELECT start,count FROM rate WHERE kind=?','invite').toArray()[0];
    const next=old&&now-old.start<60*60_000?{...old,count:old.count+1}:{start:now,count:1};
    if(next.count>20)return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rate VALUES (?,?,?)','invite',next.start,next.count);return true;
  }
  allowMessage(){
    const now=Date.now(),old=this.ctx.storage.sql.exec<{start:number;count:number}>('SELECT start,count FROM rate WHERE kind=?','message').toArray()[0];
    const next=old&&now-old.start<60_000?{...old,count:old.count+1}:{start:now,count:1};
    if(next.count>60)return false;
    this.ctx.storage.sql.exec('INSERT OR REPLACE INTO rate VALUES (?,?,?)','message',next.start,next.count);return true;
  }
  publish(input:Contact){
    const contact=contactSchema.parse(input),peer=contact.peer.personId;
    const current=this.ctx.storage.sql.exec<{revision:number}>('SELECT revision FROM contacts WHERE peer=?',peer).toArray()[0];
    if(current&&current.revision>contact.revision)return true;
    if(!this.reserve(peer,contact.friend!=='none'))return false;
    const {friendRequestRevision,...legacyContact}=contact;
    this.ctx.storage.sql.exec('UPDATE contacts SET revision=?,value=?,time=? WHERE peer=? AND revision<=?',contact.revision,JSON.stringify(legacyContact),Date.now(),peer,contact.revision);
    if(friendRequestRevision!==undefined)this.ctx.storage.sql.exec('INSERT OR REPLACE INTO friend_reminders VALUES (?,?)',peer,friendRequestRevision);
    this.ctx.storage.sql.exec('DELETE FROM friend_slots WHERE peer=?',peer);return true;
  }
  list(since=0):Contact[]{return this.ctx.storage.sql.exec<{value:string;version:number}>("SELECT c.value,COALESCE(r.version,0) AS version FROM contacts c LEFT JOIN friend_reminders r ON r.peer=c.peer WHERE c.value IS NOT NULL AND (json_extract(c.value,'$.friend')!='none' OR json_extract(c.value,'$.blocked')=1 OR json_extract(c.value,'$.updatedAt')>=?) ORDER BY c.time DESC LIMIT ?",since,CONTACT_LIMIT).toArray().map(row=>contactSchema.parse({...JSON.parse(row.value),friendRequestRevision:row.version}));}
}
