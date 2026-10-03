import type {ChatMessage} from '../shared/protocol';
import {MUTE_MS,REVIEW_TTL,type ReportReason,type ReportReceipt} from '../shared/reporting';
import type {ModerationMutation,ModerationSnapshot,ReviewReport,RoomMute} from '../shared/moderation';

type ReportRow={id:string;sequence:number;message:string;subject:string;reason:ReportReason;createdAt:number;revision:number;outcome:ReviewReport['outcome']};
type Result={ok:true;removed?:string;mute?:{subject:string;until:number}}|{ok:false;error:string};
// Synchronous room-local storage: no external I/O inside report or review decisions.
// Reporter references, IP hashes and evidence never enter public packets or logs.
export class RoomSafety{
  constructor(private storage:DurableObjectStorage){}
  initialize(){
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS chat_subjects (id TEXT PRIMARY KEY, subject TEXT NOT NULL)');
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS chat_hidden (id TEXT PRIMARY KEY)');
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS moderation_reports (sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE NOT NULL, reporter TEXT NOT NULL, messageId TEXT NOT NULL, message TEXT NOT NULL, subject TEXT NOT NULL, reason TEXT NOT NULL, createdAt INTEGER NOT NULL, revision INTEGER NOT NULL DEFAULT 0, outcome TEXT NOT NULL DEFAULT \'open\', UNIQUE(reporter,messageId))');
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS moderation_rate (id TEXT PRIMARY KEY,start INTEGER NOT NULL,count INTEGER NOT NULL)');
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS moderation_mutes (subject TEXT PRIMARY KEY,name TEXT NOT NULL,until INTEGER NOT NULL,kind TEXT NOT NULL)');
    this.storage.sql.exec('CREATE TABLE IF NOT EXISTS moderation_audit (id TEXT PRIMARY KEY,actor TEXT NOT NULL,action TEXT NOT NULL,reportId TEXT,time INTEGER NOT NULL)');
  }
  clean(){
    this.storage.sql.exec('DELETE FROM chat_subjects WHERE id NOT IN (SELECT id FROM chat)');
    this.storage.sql.exec('DELETE FROM chat_hidden WHERE id NOT IN (SELECT id FROM chat)');
    this.storage.sql.exec('DELETE FROM moderation_reports WHERE createdAt<=?',Date.now()-REVIEW_TTL);
    this.storage.sql.exec('DELETE FROM moderation_audit WHERE time<=?',Date.now()-REVIEW_TTL);
    this.storage.sql.exec('DELETE FROM moderation_audit WHERE id NOT IN (SELECT id FROM moderation_audit ORDER BY time DESC,rowid DESC LIMIT 1000)');
    this.storage.sql.exec('DELETE FROM moderation_rate WHERE start<=?',Date.now()-10*60_000);
    this.storage.sql.exec('DELETE FROM moderation_mutes WHERE until<=?',Date.now());
  }
  nextExpiry():number[]{
    return ['SELECT MIN(createdAt)+? AS due FROM moderation_reports','SELECT MIN(time)+? AS due FROM moderation_audit','SELECT MIN(start)+? AS due FROM moderation_rate','SELECT MIN(until) AS due FROM moderation_mutes'].flatMap((q,i)=>{const row=this.storage.sql.exec<{due:number|null}>(q,...(i<3?[i===2?10*60_000:REVIEW_TTL]:[])).one();return row.due===null?[]:[row.due];});
  }
  author(messageId:string,subject:string){this.storage.sql.exec('INSERT INTO chat_subjects VALUES (?,?)',messageId,subject);}
  mutedUntil(subject:string){return this.storage.sql.exec<{until:number}>('SELECT until FROM moderation_mutes WHERE subject=? AND until>?',subject,Date.now()).toArray()[0]?.until??0;}
  hidden(messageId:string){return this.storage.sql.exec('SELECT id FROM chat_hidden WHERE id=?',messageId).toArray().length>0;}
  report(reporter:string,network:string,messageId:string,reason:ReportReason):Pick<ReportReceipt,'status'|'reportId'>{
    this.clean();
    const previous=this.storage.sql.exec<{id:string}>('SELECT id FROM moderation_reports WHERE reporter=? AND messageId=?',reporter,messageId).toArray()[0];
    if(previous)return {status:'duplicate',reportId:previous.id};
    const message=this.storage.sql.exec<ChatMessage>('SELECT id,sender,name,text,time FROM chat WHERE id=?',messageId).toArray()[0];
    if(!message||this.hidden(messageId))return {status:'unavailable'};
    if(this.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM moderation_reports').one().n>=500)return {status:'limited'};
    for(const id of [reporter,network]){const rate=this.storage.sql.exec<{count:number}>('SELECT count FROM moderation_rate WHERE id=?',id).toArray()[0];if(rate&&rate.count>=5)return {status:'limited'};}
    return this.storage.transactionSync(()=>{
      for(const key of [reporter,network])this.storage.sql.exec('INSERT INTO moderation_rate VALUES (?,?,1) ON CONFLICT(id) DO UPDATE SET count=count+1',key,Date.now());
      const subject=this.storage.sql.exec<{subject:string}>('SELECT subject FROM chat_subjects WHERE id=?',messageId).toArray()[0]?.subject??'';
      const id=crypto.randomUUID();this.storage.sql.exec('INSERT INTO moderation_reports (id,reporter,messageId,message,subject,reason,createdAt) VALUES (?,?,?,?,?,?,?)',id,reporter,messageId,JSON.stringify(message),subject,reason,Date.now());
      return {status:'saved',reportId:id};
    });
  }
  list(before?:number):ModerationSnapshot{
    this.clean();
    const rows=this.storage.sql.exec<ReportRow>('SELECT id,sequence,message,subject,reason,createdAt,revision,outcome FROM moderation_reports WHERE sequence<? ORDER BY sequence DESC LIMIT 51',before??Number.MAX_SAFE_INTEGER).toArray();
    return {reports:rows.slice(0,50).map(({message,subject,...rest})=>({...rest,message:JSON.parse(message) as ChatMessage,targetKind:subject.startsWith('wallet:')?'wallet':subject.startsWith('guest:')?'guest':'unknown'})),nextBefore:rows.length>50?rows[49].sequence:null,
      mutes:this.storage.sql.exec<RoomMute>('SELECT subject,name,until,kind FROM moderation_mutes ORDER BY until DESC LIMIT 500').toArray(),
      audit:this.storage.sql.exec<ModerationSnapshot['audit'][number]>('SELECT id,actor,action,reportId,time FROM moderation_audit ORDER BY time DESC,rowid DESC LIMIT 50').toArray()};
  }
  change(actor:string,command:ModerationMutation):Result{
    this.clean();return this.storage.transactionSync(()=>{
      if(command.kind==='unmute'){
        if(this.mutedUntil(command.subject)!==command.expectedUntil)return {ok:false,error:'This mute changed or expired. Refresh before acting.'};
        this.storage.sql.exec('DELETE FROM moderation_mutes WHERE subject=?',command.subject);
        this.audit(actor,'unmute',null);return {ok:true,mute:{subject:command.subject,until:0}};
      }
      const row=this.storage.sql.exec<ReportRow>('SELECT id,sequence,message,subject,reason,createdAt,revision,outcome FROM moderation_reports WHERE id=?',command.reportId).toArray()[0];
      if(!row||row.revision!==command.expectedRevision||row.outcome!=='open')return {ok:false,error:'This report changed, expired, or was already reviewed. Refresh first.'};
      const message=JSON.parse(row.message) as ChatMessage;let effect:Result={ok:true};
      if(command.decision==='hide-message'){
        if(!this.storage.sql.exec('SELECT id FROM chat WHERE id=?',message.id).toArray().length)return {ok:false,error:'This message has already left active room history. You may dismiss the report instead.'};
        this.storage.sql.exec('INSERT OR IGNORE INTO chat_hidden VALUES (?)',message.id);effect={ok:true,removed:message.id};
      }else if(command.decision==='mute-15m'){
        if(!row.subject)return {ok:false,error:'This older message has no reliable moderation identity. It can be hidden, but not used to mute a person.'};
        if(!this.mutedUntil(row.subject)&&this.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM moderation_mutes').one().n>=500)return {ok:false,error:'The room mute limit is reached. Review existing mutes first.'};
        const until=Date.now()+MUTE_MS;this.storage.sql.exec('INSERT OR REPLACE INTO moderation_mutes VALUES (?,?,?,?)',row.subject,message.name,until,row.subject.startsWith('wallet:')?'wallet':'guest');effect={ok:true,mute:{subject:row.subject,until}};
      }
      this.storage.sql.exec('UPDATE moderation_reports SET revision=revision+1,outcome=? WHERE id=?',command.decision,row.id);this.audit(actor,command.decision,row.id);return effect;
    });
  }
  private audit(actor:string,action:string,reportId:string|null){this.storage.sql.exec('INSERT INTO moderation_audit VALUES (?,?,?,?,?)',crypto.randomUUID(),actor,action,reportId,Date.now());this.clean();}
}
