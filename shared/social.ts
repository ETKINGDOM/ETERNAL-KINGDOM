import {z} from 'zod';
import {accountIdSchema} from './profile';
import {nameSchema} from './protocol';
import {SCENES} from './scenes';

export const PRIVATE_TTL=24*60*60_000,PRIVATE_LIMIT=100,INVITE_TTL=7*PRIVATE_TTL,CONTACT_LIMIT=100;
export const socialPeerSchema=z.object({personId:z.string().uuid(),name:nameSchema,family:z.enum(['evm','solana'])}).strict();
export type SocialPeer=z.infer<typeof socialPeerSchema>;
export const contactSchema=z.object({peer:socialPeerSchema,revision:z.number().int().nonnegative(),friend:z.enum(['none','incoming','outgoing','friends']),chat:z.enum(['closed','incoming','outgoing','open']),blocked:z.boolean(),available:z.boolean(),updatedAt:z.number()}).strict();
export type Contact=z.infer<typeof contactSchema>;
export const privateMessageSchema=z.object({id:z.string().uuid(),clientId:z.string().uuid(),sender:z.string().uuid(),text:z.string().max(400),time:z.number()}).strict();
export type PrivateMessage=z.infer<typeof privateMessageSchema>;
export const conversationSchema=z.object({contact:contactSchema,messages:z.array(privateMessageSchema).max(PRIVATE_LIMIT),syncPending:z.boolean()}).strict();
export type Conversation=z.infer<typeof conversationSchema>;
export const snapshotSchema=z.object({self:z.string().uuid(),contacts:z.array(contactSchema).max(CONTACT_LIMIT),selected:conversationSchema.nullable()}).strict();
export type SocialSnapshot=z.infer<typeof snapshotSchema>;
export const socialActionSchema=z.enum(['invite-friend','accept-friend','decline-friend','cancel-friend','remove-friend','invite-chat','accept-chat','decline-chat','cancel-chat','close-chat','block','unblock']);
export type SocialAction=z.infer<typeof socialActionSchema>;
const guard={accountId:accountIdSchema,sessionExpiresAt:z.number().int().positive()};
const target={peerId:z.string().uuid(),expectedRevision:z.number().int().nonnegative()};
export const socialRequestSchema=z.discriminatedUnion('kind',[
  z.object({...guard,kind:z.literal('snapshot'),peerId:z.string().uuid().optional()}).strict(),
  z.object({...guard,...target,kind:z.literal('action'),action:socialActionSchema,scene:z.enum(SCENES),channel:z.number().int().min(1).max(3)}).strict(),
  z.object({...guard,...target,kind:z.literal('message'),clientId:z.string().uuid(),text:z.string().trim().min(1).max(400).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u),scene:z.enum(SCENES).optional(),channel:z.number().int().min(1).max(3).optional()}).strict(),
]);
export type SocialRequest=z.infer<typeof socialRequestSchema>;
export type PairCommand=Extract<SocialRequest,{kind:'action'|'message'}>;
export interface PrivateSocialAdapter{snapshot(request:Extract<SocialRequest,{kind:'snapshot'}>,signal?:AbortSignal):Promise<SocialSnapshot>;change(request:PairCommand,signal?:AbortSignal):Promise<Conversation>}
// Person IDs are references, never authorization or receiving addresses.
export const socialPairKey=(a:string,b:string)=>[a,b].sort().join(':');
