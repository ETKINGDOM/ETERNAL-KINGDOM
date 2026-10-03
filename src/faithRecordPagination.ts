import type {FaithFeedPage} from './faithRecordFeed';
export const PUBLIC_RECORD_PAGE_SIZE=10;
export const PUBLIC_RECORD_EXPAND_SIZE=5;
export function appendRecordPage(previous:FaithFeedPage,next:FaithFeedPage):FaithFeedPage{
  if(previous.chainId!==next.chainId||previous.network!==next.network)throw Error('Record source changed');
  const seen=new Set(previous.records.map(r=>r.id));
  return {...next,from:BigInt(previous.from)<BigInt(next.from)?previous.from:next.from,to:BigInt(previous.to)>BigInt(next.to)?previous.to:next.to,
    records:[...previous.records,...next.records.filter(r=>{if(seen.has(r.id))return false;seen.add(r.id);return true;})]};
}
