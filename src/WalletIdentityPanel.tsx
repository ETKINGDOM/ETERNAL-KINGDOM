import type { WalletIdentityModel } from './useWalletIdentity';
import type { Scene } from '../shared/scenes';
import MobileWalletAccess from './MobileWalletAccess';
import WalletLoginOptions from './WalletLoginOptions';
import {rememberBrowserWalletReturn,clearBrowserWalletReturn,type WalletReturnVisit} from './walletReturn';
import {walletBrand} from './walletLoginPolicy';
import type {WalletChoice} from './walletIdentity';
import {rememberedChoice} from './rememberedWallet';
import InfoHint from './InfoHint';

export default function WalletIdentityPanel({identity,scene,channel,legacy,mobile,returned}:{identity:WalletIdentityModel;scene:Scene;channel:number;legacy:boolean;mobile:boolean;returned?:WalletReturnVisit|null}){
  const {session,connection,busy,wallets}=identity;
  const last=rememberedChoice(identity.lastLogin,wallets);
  const account=connection??session;
  const remember=(wallet?:WalletChoice)=>{if(mobile){const brand=wallet?walletBrand(wallet.name):null;rememberBrowserWalletReturn({scene,channel,legacy,...(brand&&wallet?{wallet:brand,family:wallet.family}:{})});}};
  const signout=()=>{clearBrowserWalletReturn();void identity.logout();};
  return <section className="wallet-identity" aria-label="Wallet identity">
    <h3>{session?'Your wallet is verified.':'Your identity in this world.'}</h3>
    <InfoHint label="Wallet identity details">
      <p>{session?'This sign-in proves control of the wallet, not a religious role or ownership of property.':'Guest access stays available. Choose your EVM or Solana wallet; after connecting, a free login signature opens automatically in the wallet. Verified visitors share a persistent public person ID and wallet family across rooms, not their wallet address. Stay a guest to avoid linking visits.'}</p>
      {session&&<p>Session expires {new Date(session.expiresAt).toLocaleTimeString()}. Rooms verify your login on the server. Public presence shows your saved appearance, wallet family and persistent person ID, not your wallet addresses. A receiving address becomes readable through gift lookup only if you separately publish it below. This ID links your visits across rooms and names; use guest access if you do not want that link. Names are not unique or proof of a religious role.</p>}
      {account?.family==='solana'&&<p>SOL login only — no SOL is required and no network switch is requested. A Solana address is not an EVM receiving address. Set a separate EVM address below for future gifts; transfers are not enabled.</p>}
      <p>Wallet login needs no Gas, token approval or transfer. Never share a seed phrase or private key. EVM and Solana are separate identities, even in the same wallet app. Robinhood onchain records require an EVM wallet; onchain actions need wallet confirmation and network fees.</p>
      <p>This browser remembers your last wallet and public address, not your signature. Active logins restore; after expiry, verify again. Signing out stops automatic connection recovery. Other devices and wallet browsers sign in separately.</p>
      <p>Dual-wallet login recommends EVM; use the SOL switch if preferred. Phantom login uses SOL here. Names are display labels, not proof of provider authenticity. QR connections and smart-contract wallets are not connected.</p>
    </InfoHint>
    {returned&&identity.ready&&!session&&!connection&&<p className="fine-print" role="status">Your map and login screen were restored. If signing was interrupted, reconnect below. No signature or payment was replayed.</p>}
    {account&&<div className="wallet-address"><span>{session?`Verified ${account.family==='solana'?'Solana':'EVM'} wallet`:'Connected · not verified'}</span><code>{account.address}</code><small>{account.family==='evm'?'Wallet network ID':'Sign-in scope'}: {account.chainId}</small></div>}
    {session?<button className="secondary-button full" disabled={Boolean(busy)} onClick={signout}>Sign out of wallet</button>:
      <>{!connection&&!busy&&<div className="wallet-options"><WalletLoginOptions wallets={wallets} lastWallet={last?{id:last.id,family:last.family}:undefined} preferred={returned?.wallet&&returned.family?{brand:returned.wallet,family:returned.family}:undefined} disabled={!identity.ready||identity.pendingSignout} connect={wallet=>{remember(wallet);void identity.connect(wallet);}}/><button type="button" className="text-button" disabled={!identity.ready||identity.pendingSignout} onClick={identity.rescanWallets}>Look for wallets again</button><MobileWalletAccess key={`${scene}:${channel}`} scene={scene} channel={channel} legacy={legacy} disabled={!identity.ready||identity.pendingSignout}/></div>}
      {connection&&!busy&&<><p className="fine-print">{identity.lastLogin?.resume?'Your last authorized wallet connection is ready. Verify to sign in again; no need to reconnect.':'Signature did not finish? Use the button below to try again.'} No payment or token approval.</p><button className="primary full" disabled={identity.pendingSignout} onClick={()=>{remember(connection.wallet);void identity.verify();}}>Verify wallet — no payment</button></>}
      {(connection||busy)&&<button className="text-button" disabled={busy==='logout'} onClick={signout}>Cancel wallet login · continue as guest</button>}</>}
    {busy==='connect'&&<p role="status" className="fine-print">Approve connection in your wallet. You can cancel and stay a guest.</p>}
    {busy==='sign'&&<p role="status" className="fine-print">Confirm the login signature in your wallet. No payment or token approval. If the request is missed or cancelled, you can retry below.</p>}
    {busy==='logout'&&<p role="status" className="fine-print">Ending the wallet session…</p>}
    {identity.error&&<p role="alert" className="error">{identity.error}</p>}
    {identity.pendingSignout&&!busy&&<button className="secondary-button full" onClick={()=>void identity.logout()}>Retry sign-out</button>}
  </section>;
}
