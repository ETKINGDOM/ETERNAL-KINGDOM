import {createPublicClient,http,erc20Abi,decodeEventLog,decodeFunctionData,encodeFunctionData,formatUnits,keccak256,type Address,type Hash,type Hex} from 'viem';
import {z} from 'zod';
import {configuredGodToken,assertCurrentGodToken,godTokenSnapshotSchema,type ChainSettings,type GodTokenSnapshot} from '../shared/chainConfiguration';
import {evmReceivingAddressSchema} from '../shared/profile';
import {godTokenService} from './godTokenService';
import {evmGiftRpcPort,type EvmGiftRpcPort} from './evmGiftPorts';
import type {FaithFeedLog} from './faithRecordFeed';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';

const block=z.string().regex(/^(0|[1-9][0-9]{0,19})$/),hash=z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const snapshotSchema=z.object({token:godTokenSnapshotSchema,recipient:evmReceivingAddressSchema,start:block,through:block,anchor:hash,codeHash:hash}).strict();
const cursorSchema=z.object({snapshot:snapshotSchema,next:block,after:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER).nullable()}).strict();
export type DonationSnapshot=z.infer<typeof snapshotSchema>;
export type DonationCursor=z.infer<typeof cursorSchema>;
export type DonationRecord={id:string;donor:Address;units:bigint;hash:Hash;block:string};
export type DonationPage={status:'available';snapshot:DonationSnapshot;input:DonationCursor;next:DonationCursor|null;records:DonationRecord[];unverified:number};
export type DonationReadResult=DonationPage|{status:'unconfigured'|'unavailable'};
export interface DonationRankingReader{read(signal:AbortSignal,cursor?:DonationCursor):Promise<DonationReadResult>}
export interface DonationRankingPort extends EvmGiftRpcPort{logs(contract:Address,recipient:Address,from:bigint,to:bigint):Promise<FaithFeedLog[]>}
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const validHash=(v:unknown):v is Hash=>hash.safeParse(v).success;
export const DONATION_PAGE_LIMIT=12;
export const DONATION_BLOCK_LIMIT=1000n;
function rpcPort(url:string,signal:AbortSignal):DonationRankingPort{
  const client=createPublicClient({ccipRead:false,transport:http(url,{retryCount:0,timeout:8000,maxResponseBodySize:262144,fetchOptions:{signal,credentials:'omit',referrerPolicy:'no-referrer'}})});
  return {...evmGiftRpcPort(url,signal),logs:(address,to,fromBlock,toBlock)=>client.getLogs({address,event:erc20Abi.find(e=>e.type==='event'&&e.name==='Transfer')!,args:{to},fromBlock,toBlock,strict:true})};
}
// Read-only standard ERC-20 direct transfers. No wallet, signing, payments,
// storage or offchain currency conversion. Native/other-chain asset readers
// require separate adapters; they must not impersonate ERC-20 contracts.
export function createDonationRankingReader(settings:ChainSettings,factory=rpcPort):DonationRankingReader{
  const tokenConfig=configuredGodToken(settings);
  const donation=settings.status==='valid'?settings.config.godTokenDonation:null;
  const network=settings.status==='valid'?settings.config.network:null;
  return {async read(cancellation,cursor){
    cancellation.throwIfAborted();
    if(!tokenConfig||!donation?.recipient||donation.startBlock===null||!isRobinhoodNitroNetwork(network))return {status:'unconfigured'};
    const signal=AbortSignal.any([cancellation,AbortSignal.timeout(30000)]),check=()=>signal.throwIfAborted();
    try{
      // Parse/copy caller-owned cursors before the first await.
      const copied=cursor===undefined?undefined:cursorSchema.parse(cursor);
      const rpc=factory(tokenConfig.rpcUrl,signal);
      const metadata=await godTokenService(settings,()=>rpc).read(signal);check();
      if(metadata.status!=='available')return {status:'unavailable'};
      const code=await rpc.bytecode(tokenConfig.contract);check();
      if(!code||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code))return {status:'unavailable'};
      const codeHash=keccak256(code as Hex),head=await rpc.head();check();
      if(head<2n)return {status:'unavailable'};
      let snapshot:DonationSnapshot;
      if(copied){
        snapshot=copied.snapshot;assertCurrentGodToken(settings,snapshot.token);
        if(!same(snapshot.recipient,donation.recipient)||snapshot.start!==donation.startBlock||
          snapshot.codeHash!==codeHash||snapshot.token.symbol!==metadata.token.symbol||snapshot.token.decimals!==metadata.token.decimals||BigInt(snapshot.through)>head-2n)return {status:'unavailable'};
      }else{
        const through=head-2n,anchor=await rpc.blockHash(through);check();if(!validHash(anchor))return {status:'unavailable'};
        snapshot={token:godTokenSnapshotSchema.parse(metadata.token),recipient:donation.recipient,start:donation.startBlock,through:through.toString(),anchor,codeHash};
      }
      const input:DonationCursor=copied??{snapshot,next:snapshot.start,after:null};
      const from=BigInt(input.next),through=BigInt(snapshot.through);
      if(from<BigInt(snapshot.start)||from>through)return {status:'unavailable'};
      const anchor=await rpc.blockHash(through);check();if(!anchor||!same(anchor,snapshot.anchor))return {status:'unavailable'};
      let to=from+DONATION_BLOCK_LIMIT-1n;if(to>through)to=through;
      const logs=from>through?[]:await rpc.logs(tokenConfig.contract,donation.recipient as Address,from,to);check();
      if(logs.length>128)return {status:'unavailable'};
      for(const log of logs){
        if(log.removed||!same(log.address,tokenConfig.contract)||log.blockNumber===null||log.blockNumber<from||log.blockNumber>to||
          !Number.isSafeInteger(log.logIndex)||log.logIndex!<0||!validHash(log.transactionHash)||!validHash(log.blockHash))throw Error('Invalid log.');
      }
      logs.sort((a,b)=>a.blockNumber===b.blockNumber?a.logIndex!-b.logIndex!:a.blockNumber!<b.blockNumber!?-1:1);
      const unique=logs.filter((l,i,all)=>all.findIndex(x=>same(x.transactionHash!,l.transactionHash!)&&x.logIndex===l.logIndex)===i);
      const remaining=unique.filter(l=>l.blockNumber!>from||input.after===null||l.logIndex!>input.after);
      const selected=remaining.slice(0,DONATION_PAGE_LIMIT),records:DonationRecord[]=[],seen=new Set<string>();let unverified=0;
      for(const log of selected){
        check();
        try{
          const event=decodeEventLog({abi:erc20Abi,eventName:'Transfer',data:log.data,topics:log.topics as [Hex,...Hex[]],strict:true});
          const {from:donor,to:recipient,value:units}=event.args;
          evmReceivingAddressSchema.parse(donor);
          if(!same(recipient,donation.recipient)||same(donor,recipient)||units<=0n||units>=(1n<<256n))throw Error('Not a donation.');
          const txHash=log.transactionHash!,[receipt,tx,canonical]=await Promise.all([rpc.receipt(txHash),rpc.transaction(txHash),rpc.blockHash(log.blockNumber!)]);check();
          if(!receipt||receipt.status!=='success'||!same(receipt.hash,txHash)||receipt.blockNumber!==log.blockNumber||!same(receipt.blockHash,log.blockHash!)||
            !canonical||!same(canonical,log.blockHash!)||!tx||!same(tx.hash,txHash)||tx.chainId!==tokenConfig.chainId||!same(tx.from,donor)||
            !tx.to||!same(tx.to,tokenConfig.contract)||tx.value!==0n||!tx.blockHash||!same(tx.blockHash,log.blockHash!))throw Error('Unverified transfer.');
          const decoded=decodeFunctionData({abi:erc20Abi,data:tx.input});
          if(decoded.functionName!=='transfer'||!same(decoded.args[0],recipient)||decoded.args[1]!==units||
            !same(tx.input,encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[recipient,units]})))throw Error('Not a direct transfer.');
          // Nonstandard fee/mint/multiple-transfer receipts are not silently
          // counted as the amount received. Token semantics still need review.
          const transfers=receipt.logs.filter(l=>{
            if(!same(l.address,tokenConfig.contract))return false;
            try{decodeEventLog({abi:erc20Abi,eventName:'Transfer',data:l.data,topics:l.topics as [Hex,...Hex[]],strict:true});return true;}catch{return false;}
          });
          if(transfers.length!==1||!same(transfers[0].data,log.data)||transfers[0].topics.length!==log.topics.length||transfers[0].topics.some((t,i)=>!same(t,log.topics[i])))throw Error('Ambiguous transfer.');
          const id=`${tokenConfig.chainId}:${tokenConfig.contract.toLowerCase()}:${txHash.toLowerCase()}`;
          if(seen.has(id))throw Error('Duplicate direct transfer.');seen.add(id);
          records.push({id,donor,units,hash:txHash,block:log.blockNumber!.toString()});
        }catch(e){if(signal.aborted)throw e;unverified++;}
      }
      if(await rpc.chainId()!==tokenConfig.chainId)return {status:'unavailable'};check();
      const [finalCode,finalAnchor,decimals,symbol]=await Promise.all([rpc.bytecode(tokenConfig.contract),rpc.blockHash(through),rpc.decimals(tokenConfig.contract),rpc.symbol(tokenConfig.contract)]);check();
      if(!finalCode||keccak256(finalCode as Hex)!==snapshot.codeHash||!finalAnchor||!same(finalAnchor,snapshot.anchor)||decimals!==snapshot.token.decimals||symbol!==snapshot.token.symbol)return {status:'unavailable'};
      const last=selected.at(-1);
      const next:DonationCursor|null=remaining.length>selected.length?{snapshot,next:last!.blockNumber!.toString(),after:last!.logIndex!}:
        to<through?{snapshot,next:(to+1n).toString(),after:null}:null;
      return {status:'available',snapshot,input,next,records,unverified};
    }catch(e){if(cancellation.aborted)throw e;return {status:'unavailable'};}
  }};
}

