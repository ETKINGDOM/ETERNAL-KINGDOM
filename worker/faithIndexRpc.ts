// Operator-only secret; never accepted from a request or included in a public
// response/client bundle. Chain ID, runtime, receipts and anchors still verify.
export function faithIndexRpc(env:{FAITH_INDEX_RPC_URL?:unknown},fallback:string){
  if(env.FAITH_INDEX_RPC_URL===undefined)return fallback;
  if(typeof env.FAITH_INDEX_RPC_URL!=='string'||!env.FAITH_INDEX_RPC_URL.trim())throw Error('Invalid private index RPC');
  let url:URL;try{url=new URL(env.FAITH_INDEX_RPC_URL.trim());}catch{throw Error('Invalid private index RPC');}
  if(url.protocol!=='https:'||url.username||url.password||url.hash||url.hostname==='localhost'||/^127\./.test(url.hostname)||url.hostname==='[::1]')throw Error('Invalid private index RPC');
  return url.href;
}
