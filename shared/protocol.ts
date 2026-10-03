import { z } from 'zod';
import { COLORS } from './world';
import {reportReasonSchema,reportReceiptSchema} from './reporting';
import {voiceInviteSchema,voiceControlSchema,voiceSignalSchema,voiceStateSchema,voiceReceivedSchema,voiceErrorSchema} from './voice';

export const nameSchema = z.string().trim().min(1).max(24).regex(/^[^\p{Cc}\p{Cf}<>]+$/u);
export const postureSchema = z.enum(['standing', 'prayer', 'confession', 'prostrate']);
export type Posture = z.infer<typeof postureSchema>;
export const publicIdentitySchema=z.discriminatedUnion('kind',[
  z.object({kind:z.literal('guest')}).strict(),
  z.object({kind:z.literal('wallet'),personId:z.string().uuid(),family:z.enum(['evm','solana'])}).strict(),
]);
export const playerSchema = z.object({
  id: z.string().uuid(), name: nameSchema, color: z.enum(COLORS),
  x: z.number().finite(), y: z.number().finite(),
  emote: z.enum(['peace', 'heart', 'pray', 'none']), emoteUntil: z.number(),
  posture: postureSchema.optional(),
  identity: publicIdentitySchema.optional(),
});
export const chatSchema = z.object({ id: z.string().uuid(), sender: z.string().uuid(), name: nameSchema, text: z.string().max(300), time: z.number() });
export const clientPacketSchema = z.discriminatedUnion('type', [
  voiceInviteSchema,voiceControlSchema,voiceSignalSchema,
  z.object({ v: z.literal(1), type: z.literal('profile'), name: nameSchema, color: z.enum(COLORS) }).strict(),
  z.object({ v: z.literal(1), type: z.literal('move'), x: z.number().finite().min(0).max(1200), y: z.number().finite().min(0).max(860) }).strict(),
  z.object({ v: z.literal(1), type: z.literal('chat'), text: z.string().trim().min(1).max(300).regex(/^[^\u0000-\u0008\u000b\u000c\u000e-\u001f]*$/u) }).strict(),
  z.object({ v: z.literal(1), type: z.literal('emote'), emote: z.enum(['peace', 'heart', 'pray']) }).strict(),
  z.object({ v: z.literal(1), type: z.literal('posture'), posture: postureSchema }).strict(),
  z.object({ v: z.literal(1), type: z.literal('ping') }).strict(),
  z.object({ v: z.literal(1), type: z.literal('refresh-profile') }).strict(),
  z.object({v:z.literal(1),type:z.literal('report'),requestId:z.string().uuid(),messageId:z.string().uuid(),reason:reportReasonSchema}).strict(),
]);
export const serverPacketSchema = z.discriminatedUnion('type', [
  voiceStateSchema,voiceReceivedSchema,voiceErrorSchema,
  z.object({ v: z.literal(1), type: z.literal('welcome'), self: z.string().uuid(), players: z.array(playerSchema).max(32), history: z.array(chatSchema).max(40),reviewConfigured:z.boolean().optional(),mutedUntil:z.number().optional() }),
  z.object({ v: z.literal(1), type: z.literal('player'), player: playerSchema }),
  z.object({ v: z.literal(1), type: z.literal('left'), id: z.string().uuid() }),
  z.object({ v: z.literal(1), type: z.literal('chat'), message: chatSchema }),
  z.object({ v: z.literal(1), type: z.literal('error'), message: z.string() }),
  z.object({ v: z.literal(1), type: z.literal('pong') }),
  z.object({v:z.literal(1),type:z.literal('report-receipt'),receipt:reportReceiptSchema}).strict(),
  z.object({v:z.literal(1),type:z.literal('chat-removed'),id:z.string().uuid()}).strict(),
  z.object({v:z.literal(1),type:z.literal('public-mute'),until:z.number().int().nonnegative()}).strict(),
]);
export type Player = z.infer<typeof playerSchema>;
export type ChatMessage = z.infer<typeof chatSchema>;
export type ClientPacket = z.infer<typeof clientPacketSchema>;
export type ServerPacket = z.infer<typeof serverPacketSchema>;
