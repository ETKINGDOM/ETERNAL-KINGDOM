import type {WalletChoice} from './walletIdentity';
export const walletBrands=['metamask','okx','backpack','phantom','solflare','trust'] as const;
export type WalletBrand=typeof walletBrands[number];
export type LoginFamily='evm'|'solana';
export function walletBrand(name:string):WalletBrand|null{
  const names:Record<string,WalletBrand>={'metamask':'metamask','okx wallet':'okx','backpack':'backpack','phantom':'phantom','solflare':'solflare','trust wallet':'trust'};
  return Object.hasOwn(names,name.toLowerCase())?names[name.toLowerCase()]:null;
}
export function defaultLoginFamily(brand:WalletBrand):LoginFamily{return brand==='phantom'||brand==='solflare'?'solana':'evm';}
export function allowsLoginFamily(brand:WalletBrand,family:LoginFamily){if(family!=='evm'&&family!=='solana')return false;return brand==='phantom'||brand==='solflare'?family==='solana':brand==='metamask'||brand==='trust'?family==='evm':true;}
export function readWalletLoginHint(search:string):{brand:WalletBrand;family:LoginFamily}|null{
  const query=new URLSearchParams(search),brand=query.get('wallet'),family=query.get('login');
  return walletBrands.includes(brand as WalletBrand)&&(family==='evm'||family==='solana')&&allowsLoginFamily(brand as WalletBrand,family)?{brand:brand as WalletBrand,family}:null;
}
export type WalletLoginGroup={key:string;name:string;brand:WalletBrand|null;evm?:WalletChoice;solana?:WalletChoice};
export function walletLoginGroups(wallets:WalletChoice[]):WalletLoginGroup[]{
  const groups:WalletLoginGroup[]=[];
  for(const wallet of wallets){
    const brand=walletBrand(wallet.name);
    // This is the project's login policy, not a claim about wallet capabilities.
    if(brand&&!allowsLoginFamily(brand,wallet.family))continue;
    const key=brand??`${wallet.family}:${wallet.id}`;
    let group=groups.find(g=>g.key===key);
    if(!group){group={key,name:wallet.name,brand};groups.push(group);}
    // Discovery aliases never create a second branded login button. Selected
    // providers still undergo the normal account/challenge/signature checks.
    group[wallet.family]??=wallet;
  }
  return groups;
}
