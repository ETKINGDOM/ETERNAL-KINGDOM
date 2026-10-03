import {z} from 'zod';
import {isScene,type Scene} from '../shared/scenes';
import {allowsLoginFamily,readWalletLoginHint,walletBrands,type WalletBrand,type LoginFamily} from './walletLoginPolicy';
import {releaseStorageKey} from './releaseScope';
export const WALLET_RETURN_KEY=releaseStorageKey('ek:wallet-return:v1'),WALLET_RETURN_TTL=15*60_000;
const visitSchema=z.object({version:z.literal(1),scene:z.string().refine(isScene),channel:z.number().int().min(1).max(3),legacy:z.boolean(),expiresAt:z.number().int().positive(),wallet:z.enum(walletBrands).optional(),family:z.enum(['evm','solana']).optional()}).strict().refine(v=>v.wallet&&v.family?allowsLoginFamily(v.wallet,v.family):!v.wallet&&!v.family);
export type WalletReturnVisit={scene:Scene;channel:number;legacy:boolean;wallet?:WalletBrand;family?:LoginFamily};
type Store=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
export function rememberWalletReturn(visit:WalletReturnVisit,storage:Store,now=Date.now()):boolean{
  try{const value=visitSchema.parse({...visit,version:1,expiresAt:now+WALLET_RETURN_TTL});storage.setItem(WALLET_RETURN_KEY,JSON.stringify(value));return true;}catch{return false;}
}
// Restore presentation only. This can never authenticate, reconnect, sign,
// replay a payment, restart a microphone or persist private content.
export function consumeWalletReturn(search:string,storage:Store|null,now=Date.now()):WalletReturnVisit|null{
  let saved:WalletReturnVisit|null=null;
  try{
    const raw=storage?.getItem(WALLET_RETURN_KEY);storage?.removeItem(WALLET_RETURN_KEY);
    const parsed=raw?visitSchema.safeParse(JSON.parse(raw)):null;
    if(parsed?.success&&parsed.data.expiresAt>now&&parsed.data.expiresAt<=now+WALLET_RETURN_TTL)saved={scene:parsed.data.scene as Scene,channel:parsed.data.channel,legacy:parsed.data.legacy,...(parsed.data.wallet?{wallet:parsed.data.wallet,family:parsed.data.family}:{})};
  }catch{/* Disabled/corrupt storage never blocks guest entry. */}
  const query=new URLSearchParams(search),scene=query.get('scene'),realm=query.get('realm'),view=query.get('view');
  if(query.get('walletReturn')==='1'&&isScene(scene)&&realm!==null&&/^[1-3]$/.test(realm)&&(view===null||view==='2d')){const hint=readWalletLoginHint(search);return {scene,channel:Number(realm),legacy:view==='2d',...(hint?{wallet:hint.brand,family:hint.family}:{})};}
  return saved;
}
export function rememberBrowserWalletReturn(visit:WalletReturnVisit){try{return rememberWalletReturn(visit,sessionStorage);}catch{return false;}}
export function consumeBrowserWalletReturn(search:string){let storage:Store|null=null;try{storage=sessionStorage;}catch{}return consumeWalletReturn(search,storage);}
export function clearBrowserWalletReturn(){try{sessionStorage.removeItem(WALLET_RETURN_KEY);}catch{}}
