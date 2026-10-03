import {z} from 'zod';
import type {ChainSettings} from './chainConfiguration';
import {faithIndexConfiguration,indexPageSchema,publicSacredRecordSchema} from './faithIndex';

export const faithSyncRequestSchema=z.object({transactionHash:z.string().regex(/^0x[0-9a-fA-F]{64}$/).transform(v=>v.toLowerCase() as `0x${string}`)}).strict();
export const databasePageSchema=indexPageSchema.extend({source:z.literal('database'),verifiedAt:z.string().datetime().nullable(),historicalImport:z.boolean()}).strict();
export const databaseResultSchema=z.union([databasePageSchema,z.object({status:z.enum(['unavailable','unconfigured'])}).strict()]);
export const publicFaithSeedSchema=z.object({version:z.literal(1),scope:z.string().max(1000),verifiedAt:z.string().datetime(),throughBlock:z.string().regex(/^[0-9]{1,20}$/),anchorHash:z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  records:z.array(publicSacredRecordSchema).max(128)}).strict();

// Partition instead of deleting records on configuration changes. RPC URLs,
// timestamps and reader revisions are not identity; deployed sources are.
export function publicFaithDatabaseConfiguration(settings:ChainSettings){
  const index=faithIndexConfiguration(settings);if(!index||settings.status!=='valid')return null;
  const faith=settings.config.faithRecords;
  return {...index,holder:faith.holderContract,scope:JSON.stringify(['public-faith-db-v1',index.network.chainId,faith.contract?.toLowerCase(),faith.prayerCodeHash?.toLowerCase(),faith.holderContract?.toLowerCase()??null,faith.holderCodeHash?.toLowerCase()??null,settings.config.godTokenContract?.toLowerCase()??null,...(settings.config.release?[settings.config.release.id]:[])])};
}
