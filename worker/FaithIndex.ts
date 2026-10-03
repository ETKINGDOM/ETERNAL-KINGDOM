import {DurableObject} from 'cloudflare:workers';
import {createFaithRecordReader,faithFeedPorts,type FaithFeedPage} from '../src/faithRecordFeed';
import {prayerRpc} from '../src/prayerChain';
import {projectChainSettings} from '../src/projectChainSettings';
import {faithIndexConfiguration,indexCursor,indexPosition,indexRequestSchema,publicSacredRecordSchema} from '../shared/faithIndex';
import {rpcDiagnostic} from '../shared/rpcDiagnostic';
import {rpcPacer} from './RpcPacer';
import {faithIndexRpc} from './faithIndexRpc';

type Scan={before:string;offset:number;window:number;latest:boolean;anchor?:string};
type State={fingerprint:string;latest:string|null;anchor:string|null;oldest:string|null;scan:Scan|null;checkedAt:number;failed:boolean;retryAt?:number;unverified:number;activeUntil:number};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const configured=faithIndexConfiguration(projectChainSettings);

// One rebuildable PUBLIC projection index. No wallet sessions, personal lookup,
// ciphertext, envelope, IV, key, microphone or private message is accepted here.
export class FaithIndex extends DurableObject<Env>{
  private working:Promise<void>|null=null;
  private rate=new Map<string,{at:number;count:number}>();
  private rpc=rpcPacer(fetch,1000);
  constructor(ctx:DurableObjectState,env:Env){super(ctx,env);this.ctx.blockConcurrencyWhile(async()=>{
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS faith_index_state (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS public_faith (id TEXT PRIMARY KEY, block TEXT NOT NULL, value TEXT NOT NULL)');
    ctx.storage.sql.exec('CREATE INDEX IF NOT EXISTS public_faith_order ON public_faith(block DESC,id DESC)');
  });}
  private state():State{
    const stored=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM faith_index_state WHERE id=1').toArray()[0];
    if(stored){const s=JSON.parse(stored.value) as State;if(s.fingerprint===configured?.fingerprint)return s;}
    // This table is a disposable projection, never an account or faith record.
    this.ctx.storage.sql.exec('DELETE FROM public_faith');
    const s:State={fingerprint:configured?.fingerprint??'',latest:null,anchor:null,oldest:null,scan:null,checkedAt:0,failed:false,unverified:0,activeUntil:0};this.save(s);return s;
  }
  private save(s:State){this.ctx.storage.sql.exec('INSERT OR REPLACE INTO faith_index_state VALUES(1,?)',JSON.stringify(s));}
  private async step(){
    if(!configured)return;
    let state=this.state();
    if(state.activeUntil<Date.now()||state.retryAt&&state.retryAt>Date.now())return;
    const signal=AbortSignal.timeout(60000);
    let limited=false;
    const report=(error:unknown)=>{const diagnostic=rpcDiagnostic(error);if(diagnostic.code===429||diagnostic.status===429){limited=true;this.rpc.pause(60000);}console.warn('Public index read status',diagnostic);};
    try{
      const endpoint=faithIndexRpc(this.env as Env&{FAITH_INDEX_RPC_URL?:string},configured.network.rpcUrl),rpc=prayerRpc(endpoint,signal,this.rpc.fetch);
      // An anchor change invalidates the disposable cache, not chain records.
      if(!state.scan){
        if(state.latest&&state.anchor&&(await rpc.blockHash(BigInt(state.latest)))?.toLowerCase()!==state.anchor.toLowerCase()){
          this.ctx.storage.sql.exec('DELETE FROM public_faith');state={...state,latest:null,anchor:null,oldest:null,unverified:0};
        }
        const freshness=state.oldest&&BigInt(state.oldest)>configured.floor?30000:10000;
        if(!state.latest||Date.now()-state.checkedAt>=freshness){
          const head=await rpc.head();if(head<configured.floor+2n)throw Error('Head unavailable');
          const before=head-1n;
          // Never skip a busy growth interval; forward updates may take chunks.
          const end=state.latest&&before>BigInt(state.latest)+100001n?BigInt(state.latest)+100001n:before;
          state.scan={before:end.toString(),offset:0,window:state.latest?Math.max(1,Number(end-BigInt(state.latest)-1n)):100000,latest:true};
        }else if(state.oldest&&BigInt(state.oldest)>configured.floor){state.scan={before:state.oldest,offset:0,window:100000,latest:false};}
        else return;
      }
      const scan=state.scan!;
      const reader=createFaithRecordReader(projectChainSettings,(_url,signal)=>faithFeedPorts(endpoint,signal,this.rpc.fetch),{windowBlocks:BigInt(scan.window),floor:configured.floor,checkOffset:scan.offset,checkLimit:1,timeoutMs:60000,retryReadFailures:true,appendOnlyStateAtHead:true,onReadFailure:report});
      const result=await reader.read({signal,before:scan.before});
      if(result.status!=='available'||!result.anchorHash){
        // RPC providers differ in log-range limits. Reduce, never claim empty.
        if(!limited&&scan.window>1000&&scan.offset===0)state.scan={...scan,window:Math.max(1000,Math.floor(scan.window/10))};
        state.failed=true;state.retryAt=Date.now()+(limited?60000:10000);this.save({...state,activeUntil:this.state().activeUntil});return;
      }
      this.commitPage(state,result);
    }catch(error){/* Only allowlisted numeric status; never log RPC envelopes or chain text. */
      report(error);
      state.failed=true;state.retryAt=Date.now()+(limited?60000:10000);this.save({...state,activeUntil:this.state().activeUntil});
    }
  }
  private commitPage(state:State,page:FaithFeedPage){
    const scan=state.scan!;
    this.ctx.storage.transactionSync(()=>{
      if(scan.anchor&&scan.anchor.toLowerCase()!==page.anchorHash?.toLowerCase()){
        this.ctx.storage.sql.exec('DELETE FROM public_faith');this.save({...state,latest:null,anchor:null,oldest:null,scan:null,checkedAt:0,unverified:0,activeUntil:this.state().activeUntil});return;
      }
      for(const candidate of page.records){
        const record=publicSacredRecordSchema.parse(candidate);
        this.ctx.storage.sql.exec('INSERT OR REPLACE INTO public_faith VALUES(?,?,?)',record.id,indexPosition(record),JSON.stringify(record));
      }
      state.unverified+=page.unverified;state.failed=false;state.retryAt=undefined;
      if(page.unchecked>0)state.scan={...scan,offset:scan.offset+1,anchor:page.anchorHash};
      else{
        if(scan.latest){state.latest=page.to;state.anchor=page.anchorHash!;state.checkedAt=Date.now();}
        if(!state.oldest||BigInt(page.from)<BigInt(state.oldest))state.oldest=page.from;
        state.scan=null;
      }
      // Incoming requests may renew activity while a bounded RPC scan awaits.
      this.save({...state,activeUntil:this.state().activeUntil});
    });
  }
  private run(){
    if(!this.working)this.working=this.step().finally(async()=>{
      this.working=null;const state=this.state();
      const incomplete=state.scan||!state.oldest||configured&&BigInt(state.oldest)>configured.floor;
      if(state.activeUntil>Date.now()&&(incomplete||Date.now()-state.checkedAt>=10000))await this.ctx.storage.setAlarm(Date.now()+(state.failed?Math.max(1000,(state.retryAt??Date.now()+10000)-Date.now()):1000));
      else if(state.activeUntil>Date.now())await this.ctx.storage.setAlarm(Date.now()+10000);
    });
    this.ctx.waitUntil(this.working);
  }
  async alarm(){if(this.state().activeUntil>Date.now()){this.run();await this.working;}}
  async fetch(request:Request){
    if(request.method!=='POST')return json({error:'Method not allowed'},405);
    if(!configured)return json({status:'unconfigured'});
    if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({error:'JSON required'},415);
    const ip=request.headers.get('CF-Connecting-IP')??'local',now=Date.now();
    for(const [key,value] of this.rate)if(now-value.at>=60000)this.rate.delete(key);
    if(!this.rate.has(ip)&&this.rate.size>=1024)return json({status:'unavailable'},429);
    const rate=this.rate.get(ip)??{at:now,count:0};rate.count++;this.rate.set(ip,rate);if(rate.count>120)return json({status:'unavailable'},429);
    const raw=await request.text();if(raw.length>300)return json({error:'Request too large'},413);
    let input;try{input=indexRequestSchema.parse(JSON.parse(raw));}catch{return json({error:'Invalid request'},400);}
    const state=this.state();state.activeUntil=now+180000;this.save(state);
    let rows:{value:string}[];
    if(input.before){const [,block,position,...idParts]=input.before.split(':'),id=idParts.join(':'),order=block+':'+position;rows=this.ctx.storage.sql.exec<{value:string}>(
      'SELECT value FROM public_faith WHERE block < ? OR (block = ? AND id < ?) ORDER BY block DESC,id DESC LIMIT 33',order,order,id).toArray();}
    else rows=this.ctx.storage.sql.exec<{value:string}>('SELECT value FROM public_faith ORDER BY block DESC,id DESC LIMIT 33').toArray();
    const records=rows.slice(0,32).map(row=>publicSacredRecordSchema.parse(JSON.parse(row.value))),indexing=!!state.scan||!state.oldest||BigInt(state.oldest)>configured.floor;
    // RPC work belongs to an awaited alarm, not the 30-second HTTP waitUntil
    // tail. Visitors read cached SQL immediately and never extend a scheduled
    // alarm forever by repeatedly resetting its deadline.
    if(!this.working){
      const refresh=indexing?now:state.checkedAt+10000;
      const deadline=now+Math.max(1000,Math.max(state.retryAt??now,refresh)-now);
      const scheduled=await this.ctx.storage.getAlarm();if(scheduled===null||scheduled>deadline)await this.ctx.storage.setAlarm(deadline);
    }
    if(state.failed&&!records.length)return json({status:'unavailable'});
    const to=state.scan?.latest?(BigInt(state.scan.before)-1n).toString():state.latest??configured.floor.toString();
    return json({status:'available',network:configured.network.name,chainId:configured.network.chainId,from:state.oldest??configured.floor.toString(),to,
      // A full page has an immutable row cursor; incomplete older history is
      // polled in-place, not navigated using a misleading block-window cursor.
      olderBefore:rows.length>32?indexCursor(records[31]):null,records,unchecked:0,unverified:state.unverified,
      missing:projectChainSettings.status==='valid'&&!projectChainSettings.config.faithRecords.holderContract?['holder']:[],indexing});
  }
}
