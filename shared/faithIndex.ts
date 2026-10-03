import {z} from 'zod';
import type {ChainSettings} from './chainConfiguration';
import services from '#ek-services-settings' with {type:'json'};
import {approvedPrayerCodeHash,approvedHolderCodeHash} from './approvedFaithRuntime';

// Exact deployed append-only runtimes audited with the protected contract
// sources. A new/mutable runtime needs explicit read-adapter review; do not
// silently assume that an arbitrary owner-supplied code pin is immutable.

const decimal=z.string().regex(/^(0|[1-9][0-9]{0,19})$/),hash=z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(v=>v as `0x${string}`),address=z.string().regex(/^0x[0-9a-fA-F]{40}$/).transform(v=>v as `0x${string}`);
export const indexCursorSchema=z.string().regex(/^index:[0-9]{20}:[0-9]{10}:0x[0-9a-f]{40}:0x[0-9a-f]{64}$/);
export const indexRequestSchema=z.object({before:indexCursorSchema.optional()}).strict();
export const publicSacredRecordSchema=z.object({id:z.string().regex(/^0x[0-9a-f]{40}:0x[0-9a-f]{64}$/),kind:z.enum(['prayer','confession','praise']),
  name:z.string().min(1).max(100),words:z.string().max(12000),encrypted:z.boolean(),anonymous:z.boolean(),createdAt:z.string().datetime(),
  transactionHash:hash,contract:address,blockNumber:decimal,eventIndex:z.number().int().min(0).max(9999999999).optional()}).strict().superRefine((r,ctx)=>{
    if(r.encrypted&&r.words!=='*****')ctx.addIssue({code:'custom',message:'Unmasked words'});
    if(r.anonymous&&r.name!=='Anonymous'&&(!r.name.endsWith('*****')||Array.from(new Intl.Segmenter(undefined,{granularity:'grapheme'}).segment(r.name.slice(0,-5))).length!==1))ctx.addIssue({code:'custom',message:'Unmasked name'});
    if(!r.id.startsWith(r.contract.toLowerCase()+':'))ctx.addIssue({code:'custom',message:'Wrong record source'});
  });
export const indexPageSchema=z.object({status:z.literal('available'),network:z.string().min(1).max(100),chainId:z.number().int().positive(),from:decimal,to:decimal,
  olderBefore:indexCursorSchema.nullable(),records:z.array(publicSacredRecordSchema).max(32),unchecked:z.number().int().nonnegative(),unverified:z.number().int().nonnegative(),
  missing:z.array(z.enum(['prayer','holder'])).max(2),indexing:z.boolean()}).strict();
export const indexResultSchema=z.union([indexPageSchema,z.object({status:z.enum(['unavailable','unconfigured'])}).strict()]);
export function faithIndexConfiguration(settings:ChainSettings){
  if(settings.status!=='valid'||!settings.config.network)return null;
  const {network,faithRecords,godTokenContract,release}=settings.config,index=release?.startBlock?{chainId:network.chainId,prayerContract:faithRecords.contract!,startBlock:release.startBlock}:services.faithIndex;
  if(settings.config.mode==='showcase'||!index||release&&!release.startBlock)return null;
  if(network.chainId!==index.chainId||faithRecords.contract?.toLowerCase()!==index.prayerContract.toLowerCase()||!faithRecords.prayerCodeHash)return null;
  if(faithRecords.prayerCodeHash.toLowerCase()!==approvedPrayerCodeHash||faithRecords.holderContract&&(!godTokenContract||faithRecords.holderCodeHash?.toLowerCase()!==approvedHolderCodeHash(godTokenContract,release?.tokenDecimals??18)))return null;
  return {floor:BigInt(index.startBlock),network,prayer:faithRecords.contract,
    fingerprint:JSON.stringify(['public-projection-v4-paced-append-only-proof',network,faithRecords.contract,faithRecords.prayerCodeHash,faithRecords.holderContract,faithRecords.holderCodeHash,godTokenContract,index.startBlock,...(release?[release.id]:[])])};
}
export const indexOrder=(block:string)=>BigInt(block).toString().padStart(20,'0');
export const indexPosition=(record:{blockNumber:string;eventIndex?:number})=>`${indexOrder(record.blockNumber)}:${(record.eventIndex??0).toString().padStart(10,'0')}`;
export function indexCursor(record:{blockNumber:string;eventIndex?:number;id:string}){return indexCursorSchema.parse(`index:${indexPosition(record)}:${record.id}`);}
