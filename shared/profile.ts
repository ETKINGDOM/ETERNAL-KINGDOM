import { z } from 'zod';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { nameSchema } from './protocol';
import { COLORS } from './world';
import { isSolanaAddress } from './solanaIdentity';

export const appearanceSchema=z.object({name:nameSchema,color:z.enum(COLORS)}).strict();
export type Appearance=z.infer<typeof appearanceSchema>;
export const DEFAULT_APPEARANCE:Appearance={name:'Pilgrim',color:COLORS[0]};
export const accountIdSchema=z.string().max(90).refine(value=>/^evm:0x[0-9a-f]{40}$/.test(value)||value.startsWith('solana:')&&isSolanaAddress(value.slice(7)));
export const evmReceivingAddressSchema=z.string().trim().refine(value=>isAddress(value)&&value.toLowerCase()!==zeroAddress).transform(value=>getAddress(value));
const revisionSchema=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1);
export const accountProfileSchema=z.object({
  version:z.literal(1),accountId:accountIdSchema,revision:revisionSchema,
  appearance:appearanceSchema,
  evmRecipient:z.object({address:evmReceivingAddressSchema,ownershipVerified:z.literal(false)}).strict().nullable(),
  // Older stored profiles have never consented to publication.
  giftPublication:z.enum(['private','published','disabled']).default('private'),
  updatedAt:z.number().int().positive().nullable(),
}).strict();
export type AccountProfile=z.infer<typeof accountProfileSchema>;
export function emptyAccountProfile(accountId:string):AccountProfile{return {version:1,accountId,revision:0,appearance:{...DEFAULT_APPEARANCE},evmRecipient:null,giftPublication:'private',updatedAt:null};}
// Derive only from the authenticated account routing key, never an arbitrary
// client draft. A read does not persist a migration or grant public consent.
export function withDefaultEvmRecipient(profile:AccountProfile):AccountProfile{
  if(profile.evmRecipient||!/^evm:0x[0-9a-f]{40}$/.test(profile.accountId))return profile;
  const parsed=evmReceivingAddressSchema.safeParse(profile.accountId.slice(4));
  if(!parsed.success)return profile;
  return {...profile,evmRecipient:{address:parsed.data,ownershipVerified:false},
    giftPublication:profile.giftPublication==='published'?'private':profile.giftPublication};
}
export const profileReadSchema=z.object({accountId:accountIdSchema}).strict();
const mutationBase={accountId:accountIdSchema,expectedRevision:revisionSchema};
export const profileMutationSchema=z.discriminatedUnion('kind',[
  z.object({...mutationBase,kind:z.literal('appearance'),appearance:appearanceSchema}).strict(),
  z.object({...mutationBase,kind:z.literal('recipient'),address:evmReceivingAddressSchema.nullable(),confirmed:z.literal(true)}).strict(),
  z.object({...mutationBase,kind:z.literal('gift-publication'),mode:z.enum(['private','published','disabled']),address:evmReceivingAddressSchema.nullable(),confirmed:z.literal(true)}).strict()
    .refine(value=>value.mode==='published'?value.address!==null:value.address===null),
]);
export type ProfileMutation=z.infer<typeof profileMutationSchema>;
export type ProfileSaveResult={status:'saved';profile:AccountProfile}|{status:'conflict'}|{status:'rate-limited'};
export interface AccountProfileAdapter {
  load(accountId:string,signal?:AbortSignal):Promise<AccountProfile>;
  save(change:ProfileMutation,signal?:AbortSignal):Promise<AccountProfile>;
}
// Hosted profiles are not portable identity proofs. The current archive is appearance
// only. Any future recipient import must authenticate the target wallet and re-confirm
// the address, never trust an archive's accountId or asserted ownership/permissions.
export interface ProfileArchiveAdapter {
  exportProfile(accountId:string):Promise<Blob>;
  previewImport(archive:Blob):Promise<{appearance:Appearance;proposedEvmAddress:string|null}>;
}
