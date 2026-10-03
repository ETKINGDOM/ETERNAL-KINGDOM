import {z} from 'zod';
import {formatEther,zeroAddress,type Address,type Hash} from 'viem';
import {evmReceivingAddressSchema} from '../shared/profile';
import {EVM_DONATION_NETWORKS,type EvmDonationChainId} from '../shared/evmDonations';
import type {EvmGiftRpcPort} from './evmGiftPorts';

const block=z.string().regex(/^(0|[1-9][0-9]{0,19})$/),hash=z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const pageSchema=z.object({chainId:z.number().int(),recipient:evmReceivingAddressSchema,start:block,through:block,anchor:hash,
  hashes:z.array(hash).max(12),next:z.string().min(1).max(256).nullable(),complete:z.boolean()}).strict();
export type EvmDonationRecord={hash:Hash;donor:Address;units:bigint;block:string};
export type EvmDonationPage={status:'available';chainId:EvmDonationChainId;start:string;through:string;anchor:Hash;records:EvmDonationRecord[];next:string|null;partial:boolean;unverified:number};
export type EvmDonationResult=EvmDonationPage|{status:'unconfigured'|'unavailable'};
export interface EvmDonationReader{read(chainId:EvmDonationChainId,signal:AbortSignal,cursor?:string):Promise<EvmDonationResult>}
/** Replaceable D1/provider/client index. It supplies discovery hashes, NEVER trusted amounts or balances. */
export interface EvmDonationIndex{page(chainId:EvmDonationChainId,recipient:Address,signal:AbortSignal,cursor?:string):Promise<unknown>}
export type NativeDonationProofPort=Pick<EvmGiftRpcPort,'chainId'|'head'|'blockHash'|'transaction'|'receipt'>;
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const zero=zeroAddress;
// No index is connected by default; do not scan entire chains in each browser,
// infer native payments from ERC-20 logs, or pretend unconfigured means zero.
export function createEvmDonationReader(options:{recipient:string|null;index?:EvmDonationIndex;rpc?:(chainId:EvmDonationChainId,signal:AbortSignal)=>NativeDonationProofPort}):EvmDonationReader{
  return {async read(chainId,cancellation,cursor){
    cancellation.throwIfAborted();
    const parsed=evmReceivingAddressSchema.safeParse(options.recipient);
    if(!parsed.success||!options.index||!options.rpc)return {status:'unconfigured'};
    if(!EVM_DONATION_NETWORKS.some(n=>n.chainId===chainId)||cursor!==undefined&&(cursor.length===0||cursor.length>256))return {status:'unavailable'};
    const recipient=parsed.data as Address,signal=AbortSignal.any([cancellation,AbortSignal.timeout(20000)]),check=()=>signal.throwIfAborted();
    try{
      const data=pageSchema.parse(await options.index.page(chainId,recipient,signal,cursor));check();
      if(data.chainId!==chainId||!same(data.recipient,recipient)||BigInt(data.start)>BigInt(data.through)||new Set(data.hashes.map(h=>h.toLowerCase())).size!==data.hashes.length)return {status:'unavailable'};
      const rpc=options.rpc(chainId,signal);
      const [network,head,anchor]=await Promise.all([rpc.chainId(),rpc.head(),rpc.blockHash(BigInt(data.through))]);check();
      // Twelve-block inclusion only, not independent consensus or L1 finality.
      if(network!==chainId||head<BigInt(data.through)+11n||!anchor||!same(anchor,data.anchor))return {status:'unavailable'};
      const records:EvmDonationRecord[]=[];let unverified=0;
      // Bounded pairs, never an unbounded RPC burst from an index response.
      for(const candidate of data.hashes){
        const [tx,receipt]=await Promise.all([rpc.transaction(candidate as Hash),rpc.receipt(candidate as Hash)]);check();
        if(!tx||!receipt||tx.chainId!==chainId||!same(tx.hash,candidate)||!same(receipt.hash,candidate)||receipt.status!=='success'||
          !tx.to||!same(tx.to,recipient)||!evmReceivingAddressSchema.safeParse(tx.from).success||same(tx.from,zero)||same(tx.from,recipient)||
          tx.input!=='0x'||typeof tx.value!=='bigint'||tx.value<=0n||tx.value>=(1n<<256n)||!tx.blockHash||!hash.safeParse(receipt.blockHash).success||!same(tx.blockHash,receipt.blockHash)||typeof receipt.blockNumber!=='bigint'||
          receipt.blockNumber<BigInt(data.start)||receipt.blockNumber>BigInt(data.through)) {unverified++;continue;}
        const canonical=await rpc.blockHash(receipt.blockNumber);check();
        if(!canonical||!same(canonical,receipt.blockHash)){unverified++;continue;}
        records.push({hash:candidate as Hash,donor:tx.from,units:tx.value,block:receipt.blockNumber.toString()});
      }
      // A failed/reorged source clears the page instead of publishing stale totals.
      const [finalNetwork,finalHead,finalAnchor]=await Promise.all([rpc.chainId(),rpc.head(),rpc.blockHash(BigInt(data.through))]);check();
      if(finalNetwork!==chainId||finalHead<BigInt(data.through)+11n||!finalAnchor||!same(finalAnchor,data.anchor))return {status:'unavailable'};
      return {status:'available',chainId,start:data.start,through:data.through,anchor:data.anchor as Hash,records,next:data.next,partial:!data.complete||data.next!==null||unverified>0,unverified};
    }catch{if(cancellation.aborted)cancellation.throwIfAborted();return {status:'unavailable'};}
  }};
}
// Rank within ONE chain/currency snapshot only. No USD oracle or ETH+BNB sum.
export function evmDonationRanks(records:EvmDonationRecord[]){
  const donors=new Map<string,{donor:Address;units:bigint;count:number}>(),seen=new Set<string>();
  for(const record of records){const id=record.hash.toLowerCase();if(seen.has(id))continue;seen.add(id);const key=record.donor.toLowerCase(),row=donors.get(key)??{donor:record.donor,units:0n,count:0};row.units+=record.units;row.count++;donors.set(key,row);}
  let rank=0,last:bigint|null=null;
  return [...donors.values()].sort((a,b)=>a.units===b.units?a.donor.toLowerCase().localeCompare(b.donor.toLowerCase()):a.units>b.units?-1:1).map((r,i)=>{if(r.units!==last)rank=i+1;last=r.units;return {...r,rank,amount:formatEther(r.units)};});
}
