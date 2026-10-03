import {releaseHeaders} from './releaseScope';
import {indexResultSchema,faithIndexConfiguration} from '../shared/faithIndex';
import {createFaithRecordReader,type FaithRecordReader} from './faithRecordFeed';
import type {ChainSettings} from '../shared/chainConfiguration';

// A replaceable public-projection cache, never an author lookup or submission.
// A failed service is not proof of an empty chain; direct reading stays available.
export function createIndexedFaithReader(settings:ChainSettings,direct:FaithRecordReader=createFaithRecordReader(settings),request:typeof fetch=fetch):FaithRecordReader{
  const configured=faithIndexConfiguration(settings);
  return {sharedIndex:!!configured,async read(input){
    if(input.author||!configured||input.before&&!input.before.startsWith('index:'))return direct.read(input);
    const response=await request('/api/faith-feed',{method:'POST',headers:{'Content-Type':'application/json',...releaseHeaders(settings)},credentials:'same-origin',cache:'no-store',
      signal:AbortSignal.any([input.signal,AbortSignal.timeout(10000)]),body:JSON.stringify(input.before?{before:input.before}:{})});
    if(!response.ok)return {status:'unavailable'};
    const bytes=await response.text();if(bytes.length>524288)return {status:'unavailable'};
    const parsed=indexResultSchema.safeParse(JSON.parse(bytes));if(!parsed.success)return {status:'unavailable'};
    const page=parsed.data;
    if(page.status==='available'){
      if(page.chainId!==configured.network.chainId||page.network!==configured.network.name)return {status:'unavailable'};
      const contracts=settings.status==='valid'?[settings.config.faithRecords.contract,settings.config.faithRecords.holderContract].filter(Boolean).map(c=>c!.toLowerCase()):[];
      if(page.records.some(r=>!contracts.includes(r.contract.toLowerCase())||BigInt(r.blockNumber)<configured.floor||BigInt(r.blockNumber)>BigInt(page.to)))return {status:'unavailable'};
      if(settings.status==='valid'&&page.records.some(r=>r.contract.toLowerCase()!==(r.kind==='prayer'?settings.config.faithRecords.contract:settings.config.faithRecords.holderContract)?.toLowerCase()))return {status:'unavailable'};
    }
    return page;
  }};
}
