import {z} from 'zod';
import {accountIdSchema} from './profile';
import {chatSchema,nameSchema} from './protocol';
import {reportReasonSchema} from './reporting';
import {SCENES} from './scenes';
const scope={accountId:accountIdSchema,sessionExpiresAt:z.number().int().positive(),scene:z.enum(SCENES),channel:z.number().int().min(1).max(3)};
export const reviewDecisionSchema=z.enum(['dismiss','hide-message','mute-15m']);
export type ReviewDecision=z.infer<typeof reviewDecisionSchema>;
export const moderationRequestSchema=z.discriminatedUnion('kind',[
  z.object({...scope,kind:z.literal('list'),before:z.number().int().positive().optional()}).strict(),
  z.object({...scope,kind:z.literal('review'),reportId:z.string().uuid(),expectedRevision:z.number().int().nonnegative(),decision:reviewDecisionSchema,confirmed:z.literal(true)}).strict(),
  z.object({...scope,kind:z.literal('unmute'),subject:z.string().regex(/^(wallet|guest):[0-9a-f-]{36}$/),expectedUntil:z.number().int().positive(),confirmed:z.literal(true)}).strict(),
]);
export type ModerationRequest=z.infer<typeof moderationRequestSchema>;
export type ModerationMutation=Exclude<ModerationRequest,{kind:'list'}>;
export const reviewReportSchema=z.object({id:z.string().uuid(),sequence:z.number().int(),message:chatSchema,reason:reportReasonSchema,createdAt:z.number(),revision:z.number().int(),outcome:z.enum(['open','dismiss','hide-message','mute-15m']),targetKind:z.enum(['wallet','guest','unknown'])}).strict();
export type ReviewReport=z.infer<typeof reviewReportSchema>;
export const roomMuteSchema=z.object({subject:z.string(),name:nameSchema,until:z.number(),kind:z.enum(['wallet','guest'])}).strict();
export type RoomMute=z.infer<typeof roomMuteSchema>;
export const auditSchema=z.object({id:z.string().uuid(),actor:z.string(),action:z.enum(['dismiss','hide-message','mute-15m','unmute']),reportId:z.string().uuid().nullable(),time:z.number()}).strict();
export const moderationSnapshotSchema=z.object({reports:z.array(reviewReportSchema).max(50),nextBefore:z.number().int().nullable(),mutes:z.array(roomMuteSchema).max(500),audit:z.array(auditSchema).max(50)}).strict();
export type ModerationSnapshot=z.infer<typeof moderationSnapshotSchema>;
export interface RoomModerationAdapter{read(request:Extract<ModerationRequest,{kind:'list'}>,signal?:AbortSignal):Promise<ModerationSnapshot>;change(request:ModerationMutation,signal?:AbortSignal):Promise<void>}
