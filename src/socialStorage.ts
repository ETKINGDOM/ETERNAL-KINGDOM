import {conversationSchema,snapshotSchema,type PrivateSocialAdapter} from '../shared/social';
export class SocialRejection extends Error{constructor(message:string,readonly status:number){super(message);this.name='SocialRejection';}}

async function request(body:unknown,signal?:AbortSignal){
  const response=await fetch('/api/auth/social',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)}).catch(()=>{throw new Error('The result could not be confirmed. Nothing will be retried automatically. Refresh to check before trying again.');});
  if(!response.ok){
    const value:unknown=await response.json().catch(()=>null);
    const detail=value&&typeof value==='object'&&'error' in value&&typeof value.error==='string'?value.error:'The connection or change could not be confirmed.';
    if([400,401,403,409,429].includes(response.status))throw new SocialRejection(detail,response.status);
    throw new Error('The result could not be confirmed. Refresh to check.');
  }
  return response.json() as Promise<unknown>;
}
export const hostedSocial:PrivateSocialAdapter={
  snapshot:async(body,signal)=>snapshotSchema.parse(await request(body,signal)),
  change:async(body,signal)=>conversationSchema.parse(await request(body,signal)),
};
