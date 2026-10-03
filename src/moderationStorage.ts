import {moderationSnapshotSchema,type RoomModerationAdapter} from '../shared/moderation';
async function request(body:unknown,signal?:AbortSignal){
  const response=await fetch('/api/auth/moderation',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)}).catch(()=>{throw new Error('The result could not be confirmed. Refresh before trying again; actions are never retried automatically.');});
  const value:unknown=await response.json();
  if(!response.ok)throw new Error(value&&typeof value==='object'&&'error' in value&&typeof value.error==='string'?value.error:'Moderation is unavailable. Refresh before trying again.');
  return value;
}
export const hostedModeration:RoomModerationAdapter={
  read:async(body,signal)=>moderationSnapshotSchema.parse(await request(body,signal)),
  change:async(body,signal)=>{const value=await request(body,signal);if(!value||typeof value!=='object'||!('ok' in value)||value.ok!==true)throw new Error('Action could not be confirmed. Refresh first.');},
};
