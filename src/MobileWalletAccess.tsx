import { useState } from 'react';
import type { Scene } from '../shared/scenes';
import { cleanWalletVisitUrl, mobileWalletApps, officialWalletBrowserLaunch, type MobileWalletId } from './mobileWalletLinks';
import {defaultLoginFamily,type LoginFamily} from './walletLoginPolicy';
import {rememberBrowserWalletReturn} from './walletReturn';

export default function MobileWalletAccess({ scene, channel, legacy, disabled }: {
  scene: Scene; channel: number; legacy: boolean; disabled: boolean;
}) {
  const [choice, setChoice] = useState<MobileWalletId | null>(null), [status, setStatus] = useState('');
  const [family,setFamily]=useState<LoginFamily>('evm');
  const website = cleanWalletVisitUrl(location.origin, { scene, channel, legacy,walletReturn:true,...(choice?{wallet:choice,family}:{}) });
  const launch = choice && website ? officialWalletBrowserLaunch.url(choice, website) : null;
  const wallet = mobileWalletApps.find(app => app.id === choice);
  const remember=()=>rememberBrowserWalletReturn({scene,channel,legacy,...(choice?{wallet:choice,family}:{})});
  async function copy() {
    if (!website || disabled) return;
    try { await navigator.clipboard.writeText(website);remember();setStatus('Website link copied. Paste it into your wallet’s browser.'); }
    catch { setStatus('Copy was unavailable. Select and copy the website link shown below.'); }
  }
  return <details className="mobile-wallet-access">
    <summary>Using a phone wallet?</summary>
    <p className="fine-print">In a wallet’s browser, connect the detected wallet above; the free login signature opens automatically. In Safari or Chrome, open this website inside your wallet first. Opening it is not connecting or signing in.</p>
    {!website && <p className="fine-print" role="status">Wallet-app opening needs a public HTTPS website. This local/private preview cannot be opened on another phone through these links. No online version was published automatically.</p>}
    <div className="mobile-wallet-options">{mobileWalletApps.map(app => <button key={app.id} type="button" className="secondary-button full" disabled={disabled || !website}
      onClick={() => { setChoice(app.id);setFamily(defaultLoginFamily(app.id));setStatus(''); }}>Open in {app.name}<small>{app.family} · review first</small></button>)}</div>
    {website && <><code className="wallet-visit-url">{website}</code><button type="button" className="text-button" disabled={disabled} onClick={() => void copy()}>Copy wallet-browser website link</button></>}
    {website && wallet && <div className="mobile-wallet-review" role="region" aria-label="Review wallet browser opening">
      <h4>Open this website in {wallet.name}?</h4>
      <p className="fine-print">Your map, realm, wallet preference and login screen will reopen inside the wallet. No login cookie, signature, wallet address, chat or faith draft is transferred. Connect and sign in there if needed.</p>
      <p className="fine-print">Preferred login: {family==='evm'?'EVM · recommended for Robinhood and God':'SOL'}. This does not connect, sign or switch a wallet network.</p>
      {(choice==='okx'||choice==='backpack')&&<button className="text-button" type="button" disabled={disabled} onClick={()=>setFamily(family==='evm'?'solana':'evm')}>Use {family==='evm'?'SOL':'EVM'} login instead</button>}
      <code>{website}</code>
      {launch && !disabled && <a className="secondary-button full" href={launch} onClick={remember} rel="noopener noreferrer" referrerPolicy="no-referrer">Continue to {wallet.name}</a>}
      {!launch && <><p className="fine-print">Open {wallet.name}, choose its Web3 / DApp browser, then paste this website link. Select the wallet on the website; use its SOL switch if preferred. Direct app opening is not configured for this wallet yet.</p><button className="secondary-button full" type="button" disabled={disabled} onClick={()=>void copy()}>Copy link for {wallet.name}</button></>}
      <button type="button" className="text-button" onClick={() => setChoice(null)}>Cancel opening wallet</button>
    </div>}
    <p className="fine-print">If app opening does not work, paste this link into the wallet’s DApp browser and select its detected wallet. EVM and Solana logins stay separate. App availability, browser access and signing features vary by wallet/version. If an app is missing, its official website may open instead. No QR/session bridge is connected yet.</p>
    {status && <p role="status" className="fine-print">{status}</p>}
  </details>;
}
