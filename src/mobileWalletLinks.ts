import { isScene, type Scene } from '../shared/scenes';
import {allowsLoginFamily,readWalletLoginHint,walletBrands,type LoginFamily} from './walletLoginPolicy';

export type MobileWalletId = 'metamask' | 'okx' | 'backpack' | 'phantom' | 'solflare' | 'trust';
export const mobileWalletApps: Array<{ id: MobileWalletId; name: string; family: string }> = [
  { id: 'metamask', name: 'MetaMask', family: 'EVM browser' },
  { id: 'okx', name: 'OKX Wallet', family: 'EVM / Solana' },
  { id: 'backpack', name: 'Backpack', family: 'EVM / Solana' },
  { id: 'phantom', name: 'Phantom', family: 'SOL login' },
  { id: 'solflare', name: 'Solflare', family: 'Solana' },
  { id: 'trust', name: 'Trust Wallet', family: 'EVM browser' },
];
export interface WalletBrowserLaunchAdapter { url(wallet: MobileWalletId, website: string): string | null }
export function worldRealm(value: string | null): number { return value && /^[1-3]$/.test(value) ? Number(value) : 1; }
export function cleanWalletVisitUrl(source: string, visit: { scene: Scene; channel: number; legacy?: boolean;walletReturn?:boolean;wallet?:MobileWalletId;family?:LoginFamily }): string | null {
  try {
    const sourceUrl = new URL(source), host = sourceUrl.hostname.toLowerCase();
    // This launch path deliberately supports public DNS HTTPS only. A phone's
    // localhost is not this computer, and IP/private-host launch is not supported.
    if (sourceUrl.protocol !== 'https:' || sourceUrl.username || sourceUrl.password || sourceUrl.port ||
      !host.includes('.') || host.includes(':') || /^[\d.]+$/.test(host) ||
      /(?:^|\.)(?:localhost|local|internal|test|invalid|example)$/.test(host) || host.endsWith('.home.arpa') ||
      !isScene(visit.scene) || !Number.isInteger(visit.channel) || visit.channel < 1 || visit.channel > 3) return null;
    const target = new URL('/', sourceUrl.origin);
    target.searchParams.set('scene', visit.scene); target.searchParams.set('realm', String(visit.channel));
    if (visit.legacy === true) target.searchParams.set('view', '2d');
    if(visit.walletReturn===true)target.searchParams.set('walletReturn','1');
    if(visit.wallet!==undefined||visit.family!==undefined){
      if(!visit.wallet||!walletBrands.includes(visit.wallet)||!visit.family||!allowsLoginFamily(visit.wallet,visit.family))return null;
      target.searchParams.set('wallet',visit.wallet);target.searchParams.set('login',visit.family);
    }
    return target.href;
  } catch { return null; }
}
export const officialWalletBrowserLaunch: WalletBrowserLaunchAdapter = {
  url(wallet, website) {
    try {
      const parsed = new URL(website);
      const scene = parsed.searchParams.get('scene'), realm = parsed.searchParams.get('realm');
      if (!isScene(scene) || realm === null || !/^[1-3]$/.test(realm)) return null;
      const hint=readWalletLoginHint(parsed.search),resume=parsed.searchParams.get('walletReturn')==='1';
      const clean = cleanWalletVisitUrl(website, { scene, channel: Number(realm), legacy: parsed.searchParams.get('view') === '2d',walletReturn:resume,...(hint?{wallet:hint.brand,family:hint.family}:{}) });
      if (!clean || clean !== website) return null;
      const root = new URL('/', parsed.origin).href;
      if (wallet === 'metamask') return `https://metamask.app.link/dapp/${clean.slice('https://'.length)}`;
      if (wallet === 'backpack') return `https://backpack.app/ul/v1/browse/${encodeURIComponent(clean)}?ref=${encodeURIComponent(root)}`;
      if (wallet === 'phantom') return `https://phantom.app/ul/browse/${encodeURIComponent(clean)}?ref=${encodeURIComponent(root)}`;
      if (wallet === 'solflare') return `https://solflare.com/ul/v1/browse/${encodeURIComponent(clean)}?ref=${encodeURIComponent(root)}`;
      if (wallet === 'trust') {
        const target = new URL('https://link.trustwallet.com/open_url');
        // Browser route only. This coin hint is not a transaction/network switch
        // request and does not assert Robinhood or any token integration.
        target.searchParams.set('coin_id', '60'); target.searchParams.set('url', clean); return target.href;
      }
      return null;
    } catch { return null; }
  },
};
