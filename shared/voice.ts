import {z} from 'zod';
export const VOICE_INVITE_TTL=45_000,VOICE_LEASE=12_000;
// Signaling only. Never accept audio, recordings, faith text or arbitrary targets.
const sdp=z.string().max(16_000).refine(value=>{
  const media=value.split(/\r?\n/).filter(line=>line.startsWith('m='));
  return value.startsWith('v=0')&&media.length===1&&media[0].startsWith('m=audio ');
},'Audio-only SDP required');
export const voiceInviteSchema=z.object({v:z.literal(1),type:z.literal('voice-invite'),peer:z.string().uuid()}).strict();
export const voiceControlSchema=z.object({v:z.literal(1),type:z.literal('voice-control'),callId:z.string().uuid(),action:z.enum(['accept','ready','heartbeat','leave'])}).strict();
export const voiceSignalSchema=z.object({v:z.literal(1),type:z.literal('voice-signal'),callId:z.string().uuid(),description:z.object({type:z.enum(['offer','answer']),sdp}).strict()}).strict();
export const voiceStateSchema=z.object({v:z.literal(1),type:z.literal('voice-state'),callId:z.string().uuid(),peer:z.string().uuid(),phase:z.enum(['outgoing','incoming','accepted','ended']),initiator:z.boolean(),peerReady:z.boolean()}).strict();
export const voiceReceivedSchema=z.object({v:z.literal(1),type:z.literal('voice-received'),callId:z.string().uuid(),description:z.object({type:z.enum(['offer','answer']),sdp}).strict()}).strict();
export const voiceErrorSchema=z.object({v:z.literal(1),type:z.literal('voice-error'),message:z.string().max(160)}).strict();
export type VoiceClientPacket=z.infer<typeof voiceInviteSchema>|z.infer<typeof voiceControlSchema>|z.infer<typeof voiceSignalSchema>;
export type VoiceServerPacket=z.infer<typeof voiceStateSchema>|z.infer<typeof voiceReceivedSchema>|z.infer<typeof voiceErrorSchema>;
export type VoiceConsent={id:string;peer:string;phase:'outgoing'|'incoming'|'accepted';initiator:boolean;ready:boolean;expiresAt:number};
// Future groups are separate, explicit membership, not proximity audio. Reuse
// independent invitation/acceptance per member; never auto-promote a 1:1 call.
export interface VoiceGroupAdapter{invite(groupId:string,personId:string):Promise<void>;accept(invitationId:string):Promise<void>;leave(groupId:string):Promise<void>}
export type VoiceInvitationPreference='all'|'friends'|'none';
export interface VoicePreferencesAdapter{read():Promise<VoiceInvitationPreference>;save(preference:VoiceInvitationPreference):Promise<void>}
