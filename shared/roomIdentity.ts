import {z} from 'zod';
import {accountIdSchema} from './profile';
import {SCENES} from './scenes';

export const ROOM_TICKET_TTL=30_000;
export const ROOM_PROTOCOL='ek-room-v1';
export const roomAdmissionSchema=z.object({accountId:accountIdSchema,sessionExpiresAt:z.number().int().positive(),scene:z.enum(SCENES),channel:z.number().int().min(1).max(3)}).strict();
export type RoomAdmission=z.infer<typeof roomAdmissionSchema>;
export interface RoomIdentityAdapter {
  ticket(admission:RoomAdmission,signal?:AbortSignal):Promise<{ticket:string;expiresAt:number}>;
}
