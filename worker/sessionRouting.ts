// Internal routing only. Neither the cookie nor its routing digest is public identity.
export async function routingHash(value:string){
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');
}
export function sessionToken(request:Request):string|null{
  const origin=request.headers.get('Origin');if(!origin)return null;
  const from=new URL(origin),secure=from.protocol==='https:';
  if(!secure&&!(from.protocol==='http:'&&['localhost','127.0.0.1'].includes(from.hostname)))return null;
  const name=secure?'__Host-ek-session':'ek-local-session';
  const values=request.headers.get('Cookie')?.split(';').map(v=>v.trim()).filter(v=>v.startsWith(`${name}=`))??[];
  if(values.length!==1)return null;
  const token=values[0].slice(name.length+1);return /^[0-9a-f]{64}$/.test(token)?token:null;
}
export async function sessionRoutingKey(request:Request){
  const token=sessionToken(request);return token?`browser:${await routingHash(token)}`:null;
}
