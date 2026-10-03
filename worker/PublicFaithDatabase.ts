import {DurableObject} from 'cloudflare:workers';
import type {Hash} from 'viem';
import {projectChainSettings} from '../src/projectChainSettings';
import {indexCursor,indexPosition,indexRequestSchema,publicSacredRecordSchema} from '../shared/faithIndex';
import {publicFaithDatabaseConfiguration,publicFaithSeedSchema,faithSyncRequestSchema} from '../shared/publicFaithDatabase';
import {rpcDiagnostic} from '../shared/rpcDiagnostic';
import {rpcPacer} from './RpcPacer';
import {faithIndexRpc} from './faithIndexRpc';
import {verifyDatabaseRecord} from './verifyDatabaseRecord';
import seed from '#ek-public-faith-seed' with {type:'json'};

const configured=publicFaithDatabaseConfiguration(projectChainSettings);
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
type Job={hash:Hash;attempts:number;due:number;created:number};
const JOB_LIMIT=64,HOURLY_NEW_LIMIT=30,ATTEMPT_LIMIT=6;

// A separate durable public database: listing never creates RPC work or renews
// an historical scan. The retained FaithIndex/direct adapters are independent.
// Only masked public projections and transaction-hash jobs are persisted here.
export class PublicFaithDatabase extends DurableObject<Env>{
  private working:Promise<void>|null=null;
  private rate=new Map<string,{at:number;reads:number;syncs:number}>();
  private rpc=rpcPacer(fetch,1000);
  private verify=verifyDatabaseRecord;
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);ctx.blockConcurrencyWhile(async()=>{
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS faith_db_records (scope TEXT NOT NULL,id TEXT NOT NULL,position TEXT NOT NULL,hash TEXT NOT NULL,block_hash TEXT NOT NULL,verified INTEGER NOT NULL,value TEXT NOT NULL,PRIMARY KEY(scope,id))');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS faith_db_order ON faith_db_records(scope,position DESC,id DESC)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS faith_db_hash ON faith_db_records(scope,hash)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS faith_db_jobs (scope TEXT NOT NULL,hash TEXT NOT NULL,attempts INTEGER NOT NULL,due INTEGER NOT NULL,created INTEGER NOT NULL,status TEXT NOT NULL,PRIMARY KEY(scope,hash))');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS faith_db_due ON faith_db_jobs(scope,status,due)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS faith_db_meta (scope TEXT PRIMARY KEY,seeded INTEGER NOT NULL,through_block TEXT NOT NULL,verified INTEGER NOT NULL,cooldown INTEGER NOT NULL,budget_at INTEGER NOT NULL,budget_count INTEGER NOT NULL)');
    this.initialize();
  });}
  private initialize(){
    if(!configured)return;
    const scope=configured.scope;
    if(this.ctx.storage.sql.exec('SELECT scope FROM faith_db_meta WHERE scope=?',scope).toArray().length)return;
    const parsed=publicFaithSeedSchema.safeParse(seed);
    // Historical, previously verified operator snapshot, not a fresh RPC proof.
    // Exact sources must match; anonymous/encrypted data is validated again.
    const snapshot=parsed.success&&parsed.data.scope===scope&&parsed.data.records.every(r=>this.validSource(r))?parsed.data:null;
    this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec('INSERT INTO faith_db_meta VALUES(?,?,?,?,0,0,0)',scope,snapshot?1:0,snapshot?.throughBlock??configured.floor.toString(),snapshot?Date.parse(snapshot.verifiedAt):0);
      if(snapshot)this.store(snapshot.records,snapshot.anchorHash,Date.parse(snapshot.verifiedAt));
    });
  }
  private validSource(record:{kind:string;contract:string;blockNumber:string}){
    return !!configured&&record.contract.toLowerCase()===(record.kind==='prayer'?configured.prayer:configured.holder)?.toLowerCase()&&BigInt(record.blockNumber)>=configured.floor;
  }
  private store(candidates:unknown[],blockHash:string,verified=Date.now()){
    if(!configured)return;
    if(!/^0x[0-9a-fA-F]{64}$/.test(blockHash))throw Error('Invalid block proof');
    const records=candidates.map(value=>publicSacredRecordSchema.parse(value));
    if(records.some(r=>!this.validSource(r)))throw Error('Wrong public source');
    for(const record of records)this.ctx.storage.sql.exec('INSERT OR REPLACE INTO faith_db_records VALUES(?,?,?,?,?,?,?)',configured.scope,record.id,indexPosition(record),record.transactionHash.toLowerCase(),blockHash,verified,JSON.stringify(record));
  }
  private meta(){return this.ctx.storage.sql.exec<{seeded:number;through_block:string;verified:number;cooldown:number;budget_at:number;budget_count:number}>('SELECT * FROM faith_db_meta WHERE scope=?',configured!.scope).toArray()[0];}
  private async schedule(){
    if(!configured)return;
    const next=this.ctx.storage.sql.exec<{due:number}>('SELECT due FROM faith_db_jobs WHERE scope=? AND status=? ORDER BY due LIMIT 1',configured.scope,'queued').toArray()[0];
    if(!next){await this.ctx.storage.deleteAlarm();return;}
    const deadline=Math.max(Date.now()+1000,next.due,this.meta().cooldown),existing=await this.ctx.storage.getAlarm();
    if(existing===null||existing>deadline)await this.ctx.storage.setAlarm(deadline);
  }
  private async step(){
    if(!configured)return;
    const now=Date.now();if(this.meta().cooldown>now)return;
    const job=this.ctx.storage.sql.exec<Job>('SELECT hash,attempts,due,created FROM faith_db_jobs WHERE scope=? AND status=? AND due<=? ORDER BY due,created LIMIT 1',configured.scope,'queued',now).toArray()[0];
    if(!job)return;
    if(now-job.created>86400000){this.defer(job);return;}
    let status:'pending'|'unavailable'|'rejected'='unavailable',limited=false;
    const report=(error:unknown)=>{const diagnostic=rpcDiagnostic(error);if(diagnostic.status===429||diagnostic.code===429)limited=true;console.warn('Public database sync status',diagnostic);};
    try{
      const endpoint=faithIndexRpc(this.env as Env&{FAITH_INDEX_RPC_URL?:string},configured.network.rpcUrl);
      const result=await this.verify(projectChainSettings,endpoint,job.hash,AbortSignal.timeout(60000),this.rpc.fetch,undefined,report);
      if(result.status==='verified'){
        this.ctx.storage.transactionSync(()=>{
          this.store(result.records,result.anchorHash);
          const through=result.records.reduce((n,r)=>BigInt(r.blockNumber)>n?BigInt(r.blockNumber):n,BigInt(this.meta().through_block));
          this.ctx.storage.sql.exec('UPDATE faith_db_meta SET through_block=?,verified=? WHERE scope=?',through.toString(),Date.now(),configured.scope);
          this.ctx.storage.sql.exec('DELETE FROM faith_db_jobs WHERE scope=? AND hash=?',configured.scope,job.hash);
        });return;
      }
      status=result.status;
    }catch(error){
      // Allowlisted numeric fields only. No hash, URL, envelope or private text.
      report(error);
    }
    if(status==='rejected'){
      this.ctx.storage.sql.exec('UPDATE faith_db_jobs SET status=? WHERE scope=? AND hash=?','rejected',configured.scope,job.hash);return;
    }
    const attempts=job.attempts+1;
    if(limited){this.rpc.pause(60000);this.ctx.storage.sql.exec('UPDATE faith_db_meta SET cooldown=? WHERE scope=?',Date.now()+60000,configured.scope);}
    if(attempts>=ATTEMPT_LIMIT){this.defer(job);return;}
    this.ctx.storage.sql.exec('UPDATE faith_db_jobs SET attempts=?,due=? WHERE scope=? AND hash=?',attempts,Date.now()+Math.max(limited?60000:15000,Math.min(600000,15000*2**attempts)),configured.scope,job.hash);
  }
  private defer(job:Job){this.ctx.storage.sql.exec('UPDATE faith_db_jobs SET status=? WHERE scope=? AND hash=?','deferred',configured!.scope,job.hash);}
  async alarm(){
    if(!this.working)this.working=this.step().finally(async()=>{this.working=null;await this.schedule();});
    await this.working;
  }
  private async enqueue(hash:Hash){
    const scope=configured!.scope,now=Date.now();
    if(this.ctx.storage.sql.exec('SELECT id FROM faith_db_records WHERE scope=? AND hash=? LIMIT 1',scope,hash).toArray().length)return json({status:'stored'});
    const existing=this.ctx.storage.sql.exec<{status:string}>('SELECT status FROM faith_db_jobs WHERE scope=? AND hash=?',scope,hash).toArray()[0];
    if(existing?.status==='queued'){await this.schedule();return json({status:'queued'},202);}
    if(existing?.status==='rejected')return json({status:'rejected'},422);
    // Bound rejected/deferred hash retention and active work, with persistent
    // global admission limits across cold starts as well as per-IP limits.
    this.ctx.storage.sql.exec('DELETE FROM faith_db_jobs WHERE scope=? AND status<>? AND created<?',scope,'queued',now-86400000);
    const count=this.ctx.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM faith_db_jobs WHERE scope=?',scope).toArray()[0].n;
    if(count>=JOB_LIMIT&&!existing)return json({status:'busy'},429);
    const meta=this.meta(),fresh=now-meta.budget_at>=3600000;
    if(!fresh&&meta.budget_count>=HOURLY_NEW_LIMIT)return json({status:'busy'},429);
    this.ctx.storage.transactionSync(()=>{
      this.ctx.storage.sql.exec('UPDATE faith_db_meta SET budget_at=?,budget_count=? WHERE scope=?',fresh?now:meta.budget_at,fresh?1:meta.budget_count+1,scope);
      this.ctx.storage.sql.exec('INSERT OR REPLACE INTO faith_db_jobs VALUES(?,?,0,?,?,?)',scope,hash,now,now,'queued');
    });await this.schedule();return json({status:'queued'},202);
  }
  // Internal operator export interface: public masked data only. No HTTP import
  // of client projections is exposed. Future rebuilds use verified chain hashes.
  exportVerified(){
    if(!configured)return [];
    return this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM faith_db_records WHERE scope=? ORDER BY position DESC,id DESC LIMIT 128',configured.scope).toArray().map(row=>publicSacredRecordSchema.parse(JSON.parse(row.value)));
  }
  async fetch(request:Request){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!configured)return json({status:'unconfigured'});
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
    const sync=new URL(request.url).pathname==='/api/public-faith/sync',ip=request.headers.get('CF-Connecting-IP')??'local',now=Date.now();
    for(const [key,value] of this.rate)if(now-value.at>=60000)this.rate.delete(key);
    if(!this.rate.has(ip)&&this.rate.size>=1024)return json({status:'unavailable'},429);
    const rate=this.rate.get(ip)??{at:now,reads:0,syncs:0};if(sync)rate.syncs++;else rate.reads++;this.rate.set(ip,rate);
    if(rate.reads>120||rate.syncs>6)return json({status:'unavailable'},429);
    let text='';const reader=request.body?.getReader();
    if(reader){const chunks:Uint8Array[]=[];let bytes=0;
      try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.length;if(bytes>300){await reader.cancel();return json({error:'Request too large'},413);}chunks.push(part.value);}}
      finally{reader.releaseLock();}
      const joined=new Uint8Array(bytes);let at=0;for(const chunk of chunks){joined.set(chunk,at);at+=chunk.length;}
      try{text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(joined);}catch{return json({error:'Invalid request'},400);}
    }
    let input:unknown;try{input=JSON.parse(text);}catch{return json({error:'Invalid request'},400);}
    if(sync){const parsed=faithSyncRequestSchema.safeParse(input);if(!parsed.success)return json({error:'Invalid request'},400);return this.enqueue(parsed.data.transactionHash);}
    const parsed=indexRequestSchema.safeParse(input);if(!parsed.success)return json({error:'Invalid request'},400);
    const scope=configured.scope;
    const rows=parsed.data.before?(()=>{const [,block,event,...parts]=parsed.data.before!.split(':'),position=block+':'+event,id=parts.join(':');return this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM faith_db_records WHERE scope=? AND (position<? OR (position=? AND id<?)) ORDER BY position DESC,id DESC LIMIT 33',scope,position,position,id).toArray();})():
      this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM faith_db_records WHERE scope=? ORDER BY position DESC,id DESC LIMIT 33',scope).toArray();
    const records=rows.slice(0,32).map(row=>publicSacredRecordSchema.parse(JSON.parse(row.value))),meta=this.meta();
    const queued=this.ctx.storage.sql.exec<{n:number}>('SELECT COUNT(*) AS n FROM faith_db_jobs WHERE scope=? AND status=?',scope,'queued').toArray()[0].n;
    // No alarm, head/log query, backfill or external request on this path.
    return json({status:'available',source:'database',network:configured.network.name,chainId:configured.network.chainId,from:configured.floor.toString(),to:meta.through_block,
      records,olderBefore:rows.length>32?indexCursor(records[31]):null,unchecked:0,unverified:0,missing:configured.holder?[]:['holder'],indexing:queued>0,
      verifiedAt:meta.verified?new Date(meta.verified).toISOString():null,historicalImport:!!meta.seeded});
  }
}
