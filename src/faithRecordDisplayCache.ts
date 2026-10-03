import type {FaithFeedPage,FaithRecordReader} from './faithRecordFeed';

export const SHARED_RECORD_DISPLAY_TTL=20_000;
// Only the masked public projection, briefly in this tab's memory. No personal
// lookup, draft, raw envelope, localStorage, server index or background polling.
const recent=new WeakMap<FaithRecordReader,{page:FaithFeedPage;checkedAt:number}>();
export function forgetSharedRecords(reader:FaithRecordReader){recent.delete(reader);}
export function rememberSharedRecords(reader:FaithRecordReader,page:FaithFeedPage,now=Date.now()){
  const records=page.records.map(r=>({id:r.id,kind:r.kind,name:r.name,words:r.encrypted?'*****':r.words,
    encrypted:r.encrypted,anonymous:r.anonymous,createdAt:r.createdAt,
    transactionHash:r.transactionHash,contract:r.contract,blockNumber:r.blockNumber}));
  recent.set(reader,{page:{status:'available',network:page.network,chainId:page.chainId,from:page.from,to:page.to,
    olderBefore:page.olderBefore,records,unchecked:page.unchecked,unverified:page.unverified,missing:[...page.missing]},checkedAt:now});
}
export function recentSharedRecords(reader:FaithRecordReader,now=Date.now()){
  const entry=recent.get(reader);
  if(!entry)return null;
  if(now<entry.checkedAt||now-entry.checkedAt>=SHARED_RECORD_DISPLAY_TTL){recent.delete(reader);return null;}
  return entry;
}
