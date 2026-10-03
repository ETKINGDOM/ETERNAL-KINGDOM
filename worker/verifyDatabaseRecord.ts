import type {Hash} from 'viem';
import type {ChainSettings} from '../shared/chainConfiguration';
import {publicFaithDatabaseConfiguration} from '../shared/publicFaithDatabase';
import {createFaithRecordReader,faithFeedPorts,type SacredRecord,type FaithFeedPorts} from '../src/faithRecordFeed';
import type {RpcFetch} from '../shared/rpcFetch';

export type DatabaseVerification={status:'verified';records:SacredRecord[];anchorHash:Hash}|{status:'pending'|'unavailable'|'rejected'};
// Hash-only hint -> bounded block proof. Neither a browser's claimed success nor
// a supplied name/text/amount is evidence. The original receipt validators stay
// intact. No genesis scan, broadcast, wallet request, plaintext log or tracing.
export async function verifyDatabaseRecord(settings:ChainSettings,endpoint:string,transactionHash:Hash,signal:AbortSignal,fetchFn?:RpcFetch,factory:(url:string,signal:AbortSignal,fetchFn?:RpcFetch)=>FaithFeedPorts=faithFeedPorts,onReadFailure?:(error:unknown)=>void):Promise<DatabaseVerification>{
  const configured=publicFaithDatabaseConfiguration(settings);if(!configured)return {status:'rejected'};
  const ports=factory(endpoint,signal,fetchFn);
  if(await ports.prayer.chainId()!==configured.network.chainId)return {status:'unavailable'};
  const receipt=await ports.prayer.receipt(transactionHash);signal.throwIfAborted();
  if(!receipt)return {status:'pending'};
  if(receipt.hash.toLowerCase()!==transactionHash.toLowerCase()||receipt.status!=='success'||receipt.blockNumber<configured.floor)return {status:'rejected'};
  const sources=[configured.prayer,configured.holder].filter(Boolean).map(v=>v!.toLowerCase());
  if(!receipt.logs.some(log=>sources.includes(log.address.toLowerCase())))return {status:'rejected'};
  if(await ports.prayer.head()<receipt.blockNumber+2n)return {status:'pending'};
  const reader=createFaithRecordReader(settings,()=>ports,{windowBlocks:1n,floor:configured.floor,transactionHash,checkLimit:12,retryReadFailures:true,appendOnlyStateAtHead:true,timeoutMs:60000,onReadFailure});
  const result=await reader.read({signal,before:(receipt.blockNumber+1n).toString()});
  if(result.status!=='available')return {status:'unavailable'};
  if(result.unchecked||result.unverified||!result.records.length||!result.anchorHash)return {status:'rejected'};
  if(result.anchorHash.toLowerCase()!==receipt.blockHash.toLowerCase()||result.records.some(r=>r.transactionHash.toLowerCase()!==transactionHash.toLowerCase()))return {status:'rejected'};
  return {status:'verified',records:result.records,anchorHash:result.anchorHash};
}
