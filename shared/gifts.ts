import { z } from 'zod';
import type { Player } from './protocol';
import { evmReceivingAddressSchema } from './profile';
import { SCENES } from './scenes';

export const giftTargetSchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('wallet'),personId:z.string().uuid(),family:z.enum(['evm','solana'])}).strict(),
  z.object({kind:z.literal('guest'),connectionId:z.string().uuid()}).strict(),
]);
export type GiftTarget=z.infer<typeof giftTargetSchema>;
export const giftRecipientRequestSchema=z.object({version:z.literal(1),target:giftTargetSchema,connectionId:z.string().uuid(),scene:z.enum(SCENES),channel:z.number().int().min(1).max(3)}).strict()
  .refine(value=>value.target.kind==='wallet'||value.target.connectionId===value.connectionId);
export type GiftRecipientRequest=z.infer<typeof giftRecipientRequestSchema>;
export function giftTargetFor(player:Player):GiftTarget{
  return player.identity?.kind==='wallet'?{kind:'wallet',personId:player.identity.personId,family:player.identity.family}:{kind:'guest',connectionId:player.id};
}
export function giftTargetKey(target:GiftTarget){return target.kind==='wallet'?`${target.family}:${target.personId}`:`guest:${target.connectionId}`;}

const availableRecipientSchema=z.object({
  status:z.literal('available'),target:giftTargetSchema,address:evmReceivingAddressSchema,
  revision:z.string().min(1).max(100),ownershipVerified:z.boolean(),
}).strict();
export const giftRecipientResultSchema=z.union([
  availableRecipientSchema,
  z.object({status:z.enum(['unconfigured','unpublished','disabled'])}).strict(),
]);
export type GiftRecipientResult=z.infer<typeof giftRecipientResultSchema>;
export type PublishedGiftRecipient=z.infer<typeof availableRecipientSchema>;
// Separate publication consent and a versioned lookup from private profile
// storage. Neither a nickname nor a public person ID is a payment address.
export interface PersonGiftRecipientAdapter{
  lookup(target:GiftTarget,signal:AbortSignal):Promise<GiftRecipientResult>;
}
export function validatedGiftRecipient(target:GiftTarget,input:unknown):GiftRecipientResult{
  const value=giftRecipientResultSchema.parse(input);
  if(value.status==='available'&&giftTargetKey(value.target)!==giftTargetKey(target))throw new Error('The receiving address did not match the selected person.');
  return value;
}

export const giftDraftSchema=z.object({
  amount:z.string().trim().min(1).max(116).regex(/^(?:0|[1-9]\d*)(?:\.\d+)?$/).refine(value=>/[1-9]/.test(value)),
  blessing:z.string().max(480).refine(value=>Array.from(value).length<=240).refine(value=>Array.from(value).every(c=>c.length!==1||c.charCodeAt(0)<0xd800||c.charCodeAt(0)>0xdfff)).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u),
}).strict();
export type GiftDraft=z.infer<typeof giftDraftSchema>;
export function giftAmountUnits(value:string,decimals:number):bigint{
  if(!Number.isInteger(decimals)||decimals<0||decimals>36)throw new Error('Unsupported token precision.');
  const amount=giftDraftSchema.parse({amount:value,blessing:''}).amount;
  const [whole,fraction='']=amount.split('.');
  if(fraction.length>decimals)throw new Error('The amount exceeds the configured token precision.');
  const units=BigInt(whole+fraction.padEnd(decimals,'0'));
  if(units<=0n||units>(1n<<256n)-1n)throw new Error('The amount is outside the supported token range.');
  return units;
}

// Replaceable execution boundary. The standard-EVM implementation is testnet-only;
// Robinhood mainnet uses a separately gated wallet-native Nitro adapter. Both
// are build-gated; blanks/default settings never enable payment.
export type GiftAsset={chainId:number;networkName:string;contract:string;symbol:string;decimals:number;configRevision:string};
export type GiftQuote={id:string;recipient:PublishedGiftRecipient;asset:GiftAsset;amount:bigint;estimatedGas:string;expiresAt:number};
export interface PersonGiftExecutionAdapter{
  prepare(input:{recipient:PublishedGiftRecipient;asset:GiftAsset;amount:bigint},signal:AbortSignal):Promise<GiftQuote>;
  revalidate(quote:GiftQuote,signal:AbortSignal):Promise<'unchanged'|'changed'>;
  submit(confirmedQuote:GiftQuote):Promise<{transactionHash:string}>;
  receipt(chainId:number,transactionHash:string,signal:AbortSignal):Promise<{status:'pending'|'confirmed'|'failed'|'unknown'}>;
}
