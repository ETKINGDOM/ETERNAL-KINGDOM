import {z} from 'zod';
import {walletAccountId,walletAccountSchema,type WalletAccountIdentity} from '../shared/identity';
import type {WalletChoice} from './walletIdentity';
import {allowsLoginFamily,walletBrand} from './walletLoginPolicy';
import {releaseStorageKey} from './releaseScope';

export const LAST_WALLET_KEY=releaseStorageKey('ek:auth:last-wallet:v1');
const rememberedSchema=z.object({version:z.literal(1),walletId:z.string().min(1).max(160),account:walletAccountSchema,resume:z.boolean()}).strict();
export type RememberedWallet=z.infer<typeof rememberedSchema>;
type Store=Pick<Storage,'getItem'|'setItem'>;
// Preference only. Never store a challenge, signature, cookie or private key.
export function readRememberedWallet(storage:Store):RememberedWallet|null{
  try{const value=rememberedSchema.safeParse(JSON.parse(storage.getItem(LAST_WALLET_KEY)??'null'));return value.success?value.data:null;}catch{return null;}
}
export function saveRememberedWallet(value:RememberedWallet,storage:Store):boolean{
  try{storage.setItem(LAST_WALLET_KEY,JSON.stringify(rememberedSchema.parse(value)));return true;}catch{return false;}
}
export function readBrowserRememberedWallet(){try{return readRememberedWallet(localStorage);}catch{return null;}}
export function saveBrowserRememberedWallet(value:RememberedWallet){try{return saveRememberedWallet(value,localStorage);}catch{return false;}}
export function rememberedChoice(last:RememberedWallet|null,wallets:WalletChoice[]){
  if(!last)return undefined;
  return wallets.find(wallet=>{
    const brand=walletBrand(wallet.name);
    return wallet.id===last.walletId&&wallet.family===last.account.family&&(!brand||allowsLoginFamily(brand,wallet.family));
  });
}
export function matchesRememberedAccount(last:RememberedWallet,current:WalletAccountIdentity){
  // An address may have switched networks while the tab was closed. It still
  // needs a new server-verified signature for that network; this is not login.
  return walletAccountId(current)===walletAccountId(last.account);
}
export async function readWalletQuietly(wallet:WalletChoice):Promise<WalletAccountIdentity>{
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{return walletAccountSchema.parse(await Promise.race([wallet.current(),new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(Error('Wallet unavailable')),2000);})]));}
  finally{clearTimeout(timer);}
}
