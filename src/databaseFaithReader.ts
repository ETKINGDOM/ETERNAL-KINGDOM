import {releaseHeaders} from './releaseScope';
import {databaseResultSchema,publicFaithDatabaseConfiguration,faithSyncRequestSchema} from '../shared/publicFaithDatabase';
import {createFaithRecordReader,type FaithRecordReader} from './faithRecordFeed';
import type {ChainSettings} from '../shared/chainConfiguration';
import services from '#ek-services-settings' with {type:'json'};
import {createIndexedFaithReader} from './indexedFaithReader';

export function createDatabaseFaithReader(settings:ChainSettings,direct:FaithRecordReader=createFaithRecordReader(settings),request:typeof fetch=fetch):FaithRecordReader{
  const configured=publicFaithDatabaseConfiguration(settings);
  return {sharedIndex:!!configured,database:!!configured,async read(input){
    // Retained independent chain/personal interface. Service failure deliberately
    // does not fan out to RPC requests from every viewer.
    if(input.author||!configured||input.before&&!input.before.startsWith('index:'))return direct.read(input);
    try{
      const response=await request('/api/public-faith',{method:'POST',headers:{'Content-Type':'application/json',...releaseHeaders(settings)},credentials:'same-origin',cache:'no-store',
        signal:AbortSignal.any([input.signal,AbortSignal.timeout(10000)]),body:JSON.stringify(input.before?{before:input.before}:{})});
      if(!response.ok)return {status:'unavailable'};
      const text=await response.text();if(text.length>524288)return {status:'unavailable'};
      const result=databaseResultSchema.safeParse(JSON.parse(text));if(!result.success)return {status:'unavailable'};
      const page=result.data;
      if(page.status==='available'){
        if(page.network!==configured.network.name||page.chainId!==configured.network.chainId||BigInt(page.from)>BigInt(page.to))return {status:'unavailable'};
        if(page.records.some(r=>r.contract.toLowerCase()!==(r.kind==='prayer'?configured.prayer:configured.holder)?.toLowerCase()||BigInt(r.blockNumber)<configured.floor||BigInt(r.blockNumber)>BigInt(page.to)))return {status:'unavailable'};
      }
      return page;
    }catch(error){if(input.signal.aborted)throw error;return {status:'unavailable'};}
  }};
}
export function createPublicFaithReader(settings:ChainSettings):FaithRecordReader{
  switch(services.publicFaith.source){
    case 'database':return createDatabaseFaithReader(settings);
    case 'chain-index':return createIndexedFaithReader(settings);
    case 'chain':return createFaithRecordReader(settings);
    default:return {read:async()=>({status:'unconfigured'})};
  }
}

// No faith envelope, account, draft, key or microphone data crosses this API.
// A queue acknowledgement is never a chain confirmation. Best-effort cache
// notification cannot change the verified completion/effect or resend funds.
export async function notifyPublicFaithTransaction(transactionHash:string,request:typeof fetch=fetch):Promise<boolean>{
  const input=faithSyncRequestSchema.safeParse({transactionHash});if(!input.success)return false;
  try{const response=await request('/api/public-faith/sync',{method:'POST',headers:{'Content-Type':'application/json',...releaseHeaders()},credentials:'same-origin',cache:'no-store',keepalive:true,
    signal:AbortSignal.timeout(5000),body:JSON.stringify(input.data)});return response.ok;}catch{return false;}
}
export function notifyConfiguredFaithTransaction(settings:ChainSettings,proof:{chainId:number;contract:string},hash:string){
  try{
    const configured=publicFaithDatabaseConfiguration(settings);if(!configured||proof.chainId!==configured.network.chainId||![configured.prayer,configured.holder].some(c=>c?.toLowerCase()===proof.contract.toLowerCase()))return;
    void notifyPublicFaithTransaction(hash);
  }catch{/* An ancillary read-service failure cannot relabel a returned wallet hash or suppress verified feedback. */}
}
