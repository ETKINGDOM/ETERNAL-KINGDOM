import {createPublicClient,http,keccak256,decodeEventLog,TransactionNotFoundError,TransactionReceiptNotFoundError,type Address,type Hash,type Hex} from 'viem';
import type {ChainSettings} from '../shared/chainConfiguration';
import {holderFaithAbi,holderFaithPayloadSchema,type HolderFaithPayload} from '../shared/holderFaithRecords';
import {holderFaithConfiguration,holderFaithReadPort,prepareHolderFaithRecord,type HolderFaithPreparation,type HolderFaithReadPort} from './holderFaithReadiness';
import type {PrayerWalletPort} from './prayerChain';
import type {GiftReceipt,GiftTransaction} from './evmGiftPorts';

const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const validHash=(value:string)=>/^0x[0-9a-fA-F]{64}$/.test(value);
export type HolderFaithProof=HolderFaithPreparation&{network:string;rpcUrl:string};
// Read-side evidence does not invent a current balance or token metadata.
export type HolderFaithEvidence=Pick<HolderFaithProof,'chainId'|'contract'|'codeHash'|'payer'|'payloadHash'|'recordId'|'data'|'bytes'|'kindCode'>;
export type HolderFaithReceipt={status:'pending'|'confirmed'|'failed'|'unknown'};
export interface HolderFaithRpcPort extends HolderFaithReadPort{
  simulate(proof:HolderFaithProof):Promise<Hash>;gas(proof:HolderFaithProof):Promise<bigint>;
  receipt(hash:Hash):Promise<GiftReceipt|null>;transaction(hash:Hash):Promise<GiftTransaction|null>;
  head():Promise<bigint>;blockHash(number:bigint):Promise<Hash|null>;
  stored(proof:HolderFaithEvidence,blockNumber:bigint):Promise<readonly [Address,bigint,number,Hex]>;
}
export function holderFaithRpc(url:string,signal:AbortSignal):HolderFaithRpcPort{
  const client=createPublicClient({ccipRead:false,transport:http(url,{retryCount:0,timeout:8000,maxResponseBodySize:262144,fetchOptions:{signal,credentials:'omit',referrerPolicy:'no-referrer'}})});
  const args=(p:HolderFaithProof)=>({address:p.contract,abi:holderFaithAbi,functionName:'recordFaith' as const,args:[p.kindCode,p.bytes] as const,account:p.payer});
  return {...holderFaithReadPort(url,signal),simulate:async p=>(await client.simulateContract(args(p))).result,gas:p=>client.estimateContractGas(args(p)),
    async receipt(hash){try{const r=await client.getTransactionReceipt({hash});return {hash:r.transactionHash,blockHash:r.blockHash,blockNumber:r.blockNumber,status:r.status,logs:r.logs};}catch(e){if(e instanceof TransactionReceiptNotFoundError)return null;throw e;}},
    async transaction(hash){try{const t=await client.getTransaction({hash});return {hash:t.hash,chainId:t.chainId,from:t.from,to:t.to,input:t.input,value:t.value,blockHash:t.blockHash};}catch(e){if(e instanceof TransactionNotFoundError)return null;throw e;}},
    head:()=>client.getBlockNumber({cacheTime:0}),blockHash:async blockNumber=>(await client.getBlock({blockNumber})).hash,
    stored:(p,blockNumber)=>client.readContract({address:p.contract,abi:holderFaithAbi,functionName:'readFaith',args:[p.recordId],blockNumber}),
  };
}
export function createHolderFaithSubmission(options:{settings:()=>ChainSettings;scope:()=>string|null;wallet:PrayerWalletPort;rpc?:(url:string,signal:AbortSignal)=>HolderFaithRpcPort}){
  const lifetime=new AbortController();let used=false;
  return {dispose(){lifetime.abort();},async submit(payload:HolderFaithPayload,onPrepared:(proof:HolderFaithProof)=>void):Promise<{hash:Hash;proof:HolderFaithProof}>{
    if(used)throw Error('Review before another attempt.');used=true;
    const settings=options.settings(),config=holderFaithConfiguration(settings),scope=options.scope();
    if(!config?.broadcast||!scope)throw Error('Holder faith broadcasting is disabled.');
    const snapshot=holderFaithPayloadSchema.parse(payload);Object.freeze(snapshot);if(snapshot.visibility==='encrypted')Object.freeze(snapshot.encryption);
    const signal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(20000)]);
    const check=()=>{signal.throwIfAborted();const c=holderFaithConfiguration(options.settings());if(!c?.broadcast||c.configRevision!==config.configRevision||options.scope()!==scope)throw Error('Faith record context changed.');};
    const account=await options.wallet.current();check();if(account.chainId!==config.chainId)throw Error('Select the configured network in your wallet.');
    const rpc=(options.rpc??holderFaithRpc)(config.rpcUrl,signal);
    const prepared=await prepareHolderFaithRecord(settings,account.address,snapshot,signal,()=>rpc);check();
    const proof:HolderFaithProof=Object.freeze({...prepared,network:config.networkName,rpcUrl:config.rpcUrl});
    const [simulated,gas]=await Promise.all([rpc.simulate(proof),rpc.gas(proof)]);check();
    if(simulated!==proof.recordId||gas<=0n||gas>30_000_000n)throw Error('Holder faith simulation failed.');
    if(await rpc.chainId()!==config.chainId)throw Error('RPC network changed.');check();
    const code=await rpc.bytecode(config.contract);check();if(!code||keccak256(code as Hex)!==config.codeHash)throw Error('Record code changed.');
    const current=await options.wallet.current();check();
    if(current.revision!==account.revision||current.chainId!==account.chainId||!same(current.address,account.address))throw Error('Wallet changed.');
    onPrepared(proof);check();let prompted=false;
    try{
      const hash=await options.wallet.send(proof,account,()=>{check();prompted=true;});
      // A native prompt may broadcast even after composer closure. Preserve hash.
      if(!validHash(hash))throw Error('Uncertain submission');return {hash,proof};
    }catch(e){
      if(!prompted)throw Error('Preparation changed. Nothing was requested.');
      if(typeof e==='object'&&e!==null&&'code' in e&&e.code===4001)throw Error('You cancelled the wallet confirmation.');
      throw Error('Submission is uncertain. Check your wallet before resending.');
    }
  }};
}
// Verifies original immutable evidence, independently of current wallet/balance.
// Three blocks are provisional L2 inclusion, not rollup L1 settlement.
export async function verifyHolderFaithReceipt(rpc:HolderFaithRpcPort,p:HolderFaithEvidence,hash:Hash,signal:AbortSignal):Promise<HolderFaithReceipt>{
  signal.throwIfAborted();if(!validHash(hash))return {status:'unknown'};
  try{
    if(await rpc.chainId()!==p.chainId)return {status:'unknown'};
    const receipt=await rpc.receipt(hash);signal.throwIfAborted();if(!receipt)return {status:'pending'};
    const tx=await rpc.transaction(hash);signal.throwIfAborted();
    if(!tx||!same(tx.hash,hash)||!same(receipt.hash,hash)||tx.chainId!==p.chainId||!same(tx.from,p.payer)||!tx.to||!same(tx.to,p.contract)||!same(tx.input,p.data)||tx.value!==0n||
      !tx.blockHash||!same(tx.blockHash,receipt.blockHash)||!validHash(receipt.blockHash)||receipt.blockNumber<0n)return {status:'unknown'};
    const [block,head,code]=await Promise.all([rpc.blockHash(receipt.blockNumber),rpc.head(),rpc.bytecode(p.contract)]);signal.throwIfAborted();
    if(!code||keccak256(code as Hex)!==p.codeHash)return {status:'unknown'};
    if(!block||!same(block,receipt.blockHash)||head<receipt.blockNumber||head-receipt.blockNumber+1n<3n)return {status:'pending'};
    if(receipt.status==='reverted')return {status:'failed'};
    const matches=receipt.logs.filter(log=>{
      if(!same(log.address,p.contract))return false;
      try{const event=decodeEventLog({abi:holderFaithAbi,data:log.data,topics:log.topics as [Hex,...Hex[]],strict:true});return event.eventName==='FaithRecorded'&&same(event.args.recordId,p.recordId)&&same(event.args.author,p.payer)&&event.args.kind===p.kindCode&&same(event.args.payloadHash,p.payloadHash);}catch{return false;}
    });
    if(receipt.status!=='success'||matches.length!==1)return {status:'unknown'};
    const stored=await rpc.stored(p,receipt.blockNumber);signal.throwIfAborted();
    if(!same(stored[0],p.payer)||stored[1]<=0n||stored[2]!==p.kindCode||!same(stored[3],p.bytes)||keccak256(stored[3])!==p.payloadHash)return {status:'unknown'};
    if(await rpc.chainId()!==p.chainId)return {status:'unknown'};
    const finalBlock=await rpc.blockHash(receipt.blockNumber);signal.throwIfAborted();
    return {status:finalBlock&&same(finalBlock,receipt.blockHash)?'confirmed':'pending'};
  }catch(e){if(signal.aborted)throw e;return {status:'unknown'};}
}
