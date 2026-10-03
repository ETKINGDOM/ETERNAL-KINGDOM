// Numeric/allowlisted operational metadata only. Never copy an RPC error's
// message, request, response, URL, payload, wallet, or faith text into logs.
export function rpcDiagnostic(error:unknown){
  let current=error,status:number|undefined,code:number|undefined,timeout=false;
  for(let i=0;i<6&&current&&typeof current==='object';i++){
    const item=current as {name?:unknown;status?:unknown;code?:unknown;cause?:unknown};
    timeout ||= item.name==='TimeoutError'||item.name==='AbortError';
    if(typeof item.status==='number'&&Number.isInteger(item.status)&&item.status>=100&&item.status<=599)status=item.status;
    if(typeof item.code==='number'&&Number.isSafeInteger(item.code))code=item.code;
    current=item.cause;
  }
  return {reason:timeout?'timeout':status?'http':code!==undefined?'rpc':'other',...(status===undefined?{}:{status}),...(code===undefined?{}:{code})};
}
