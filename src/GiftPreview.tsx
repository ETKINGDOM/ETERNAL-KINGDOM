import { lazy,Suspense,useEffect,useState } from 'react';
import { Gift,Shield } from 'lucide-react';
import { giftDraftSchema,giftTargetKey,validatedGiftRecipient,type GiftDraft,type GiftTarget,type GiftRecipientResult,type PersonGiftRecipientAdapter } from '../shared/gifts';
import { unconfiguredGiftRecipients } from './giftPreviewState';
import { useGodToken } from './useGodToken';
import { projectChainSettings } from './projectChainSettings';
import { prepareGodTokenTransfer } from './godTokenService';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import {chainBroadcast} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import type { WalletChoice } from './walletIdentity';
import type { StartGiftAttempt } from './useGiftTransactions';
import type { StartNativeTokenAttempt } from './useNativeTokenTransactions';
import type {WalletAccountIdentity} from '../shared/identity';
import type {PrepareWalletNetwork} from './walletNetwork';
const GiftTransactionReview=lazy(()=>import('./GiftTransactionReview'));
const NativeTokenSubmission=lazy(()=>import('./NativeTokenSubmission'));

export default function GiftPreview({target,name,senderFamily,openSettings,recipients=unconfiguredGiftRecipients,wallets,preferred,account,prepareNetwork,scope,startAttempt,startNative,pending,openHistory,openNativeHistory}:{
  target:GiftTarget;name:string;senderFamily:'evm'|'solana'|'guest';openSettings:()=>void;recipients?:PersonGiftRecipientAdapter;
  wallets:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;prepareNetwork?:PrepareWalletNetwork;scope:string;startAttempt:StartGiftAttempt;startNative:StartNativeTokenAttempt;pending:boolean;openHistory:()=>void;openNativeHistory:()=>void;
}){
  const godToken=useGodToken();
  const [resolution,setResolution]=useState<{key:string;value:GiftRecipientResult}|null>(null),[lookupError,setLookupError]=useState('');
  const [refreshVersion,setRefreshVersion]=useState(0);
  const [amount,setAmount]=useState(''),[blessing,setBlessing]=useState(''),[review,setReview]=useState<GiftDraft|null>(null),[error,setError]=useState('');
  const targetKey=giftTargetKey(target);
  const recipient=resolution?.key===targetKey?resolution.value:null;
  useEffect(()=>{
    const controller=new AbortController();let active=true;
    setResolution(null);setLookupError('');setAmount('');setBlessing('');setReview(null);setError('');
    void recipients.lookup(target,controller.signal).then(value=>{
      if(active)setResolution({key:targetKey,value:validatedGiftRecipient(target,value)});
    }).catch(()=>{if(active)setLookupError('The selected person’s receiving settings could not be verified. No transfer is possible.');});
    return()=>{active=false;controller.abort();};
  },[targetKey,recipients,refreshVersion]);
  const address=recipient?.status==='available'?recipient.address:null;
  const configuredReview=Boolean(godToken.token&&address&&target.kind==='wallet');
  const broadcast=chainBroadcast(projectChainSettings,'gifts');
  const native=projectChainSettings.status==='valid'&&isRobinhoodNitroNetwork(projectChainSettings.config.network);
  const addressNotice=address??(recipient?.status==='disabled'?'Hidden — published gifts disabled':recipient?.status==='unpublished'?'Not published':recipient?.status==='unconfigured'?'Unavailable — lookup not connected':'Not resolved');
  function prepare(){
    const parsed=giftDraftSchema.safeParse({amount,blessing});
    if(!parsed.success){setReview(null);setError('Use a positive decimal amount (no exponent or separators) and a blessing up to 240 Unicode characters.');return;}
    if(godToken.token&&address){
      try {prepareGodTokenTransfer(projectChainSettings,godToken.token,address,parsed.data.amount);}
      catch {setReview(null);setError('The amount exceeds this God token’s precision or range. No transfer was prepared.');return;}
    }
    setError('');setReview(parsed.data);
  }
  const recipientNotice=recipient?.status==='disabled'?'This person has disabled published gifts.':
    recipient?.status==='unpublished'?'This person has not published a receiving address for gifts.':
    recipient?.status==='unconfigured'?'Public receiving-address lookup is not connected. This does not mean the person has no saved address.':
    recipient?.status==='available'?(godToken.token?'A published address and configured token are available. Review the network and full address below.':'A published address is available. Token, network and transfer execution are still not configured.'):
    lookupError||'Checking receiving options…';
  return <div className="gift-preview">
    <div className="gift-preview-boundary"><Gift size={22}/><div><strong>{configuredReview?(broadcast?'Gifts use the configured network.':native?'Transfers are disabled in project settings.':'Transfers are disabled. Read-only estimates available.'): 'Transfers are not connected.'}</strong><p>{configuredReview?'Drafting is local only. A transfer requires an EVM payment wallet and its confirmation.':'This is a local draft only. No wallet signature, token approval, payment or chain record is created.'}</p></div></div>
    <section className="gift-person" aria-label="Gift recipient"><span>Selected person</span><h3><bdi>{name}</bdi></h3><small>{target.kind==='wallet'?`Verified ${target.family==='solana'?'SOL':'EVM'} login · not proof of receiving-address ownership`:'Temporary guest · this connection only'}</small>
      <code>{target.kind==='wallet'?target.personId:target.connectionId}</code><p>Names are not unique. This public identifier is not a wallet address.</p></section>
    <p className="gift-recipient-status" role="status">{recipientNotice}</p>
    {target.kind==='wallet'&&<><button type="button" className="text-button" onClick={()=>{setResolution(null);setReview(null);setAmount('');setBlessing('');setRefreshVersion(v=>v+1);}}>Refresh published receiving address</button><p className="gift-note">Read on demand, not continuously. Address or sharing settings may have changed. Refresh clears this local draft; a future payment must revalidate the address/version again.</p></>}
    {target.kind==='guest'&&<p className="gift-note">Guest receiving settings currently stay in that person’s own browser. Do not infer an address from a name or avatar.</p>}
    <div className="gift-preview-fields"><div><span>EVM receiving address</span><code>{addressNotice}</code></div><div><span>Token / network</span><b>{godToken.token?`${GOD_TOKEN_NAME} / ${godToken.token.networkName}`:godToken.status==='error'?'Could not verify':godToken.status==='loading'?'Checking settings…':'Not configured'}</b></div><div><span>Gas / token balance</span><b>Not estimated / not queried</b></div></div>
    {address&&<p className="gift-note">{recipient?.status==='available'&&recipient.ownershipVerified?'Ownership status supplied by the recipient adapter.':'Address ownership is not verified.'} Receiving snapshot version: {recipient?.status==='available'?recipient.revision:''}. No address is silently substituted for this person.</p>}
    <p className="gift-note">{senderFamily==='solana'?'Your SOL login cannot sign an EVM transfer. Select a separate EVM payment wallet for a configured gift; your SOL login stays unchanged.':senderFamily==='guest'?'Previewing needs no wallet. A configured gift requires an explicitly selected EVM payment wallet; your guest login stays unchanged.':'Uses your connected EVM wallet. A gift still requires its payment confirmation.'}</p>
    {!review?<form onSubmit={e=>{e.preventDefault();prepare();}}>
      <label htmlFor="gift-draft-amount">{godToken.token?`Amount draft · ${GOD_TOKEN_NAME}`:'Amount draft · token units not configured'}</label><input id="gift-draft-amount" type="text" inputMode="decimal" autoComplete="off" maxLength={116} value={amount} onChange={e=>{setAmount(e.target.value);setError('');}} placeholder="e.g. 1.25"/>
      <label htmlFor="gift-draft-blessing">Optional blessing · local only</label><textarea id="gift-draft-blessing" value={blessing} onChange={e=>{setBlessing(e.target.value);setError('');}} dir="auto" maxLength={480} rows={3} placeholder="A kind word…"/>
      <small>{godToken.token?`No draft is saved or sent. Configured token precision: ${godToken.token.decimals}. Network fees are not estimated.`:'No draft is saved or sent. Token precision and fees cannot be checked until the token/network is configured.'}</small>
      {error&&<p className="error" role="alert">{error}</p>}
      <button className="secondary-button full" type="submit" disabled={!amount.trim()}>Review local draft — no transfer</button>
    </form>:<section className="gift-local-review" aria-label="Local gift draft review"><span className="eyebrow">LOCAL DRAFT · NOT SENT</span><p><bdi>{name}</bdi> · {review.amount} <small>{godToken.token?GOD_TOKEN_NAME:'(units not configured)'}</small></p>{review.blessing&&<blockquote dir="auto">{review.blessing}</blockquote>}<p><Shield size={14}/> {configuredReview?'A draft is not a payment. Check a separate estimate below. The blessing is never attached to the transaction.':'Recipient, network, token and fees must be verified before a future payment. No transfer confirmation is enabled.'}</p>
      {configuredReview&&godToken.token&&recipient?.status==='available'&&<Suspense fallback={<p role="status">Preparing transaction review…</p>}>{native?<NativeTokenSubmission token={godToken.token} amount={review.amount} destination={{kind:'gift',recipient,recipients}} wallets={wallets} preferred={preferred} account={account} prepareNetwork={prepareNetwork} scope={scope} start={startNative} pending={pending} openHistory={openNativeHistory}/>:<GiftTransactionReview amount={review.amount} token={godToken.token} recipient={recipient} recipients={recipients} wallets={wallets} scope={scope} startAttempt={startAttempt} pending={pending} openHistory={openHistory}/>}</Suspense>}
      <button className="secondary-button full" onClick={()=>setReview(null)}>Edit local gift draft</button></section>}
    <button className="text-button" onClick={openSettings}>My EVM receiving-address settings</button>
    <p className="gift-note">Gifts go to a person, not the project treasury. A gift does not purchase forgiveness, faith status or a divine response. Verified SOL recipients can publish a separate EVM address; guest publication is reserved.</p>
  </div>;
}