export type DonationRanking={snapshot:DonationSnapshot;next:DonationCursor|null;records:DonationRecord[];unverified:number;pages:number};
export function appendDonationPage(previous:DonationRanking|null,page:DonationPage):DonationRanking{
  const signature=(s:DonationSnapshot)=>JSON.stringify(s);
  if(previous&&(signature(previous.snapshot)!==signature(page.snapshot)||!previous.next||JSON.stringify(previous.next)!==JSON.stringify(page.input)))throw Error('Ranking snapshot changed.');
  const records=[...(previous?.records??[]),...page.records],ids=new Set(records.map(r=>r.id));
  if(ids.size!==records.length||records.length>10000)throw Error('Ranking requires a complete index.');
  return {snapshot:page.snapshot,next:page.next,records,unverified:(previous?.unverified??0)+page.unverified,pages:(previous?.pages??0)+1};
}
export function donationRanks(records:readonly DonationRecord[],token:GodTokenSnapshot){
  const totals=new Map<string,{donor:Address;units:bigint;count:number}>();
  for(const record of records){
    const key=record.donor.toLowerCase(),old=totals.get(key);totals.set(key,{donor:old?.donor??record.donor,units:(old?.units??0n)+record.units,count:(old?.count??0)+1});
  }
  const sorted=[...totals.values()].sort((a,b)=>a.units===b.units?a.donor.toLowerCase().localeCompare(b.donor.toLowerCase(),'en'):a.units>b.units?-1:1);
  let rank=0;
  return sorted.map((entry,index)=>{if(index===0||entry.units!==sorted[index-1].units)rank=index+1;return {...entry,rank,amount:formatUnits(entry.units,token.decimals)};});
}
