import type {RpcFetch} from '../shared/rpcFetch';

// A bounded queue for the singleton index, including constructor-binding
// reads. Request/response bodies are never retained or logged by this adapter.
export function rpcPacer(request:RpcFetch=fetch,interval=500){
  let tail=Promise.resolve(),nextAt=0,pending=0;
  const pause=(ms:number)=>{nextAt=Math.max(nextAt,Date.now()+ms);};
  const paced=(async(input,init)=>{
    if(pending>=32)throw Error('RPC read queue full');pending++;
    const prior=tail;let release!:()=>void;tail=new Promise<void>(resolve=>release=resolve);
    const signal=init?.signal;
    try{
      await prior;signal?.throwIfAborted();
      while(nextAt>Date.now())await new Promise<void>((resolve,reject)=>{
        const finish=()=>{signal?.removeEventListener('abort',abort);resolve();};
        const timer=setTimeout(finish,nextAt-Date.now()),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason);};
        signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();
      });
      signal?.throwIfAborted();nextAt=Date.now()+interval;
      const response=await request(input,init);if(response.status===429)pause(60000);return response;
    }finally{pending--;release();}
  }) as RpcFetch;
  return {fetch:paced,pause};
}
