import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import type {WalletAccountIdentity,WalletSession} from '../shared/identity';
import {sameWalletAccount} from '../shared/identity';
import {isWalletProvider,type WalletChoice} from './walletIdentity';
import type {RememberedWallet} from './rememberedWallet';
export type WalletNetwork={chainId:number;name:string;rpcUrl:string;testnet:boolean;executionFeeModel?:string|null};
export type PrepareWalletNetwork=typeof ensureWalletNetwork;
export class WalletNetworkError extends Error{
  constructor(readonly reason:'cancelled'|'unavailable'|'changed'|'context'){super(reason==='cancelled'?'Network request cancelled. No transaction was requested.':reason==='changed'?'Your wallet account changed. No transaction was requested.':reason==='context'?'Preparation changed. No transaction was requested.':'The wallet could not select Robinhood Chain. No transaction was requested.');}
}
export const sameWalletAddress=(a:WalletAccountIdentity,b:WalletAccountIdentity)=>a.family===b.family&&a.address.toLowerCase()===b.address.toLowerCase();
// A valid server proof remains mandatory. A saved preference can only explain
// a same-address, project-requested RH execution network, never authenticate.
export function matchesSessionNetwork(account:WalletAccountIdentity,session:WalletSession,wallet:WalletChoice,last:RememberedWallet|null,target:WalletNetwork|null){
  return sameWalletAccount(account,session)||Boolean(target&&isRobinhoodNitroNetwork(target)&&account.family==='evm'&&sameWalletAddress(account,session)&&account.chainId===target.chainId&&last?.resume&&last.walletId===wallet.id&&sameWalletAccount(account,last.account));
}
export async function ensureWalletNetwork(wallet:WalletChoice,target:WalletNetwork,expected:WalletAccountIdentity|undefined,check:()=>void){
  if(!isRobinhoodNitroNetwork(target)||!isWalletProvider(wallet.provider)||wallet.family!=='evm'||new URL(target.rpcUrl).protocol!=='https:')throw new WalletNetworkError('unavailable');
  const provider=wallet.provider,hex='0x'+target.chainId.toString(16);
  const current=async()=>{check();const account=await wallet.current();check();if(account.family!=='evm'||(expected?.family==='evm'&&!sameWalletAddress(account,expected)))throw new WalletNetworkError('changed');return account;};
  const before=await current();
  if(before.chainId===target.chainId)return before;
  const guardedCurrent=async()=>{const account=await current();if(!sameWalletAddress(account,before))throw new WalletNetworkError('changed');return account;};
  const request=async(method:string,params:unknown[])=>{await guardedCurrent();check();try{await provider.request({method,params});}catch(error){if(typeof error==='object'&&error!==null&&'code' in error&&error.code===4001)throw new WalletNetworkError('cancelled');throw error;}check();};
  try{
    try{await request('wallet_switchEthereumChain',[{chainId:hex}]);}
    catch(error){
      if(!(typeof error==='object'&&error!==null&&'code' in error&&error.code===4902))throw error;
      await request('wallet_addEthereumChain',[{chainId:hex,chainName:target.name,rpcUrls:[target.rpcUrl],nativeCurrency:{name:'Ether',symbol:'ETH',decimals:18}}]);
      // Adding a network does not imply selecting it. No repeat if already RH.
      if((await guardedCurrent()).chainId!==target.chainId)await request('wallet_switchEthereumChain',[{chainId:hex}]);
    }
    const after=await guardedCurrent();if(after.chainId!==target.chainId)throw new WalletNetworkError('unavailable');return after;
  }catch(error){if(error instanceof WalletNetworkError)throw error;throw new WalletNetworkError('unavailable');}
}
