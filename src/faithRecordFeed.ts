import {rpcFetchOptions,type RpcFetch} from '../shared/rpcFetch';
import {createPublicClient,http,decodeEventLog,hexToBytes,keccak256,type Address,type Hash,type Hex} from 'viem';
import type {ChainSettings} from '../shared/chainConfiguration';
import type {RecordKind} from '../shared/adapters';
import {evmReceivingAddressSchema} from '../shared/profile';
import {faithScreenPreview} from '../shared/faithReview';
import {prayerAbi,prayerPayloadSchema,PRAYER_PAYLOAD_LIMIT,prayerCall,prayerRecordId} from '../shared/prayerRecords';
import {holderFaithAbi,holderFaithPayloadSchema,holderFaithCall,holderFaithRecordId} from '../shared/holderFaithRecords';
import {prayerConfiguration,prayerRpc,verifyPrayerReceipt,type PrayerRpcPort,type PrayerProof} from './prayerChain';
import {holderFaithConfiguration} from './holderFaithReadiness';
import {holderFaithRpc,verifyHolderFaithReceipt,type HolderFaithRpcPort,type HolderFaithEvidence} from './holderFaithChain';

export const FAITH_FEED_BLOCKS=1000n;
export const FAITH_FEED_CHECK_LIMIT=12;
export const FAITH_FEED_CONCURRENCY=3;
type Source={kind:'prayer'|'holder';contract:Address;codeHash:Hash};
export type FaithFeedLog={address:Address;data:Hex;topics:readonly Hex[];transactionHash:Hash|null;blockHash:Hash|null;blockNumber:bigint|null;logIndex:number|null;removed?:boolean};
export interface FaithFeedPorts {
  prayer:PrayerRpcPort;holder:HolderFaithRpcPort;
  logs(source:Source,from:bigint,to:bigint,author?:Address):Promise<FaithFeedLog[]>;
}
export type SacredRecord={id:string;kind:RecordKind;name:string;words:string;encrypted:boolean;anonymous:boolean;createdAt:string;
  transactionHash:Hash;contract:Address;blockNumber:string;eventIndex?:number};
export type FaithFeedPage={status:'available';network:string;chainId:number;from:string;to:string;olderBefore:string|null;
  records:SacredRecord[];unchecked:number;unverified:number;missing:('prayer'|'holder')[];anchorHash?:Hash;indexing?:boolean;source?:'database';verifiedAt?:string|null;historicalImport?:boolean};
export type FaithFeedResult=FaithFeedPage|{status:'unconfigured'|'unavailable'};
export interface FaithRecordReader {readonly sharedIndex?:boolean;readonly database?:boolean;read(input:{signal:AbortSignal;author?:Address;before?:string}):Promise<FaithFeedResult>}
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const hash=(v:unknown):v is Hash=>typeof v==='string'&&/^0x[0-9a-fA-F]{64}$/.test(v);
export function faithFeedPorts(url:string,signal:AbortSignal,fetchFn?:RpcFetch):FaithFeedPorts {
  const client=createPublicClient({ccipRead:false,transport:http(url,{retryCount:0,timeout:8000,maxResponseBodySize:262144,
    fetchOptions:rpcFetchOptions(signal),fetchFn})});
  return {prayer:prayerRpc(url,signal,fetchFn),holder:holderFaithRpc(url,signal,fetchFn),async logs(source,fromBlock,toBlock,author){
    const common={address:source.contract,fromBlock,toBlock,args:author?{author}:undefined,strict:true as const};
    return source.kind==='prayer'?client.getLogs({...common,event:prayerAbi[2]}):client.getLogs({...common,event:holderFaithAbi[5]});
  }};
}

// Deduplicate immutable record/receipt reads inside this one request only.
// Never cache network, bytecode, head or canonical-block checks across proofs.
// All bytes (including ciphertext) are released with the request, not persisted.
function reuseEvidence(raw:FaithFeedPorts):FaithFeedPorts {
  function memo<A extends unknown[],T>(read:(...args:A)=>Promise<T>,key:(...args:A)=>string){
    const pending=new Map<string,Promise<T>>();
    return (...args:A)=>{const id=key(...args);let value=pending.get(id);if(!value){value=Promise.resolve().then(()=>read(...args));pending.set(id,value);}return value;};
  }
  const receipt=memo((h:Hash)=>raw.prayer.receipt(h),h=>h.toLowerCase());
  return {...raw,
    prayer:{...raw.prayer,receipt,stored:memo((p:PrayerProof,b:bigint)=>raw.prayer.stored(p,b),(p,b)=>`${p.contract.toLowerCase()}:${p.recordId.toLowerCase()}:${b}`)},
    holder:{...raw.holder,stored:memo((p:HolderFaithEvidence,b:bigint)=>raw.holder.stored(p,b),(p,b)=>`${p.contract.toLowerCase()}:${p.recordId.toLowerCase()}:${b}`)},
  };
}

