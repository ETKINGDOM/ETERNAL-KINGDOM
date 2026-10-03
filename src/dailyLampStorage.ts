import {lampSnapshotSchema,type DailyLampAdapter,type LampRequest} from '../shared/dailyLamp';
async function request(path:string,input:LampRequest,signal?:AbortSignal){
  const response=await fetch(`/api/auth/lamp${path}`,{method:'POST',credentials:'same-origin',
    headers:{'Content-Type':'application/json'},body:JSON.stringify(input),
    signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
  if(!response.ok)throw Error(response.status===401||response.status===403?'Sign in again to light your lamp.':'Could not check your lamp. Try checking again.');
  const value:unknown=await response.json();
  if(!value||typeof value!=='object'||!('lamp' in value))throw Error('Lamp response unavailable.');
  const lamp=lampSnapshotSchema.parse(value.lamp);
  if(lamp.accountId!==input.accountId)throw Error('Lamp account changed.');
  return lamp;
}
export const hostedDailyLamps:DailyLampAdapter={read:(input,signal)=>request('',input,signal),light:(input,signal)=>request('/light',input,signal)};
