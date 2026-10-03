import {giftRecipientRequestSchema,validatedGiftRecipient,type GiftRecipientRequest,type PersonGiftRecipientAdapter} from '../shared/gifts';

export function hostedGiftRecipients(scope:Omit<GiftRecipientRequest,'target'>,request:typeof fetch=fetch):PersonGiftRecipientAdapter{
  return {async lookup(target,signal){
    const body=giftRecipientRequestSchema.parse({...scope,target});
    if(target.kind==='guest')return {status:'unconfigured'};
    const cancellation=AbortSignal.any([signal,AbortSignal.timeout(10_000)]);
    const response=await request('/api/auth/gift-recipient',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:cancellation});
    if(!response.ok||!response.body)throw new Error('Recipient lookup unavailable');
    const reader=response.body.getReader(),chunks:Uint8Array[]=[];let size=0;
    const cancel=()=>{void reader.cancel().catch(()=>{});};cancellation.addEventListener('abort',cancel,{once:true});
    if(cancellation.aborted)cancel();
    try{
      while(true){cancellation.throwIfAborted();const part=await reader.read();cancellation.throwIfAborted();if(part.done)break;size+=part.value.length;
        if(size>4096){cancel();throw new Error('Recipient response too large');}chunks.push(part.value);}
    }finally{cancellation.removeEventListener('abort',cancel);reader.releaseLock();}
    const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
    const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
    if(typeof value!=='object'||value===null||!('recipient' in value)||Object.keys(value).length!==1)throw new Error('Invalid recipient response');
    return validatedGiftRecipient(target,value.recipient);
  }};
}
