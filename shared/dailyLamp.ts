import {z} from 'zod';
import {accountIdSchema} from './profile';

export const LAMP_CYCLE_LENGTH=7;
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const count=z.number().int().min(0).max(Number.MAX_SAFE_INTEGER-1);
export const lampStateSchema=z.object({version:z.literal(1),total:count,lastLitDay:day.nullable()}).strict()
  .refine(v=>(v.total===0)===(v.lastLitDay===null));
export type LampState=z.infer<typeof lampStateSchema>;
export const emptyLamp=():LampState=>({version:1,total:0,lastLitDay:null});
export function utcLampDay(now:number){return new Date(now).toISOString().slice(0,10);}
export const lampSnapshotSchema=z.object({version:z.literal(1),accountId:accountIdSchema,total:count,
  lastLitDay:day.nullable(),serverDay:day,litToday:z.boolean(),cycle:z.number().int().positive(),
  litInCycle:z.number().int().min(0).max(LAMP_CYCLE_LENGTH),nextResetAt:z.number().int().positive()}).strict()
  .refine(v=>v.litInCycle===(v.total===0?0:(v.total-1)%LAMP_CYCLE_LENGTH+1)
    &&v.cycle===Math.max(1,Math.ceil(v.total/LAMP_CYCLE_LENGTH))
    &&v.litToday===(v.lastLitDay!==null&&v.lastLitDay>=v.serverDay)
    &&(v.total===0)===(v.lastLitDay===null));
export type LampSnapshot=z.infer<typeof lampSnapshotSchema>;
export function lampSnapshot(accountId:string,state:LampState,now:number):LampSnapshot{
  const date=new Date(now);
  return lampSnapshotSchema.parse({...state,accountId,serverDay:utcLampDay(now),
    litToday:state.lastLitDay!==null&&state.lastLitDay>=utcLampDay(now),
    cycle:Math.max(1,Math.ceil(state.total/LAMP_CYCLE_LENGTH)),
    litInCycle:state.total===0?0:(state.total-1)%LAMP_CYCLE_LENGTH+1,
    nextResetAt:Date.UTC(date.getUTCFullYear(),date.getUTCMonth(),date.getUTCDate()+1)});
}
// The storage owner supplies time. Duplicate/late requests do not add lamps,
// including when the server clock temporarily moves backwards.
export function lightDailyLamp(state:LampState,now:number):LampState{
  const current=lampStateSchema.parse(state),today=utcLampDay(now);
  if(current.lastLitDay!==null&&current.lastLitDay>=today)return current;
  if(current.total>=Number.MAX_SAFE_INTEGER-1)throw Error('Lamp counter capacity reached.');
  return {version:1,total:current.total+1,lastLitDay:today};
}
export const lampRequestSchema=z.object({accountId:accountIdSchema,sessionExpiresAt:z.number().int().positive()}).strict();
export type LampRequest=z.infer<typeof lampRequestSchema>;
export interface DailyLampAdapter{
  read(request:LampRequest,signal?:AbortSignal):Promise<LampSnapshot>;
  light(request:LampRequest,signal?:AbortSignal):Promise<LampSnapshot>;
}
