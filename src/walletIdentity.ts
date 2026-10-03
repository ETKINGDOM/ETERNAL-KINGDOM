import { getAddress, stringToHex } from 'viem';
import { parseSiweMessage } from 'viem/siwe';
import { AUTH_STATEMENT, walletSessionSchema, type WalletAccountIdentity, type IdentitySessionAdapter } from '../shared/identity';

export interface InjectedWalletProvider {
  request(args:{method:string;params?:unknown[]}):Promise<unknown>;
  on(event:string,listener:(value:unknown)=>void):void;
  removeListener(event:string,listener:(value:unknown)=>void):void;
}
export type WalletChoice={
  id:string;name:string;family:'evm'|'solana';provider:object;
  connect():Promise<WalletAccountIdentity>;
  current():Promise<WalletAccountIdentity>;
  sign(message:string,account:WalletAccountIdentity,origin:string):Promise<string>;
  subscribe(changed:()=>void):()=>void;
};
export function isWalletProvider(value:unknown):value is InjectedWalletProvider{
  return typeof value==='object'&&value!==null&&'request' in value&&typeof value.request==='function'&&'on' in value&&typeof value.on==='function'&&'removeListener' in value&&typeof value.removeListener==='function';
}
export function parseWalletAccount(value:unknown){
  if(!Array.isArray(value)||typeof value[0]!=='string')throw new Error('No account');
  return getAddress(value[0]);
}
export function parseWalletChain(value:unknown):number{
  if(typeof value!=='string'||!/^0x[0-9a-f]+$/i.test(value))throw new Error('Invalid chain');
  const chain=Number(BigInt(value));if(!Number.isSafeInteger(chain)||chain<1)throw new Error('Invalid chain');return chain;
}
export function loginMessageHex(message:string,address:string,chainId:number,origin:string){
  const parsed=parseSiweMessage(message),now=Date.now();
  if(parsed.domain!==new URL(origin).host||parsed.uri!==origin||parsed.address?.toLowerCase()!==address.toLowerCase()||parsed.chainId!==chainId||parsed.version!=='1'||parsed.statement!==AUTH_STATEMENT||!parsed.nonce||!parsed.issuedAt||!parsed.expirationTime||parsed.expirationTime.getTime()<=now||parsed.issuedAt.getTime()>now+30_000||parsed.resources?.length)throw new Error('Unexpected login message');
  return stringToHex(message);
}
export function evmWallet(id:string,name:string,provider:InjectedWalletProvider):WalletChoice{
  const read=async(method:string):Promise<WalletAccountIdentity>=>({family:'evm',address:parseWalletAccount(await provider.request({method})),chainId:parseWalletChain(await provider.request({method:'eth_chainId'}))});
  return {id,name,family:'evm',provider,connect:()=>read('eth_requestAccounts'),current:()=>read('eth_accounts'),
    async sign(message,account,origin){
      if(account.family!=='evm')throw new Error('Wrong wallet family');
      const signature=await provider.request({method:'personal_sign',params:[loginMessageHex(message,account.address,account.chainId,origin),account.address]});
      if(typeof signature!=='string'||!/^0x[0-9a-fA-F]{130}$/.test(signature))throw new Error('Invalid signature');return signature;
    },
    subscribe(changed){
      const events=['accountsChanged','chainChanged','disconnect'];
      const clear=()=>{for(const event of events)try{provider.removeListener(event,changed);}catch{/* Removed provider. */}};
      try{for(const event of events)provider.on(event,changed);}catch(error){clear();throw error;}
      return clear;
    },
  };
}
async function post(path:string,body:unknown={}):Promise<unknown>{
  const response=await fetch(`/api/auth/${path}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(10_000)});
  if(!response.ok)throw new Error(response.status===429?'rate-limited':'auth-unavailable');
  return response.json();
}
function sessionFrom(value:unknown){
  if(typeof value!=='object'||value===null||!('session' in value))throw new Error('Invalid session');
  return value.session===null?null:walletSessionSchema.parse(value.session);
}
export const hostedIdentity:IdentitySessionAdapter={
  async session(){return sessionFrom(await post('session'));},
  async challenge(account){
    const value=await post('challenge',account);
    if(typeof value!=='object'||value===null||!('message' in value)||typeof value.message!=='string'||value.message.length>2000||!('expiresAt' in value)||typeof value.expiresAt!=='number')throw new Error('Invalid challenge');
    return {message:value.message,expiresAt:value.expiresAt};
  },
  async verify(signature){const session=sessionFrom(await post('verify',{signature}));if(!session)throw new Error('No verified session');return session;},
  async logout(){await post('logout');},
};