// Only canonical, bounded, strict envelopes can enter a public projection.
// Ciphertext, nonce, IV, raw bytes, payer and any undeclared fields stay out.
export function decodeSacredEnvelope(bytes:Hex,source:'prayer'|'holder') {
  if(!/^0x(?:[0-9a-fA-F]{2})+$/.test(bytes)||bytes.length>2+PRAYER_PAYLOAD_LIMIT*2)throw Error('Invalid envelope.');
  const input:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true,ignoreBOM:false}).decode(hexToBytes(bytes)));
  const payload=source==='prayer'?prayerPayloadSchema.parse(input):holderFaithPayloadSchema.parse(input);
  const call=payload.kind==='prayer'?prayerCall(payload):holderFaithCall(payload);
  if(!same(call.bytes,bytes))throw Error('Noncanonical envelope.');
  const view=faithScreenPreview({name:payload.authorLabel,text:payload.visibility==='public'?payload.payload:'',
    anonymous:payload.authorVisibility==='initial-only',encrypted:payload.visibility==='encrypted'});
  return {payload,call,view};
}

// Replaceable client-only reader. No wallet access, server index, browser
// persistence, telemetry or background poll. Broad discovery is author-filtered,
// time/response-capped and opt-in; proof work stays bounded per page.
export function createFaithRecordReader(settings:ChainSettings,factory=faithFeedPorts,options:{windowBlocks?:bigint;floor?:bigint;authorHistory?:boolean;checkOffset?:number;checkLimit?:number;transactionHash?:Hash;retryReadFailures?:boolean;appendOnlyStateAtHead?:boolean;timeoutMs?:number;onReadFailure?:(error:unknown)=>void}={}):FaithRecordReader {
  const releaseFloor=settings.status==='valid'&&settings.config.release?.startBlock?BigInt(settings.config.release.startBlock):0n;
  const windowBlocks=options.windowBlocks??FAITH_FEED_BLOCKS,floor=options.floor!==undefined&&options.floor>releaseFloor?options.floor:releaseFloor,offset=options.checkOffset??0;
  if(windowBlocks<1n||windowBlocks>100000n||floor<0n||!Number.isSafeInteger(offset)||offset<0)throw Error('Invalid bounded scan.');
  const limit=options.checkLimit??FAITH_FEED_CHECK_LIMIT;if(!Number.isInteger(limit)||limit<1||limit>FAITH_FEED_CHECK_LIMIT)throw Error('Invalid proof budget.');
  const timeoutMs=options.timeoutMs??30000;if(!Number.isInteger(timeoutMs)||timeoutMs<1000||timeoutMs>60000)throw Error('Invalid read timeout.');
  if(options.transactionHash!==undefined&&!hash(options.transactionHash))throw Error('Invalid transaction filter.');
  const prayer=prayerConfiguration(settings),holder=holderFaithConfiguration(settings);
  const sources:Source[]=[...(prayer?[{kind:'prayer' as const,contract:prayer.contract,codeHash:prayer.codeHash}]:[]),
    ...(holder?[{kind:'holder' as const,contract:holder.contract,codeHash:holder.codeHash}]:[])];
  return {async read(input){
    input.signal.throwIfAborted();
    if(settings.status!=='valid'||!sources.length||!settings.config.network)return {status:'unconfigured'};
    const network=settings.config.network;
    const signal=AbortSignal.any([input.signal,AbortSignal.timeout(timeoutMs)]);
    try {
      const author=input.author===undefined?undefined:evmReceivingAddressSchema.parse(input.author) as Address;
      // Explicit personal lookup discovers this author's complete event history,
      // not just a recent 1,000-block window. Proof work remains page-bounded.
      // The event-index cursor also preserves older events in the same block.
      const personal=Boolean(options.authorHistory&&author);
      if(options.authorHistory&&!author)return {status:'unavailable'};
      const position=personal&&input.before?.match(/^personal:(0|[1-9][0-9]{0,19}):(0|[1-9][0-9]{0,9})$/);
      if(input.before!==undefined&&!position&&!/^(0|[1-9][0-9]{0,19})$/.test(input.before))return {status:'unavailable'};
      let readFailed=false;
      // A failed RPC proof must not move a persistent index past a real record.
      // Some existing receipt verifiers deliberately return unknown on errors;
      // observe their port failures without logging error bodies or payloads.
      const observe=<T extends object>(port:T):T=>Object.fromEntries(Object.entries(port).map(([key,value])=>[key,typeof value==='function'?async(...args:unknown[])=>{
        try{const result=await Reflect.apply(value,port,args);if(result==null&&['receipt','transaction','blockHash','code','bytecode'].includes(key))readFailed=true;return result;}
        catch(error){readFailed=true;options.onReadFailure?.(error);throw error;}
      }:value])) as T;
      const raw=factory(network.rpcUrl,signal);
      let rpc=reuseEvidence(options.retryReadFailures?{...raw,prayer:observe(raw.prayer),holder:observe(raw.holder)}:raw);
      const check=()=>signal.throwIfAborted();
      if(await rpc.prayer.chainId()!==network.chainId)return {status:'unavailable'};check();
      const [codes,parameters,head]=await Promise.all([
        Promise.all(sources.map(source=>rpc.prayer.code(source.contract))),
        holder?rpc.holder.parameters(holder.contract):Promise.resolve(null),rpc.prayer.head(),
      ]);check();
      if(codes.some((code,i)=>!code||keccak256(code)!==sources[i].codeHash))return {status:'unavailable'};
      // Old holder records are readable after holdings or token decimals change.
      // Verify immutable constructor binding, not today's token balance/metadata.
      if(holder){
        const p=parameters!;
        if(!same(p.token,holder.tokenContract)||!Number.isInteger(p.decimals)||p.decimals<0||p.decimals>36||p.minimum!==10n**BigInt(p.decimals))return {status:'unavailable'};
      }
      if(head<2n)return {status:'unavailable'};
      const latest=head-2n,before=position?BigInt(position[1])+1n:input.before===undefined?latest+1n:BigInt(input.before);
      // Index-only opt-in for the exact pinned append-only runtimes. Their
      // stored author/timestamp/kind/bytes cannot be edited or deleted. Check
      // old transaction/receipt/block evidence against this recent anchored
      // immutable state, not unavailable historical RPC state. User submission
      // receipt checks and the default direct reader retain their old behavior.
      let stateAnchor:Hash|null=null;
      if(options.appendOnlyStateAtHead){
        stateAnchor=await rpc.prayer.blockHash(latest);check();if(!hash(stateAnchor))return {status:'unavailable'};
        const recent=rpc;
        rpc={...recent,prayer:{...recent.prayer,stored:p=>recent.prayer.stored(p,latest)},holder:{...recent.holder,stored:p=>recent.holder.stored(p,latest)}};
      }
      if(before===0n||before>latest+1n)return {status:'unavailable'};
      const to=before-1n,from=personal?floor:to>=windowBlocks-1n?(to-windowBlocks+1n>floor?to-windowBlocks+1n:floor):floor;
      if(to<from)return {status:'unavailable'};
      const anchor=await rpc.prayer.blockHash(to);check();if(!hash(anchor))return {status:'unavailable'};
      const candidates:{source:Source;log:FaithFeedLog}[]=[];
      const discovered=await Promise.all(sources.map(source=>rpc.logs(source,from,to,author)));check();
      for(const [i,source] of sources.entries()){
        const logs=discovered[i];
        if(logs.length>(personal?512:128))return {status:'unavailable'};
        for(const log of logs){
          if(log.removed||!same(log.address,source.contract)||log.blockNumber===null||log.blockNumber<from||log.blockNumber>to||
            !hash(log.transactionHash)||!hash(log.blockHash)||!Number.isSafeInteger(log.logIndex)||log.logIndex!<0)throw Error('Invalid log.');
          if(!position||log.blockNumber<BigInt(position[1])||log.blockNumber===BigInt(position[1])&&log.logIndex!<Number(position[2]))candidates.push({source,log});
        }
      }
      candidates.sort((a,b)=>a.log.blockNumber===b.log.blockNumber?b.log.logIndex!-a.log.logIndex!:a.log.blockNumber!>b.log.blockNumber!?-1:1);
      const unique=candidates.filter((c,i,all)=>(!options.transactionHash||same(c.log.transactionHash!,options.transactionHash))&&all.findIndex(x=>same(x.source.contract,c.source.contract)&&same(x.log.transactionHash!,c.log.transactionHash!)&&x.log.logIndex===c.log.logIndex)===i);
      const checked=unique.slice(offset,offset+limit);
      const verifiedRecords:(SacredRecord|null)[]=new Array(checked.length).fill(null);
      async function verifyCandidate(index:number){
        const {source,log}=checked[index];
        check();
        try {
          const event=source.kind==='prayer'?decodeEventLog({abi:prayerAbi,data:log.data,topics:log.topics as [Hex,...Hex[]],strict:true}):
            decodeEventLog({abi:holderFaithAbi,data:log.data,topics:log.topics as [Hex,...Hex[]],strict:true});
          if(event.eventName!=='PrayerRecorded'&&event.eventName!=='FaithRecorded')throw Error('Wrong event.');
          const {recordId,author:payer,payloadHash}=event.args;
          if(author&&!same(author,payer))throw Error('Wrong author.');
          const base={chainId:network.chainId,network:network.name,rpcUrl:network.rpcUrl,contract:source.contract,codeHash:source.codeHash,payer,recordId,payloadHash,data:'0x' as Hex,bytes:'0x' as Hex};
          let createdAt:bigint,bytes:Hex,kindCode:number|undefined;
          if(source.kind==='prayer'){
            const stored=await rpc.prayer.stored(base,log.blockNumber!);[ ,createdAt,bytes]=stored;
            if(!same(stored[0],payer))throw Error('Wrong stored author.');
          }else{
            const stored=await rpc.holder.stored({...base,kindCode:1},log.blockNumber!);[ ,createdAt,kindCode,bytes]=stored;
            if(!same(stored[0],payer))throw Error('Wrong stored author.');
          }
          check();
          const {payload,call,view}=decodeSacredEnvelope(bytes,source.kind);
          if(createdAt<=0n||createdAt>8640000000000n||!same(call.payloadHash,payloadHash))throw Error('Wrong payload.');
          let verified:string;
          if(payload.kind==='prayer'){
            const p:PrayerProof={...base,...call};
            if(!same(prayerRecordId(network.chainId,source.contract,payer,p.payloadHash),recordId))throw Error('Wrong record ID.');
            verified=(await verifyPrayerReceipt(rpc.prayer,p,log.transactionHash!,signal)).status;
          }else{
            const p:HolderFaithEvidence={...base,...holderFaithCall(payload)};
            if(event.eventName!=='FaithRecorded'||event.args.kind!==p.kindCode||kindCode!==p.kindCode||
              !same(holderFaithRecordId(network.chainId,source.contract,payer,payload.kind,p.payloadHash),recordId))throw Error('Wrong kind or record ID.');
            verified=(await verifyHolderFaithReceipt(rpc.holder,p,log.transactionHash!,signal)).status;
          }
          check();
          // Match the discovery log's own canonical block too; an unrelated
          // copied transaction hash cannot relabel a verified receipt's height.
          const receipt=await rpc.prayer.receipt(log.transactionHash!);check();
          if(verified!=='confirmed'||!receipt||receipt.blockNumber!==log.blockNumber||!same(receipt.blockHash,log.blockHash!))throw Error('Unverified record.');
          const id=`${source.contract.toLowerCase()}:${recordId.toLowerCase()}`;
          verifiedRecords[index]={id,kind:payload.kind,name:view.name,words:view.words,encrypted:payload.visibility==='encrypted',anonymous:payload.authorVisibility==='initial-only',
            createdAt:new Date(Number(createdAt)*1000).toISOString(),transactionHash:log.transactionHash!,contract:source.contract,blockNumber:log.blockNumber!.toString(),eventIndex:log.logIndex!};
        }catch(e){if(signal.aborted)throw e;}
      }
      // At most three proofs run together. Preserve newest-first order even if
      // responses finish out of order; publish nothing before final anchoring.
      let cursor=0;
      await Promise.all(Array.from({length:Math.min(FAITH_FEED_CONCURRENCY,checked.length)},async()=>{
        while(cursor<checked.length){check();await verifyCandidate(cursor++);}
      }));check();
      const records:SacredRecord[]=[],seen=new Set<string>();let unverified=0;
      for(const record of verifiedRecords){if(!record||seen.has(record.id)){unverified++;continue;}seen.add(record.id);records.push(record);}
      if(await rpc.prayer.chainId()!==network.chainId)return {status:'unavailable'};check();
      const finalCodes=await Promise.all(sources.map(source=>rpc.prayer.code(source.contract)));check();
      if(finalCodes.some((code,i)=>!code||keccak256(code)!==sources[i].codeHash))return {status:'unavailable'};
      const finalAnchor=await rpc.prayer.blockHash(to);check();
      if(!finalAnchor||!same(finalAnchor,anchor))return {status:'unavailable'};
      if(stateAnchor){const finalState=await rpc.prayer.blockHash(latest);check();if(!finalState||!same(finalState,stateAnchor))return {status:'unavailable'};}
      if(options.retryReadFailures&&readFailed)return {status:'unavailable'};
      const last=checked.at(-1)?.log;
      const olderBefore=personal?(unique.length>offset+limit&&last?`personal:${last.blockNumber}:${last.logIndex}`:null):from>floor?from.toString():null;
      return {status:'available',network:network.name,chainId:network.chainId,from:from.toString(),to:to.toString(),olderBefore,
        records,unverified,unchecked:personal?0:Math.max(0,unique.length-offset-limit),anchorHash:finalAnchor,
        missing:(['prayer','holder'] as const).filter(kind=>!sources.some(s=>s.kind===kind))};
    }catch(e){if(input.signal.aborted)throw e;options.onReadFailure?.(e);return {status:'unavailable'};}
  }};
}
