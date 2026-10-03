import {z} from 'zod';
import {voiceSignalSchema} from './voice';
import {socialPeerSchema} from './social';
export const COMMUNITY_PROTOCOL='ek-community-v1';
export const PARTY_LIMIT=4,PARTY_DURATION=20*60_000,PARTY_LEASE=12_000,PARTY_INVITE_TTL=45_000;
export const communityAdmissionSchema=z.object({accountId:z.string().min(1).max(100),sessionExpiresAt:z.number().int().positive()}).strict();
const id=z.string().uuid(),revision=z.number().int().nonnegative();
export const partyMemberSchema=socialPeerSchema.extend({color:z.string().regex(/^#[0-9a-fA-F]{6}$/),ready:z.boolean(),muted:z.boolean()}).strict();
export const partyViewSchema=z.object({id,revision,expiresAt:z.number().int().positive(),members:z.array(partyMemberSchema).min(1).max(PARTY_LIMIT)}).strict();
export const partyInvitationSchema=z.object({id,partyId:id,from:socialPeerSchema,expiresAt:z.number().int().positive(),members:z.array(partyMemberSchema).min(1).max(PARTY_LIMIT)}).strict();
export const partyClientSchema=z.discriminatedUnion('type',[
  z.object({v:z.literal(1),type:z.literal('community-ping')}).strict(),
  z.object({v:z.literal(1),type:z.literal('community-watch')}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-invite'),peer:id}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-answer'),invitationId:id,accept:z.boolean()}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-control'),partyId:id,action:z.enum(['ready','heartbeat','leave','mute']),muted:z.boolean().optional()}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-signal'),partyId:id,revision,peer:id,description:voiceSignalSchema.shape.description}).strict(),
]);
export const communityServerSchema=z.discriminatedUnion('type',[
  z.object({v:z.literal(1),type:z.literal('community-ready'),self:socialPeerSchema}).strict(),
  z.object({v:z.literal(1),type:z.literal('community-presence'),online:z.array(id).max(100)}).strict(),
  z.object({v:z.literal(1),type:z.literal('social-changed')}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-state'),party:partyViewSchema.nullable(),invitations:z.array(partyInvitationSchema).max(8),outgoing:z.array(z.object({id,peer:socialPeerSchema}).strict()).max(3)}).strict(),
  z.object({v:z.literal(1),type:z.literal('party-received'),partyId:id,revision,peer:id,description:voiceSignalSchema.shape.description}).strict(),
  z.object({v:z.literal(1),type:z.literal('community-error'),message:z.string().max(160)}).strict(),
]);
export type CommunityClient=z.infer<typeof partyClientSchema>;
export type CommunityServer=z.infer<typeof communityServerSchema>;
export type PartyMember=z.infer<typeof partyMemberSchema>;
export type PartyView=z.infer<typeof partyViewSchema>;
export type PartyInvitation=z.infer<typeof partyInvitationSchema>;
