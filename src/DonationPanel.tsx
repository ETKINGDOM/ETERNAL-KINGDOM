import {lazy,Suspense,useRef,useState} from 'react';
import {chainBroadcast,configuredGodToken} from '../shared/chainConfiguration';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import {projectChainSettings} from './projectChainSettings';
import {useGodToken} from './useGodToken';
import type {WalletChoice} from './walletIdentity';
import type {StartNativeTokenAttempt} from './useNativeTokenTransactions';
import RitualFeedback from './RitualFeedback';
import PublicDonationAddresses from './PublicDonationAddresses';
import type {RitualFeedbackPort} from './ritualFeedbackState';
import type {TransactionWaitPhase} from './transactionLedger';
import type {WalletAccountIdentity} from '../shared/identity';
import type {PrepareWalletNetwork} from './walletNetwork';
import InfoHint from './InfoHint';
import './donations.css';
const DonationLeaderboard=lazy(()=>import('./DonationLeaderboard'));
const GodTokenPanel=lazy(()=>import('./GodTokenPanel'));
const NativeTokenSubmission=lazy(()=>import('./NativeTokenSubmission'));
const showToken=projectChainSettings.status==='invalid'||Boolean(configuredGodToken(projectChainSettings));
export default function DonationPanel({account,wallets,preferred,prepareNetwork,scope,start,pending,waitPhase=null,openHistory,soundEnabled,onSpeakingChange,onComplete}:{account?:WalletAccountIdentity;wallets:WalletChoice[];preferred?:WalletChoice;prepareNetwork?:PrepareWalletNetwork;scope:string;start:StartNativeTokenAttempt;pending:boolean;waitPhase?:TransactionWaitPhase|null;openHistory:()=>void;soundEnabled:boolean;onSpeakingChange:(playing:boolean)=>void;onComplete?:()=>void}){
  const [tab,setTab]=useState<'give'|'view'>('give');
  const [amount,setAmount]=useState('');const godToken=useGodToken();
  const feedback=useRef<RitualFeedbackPort>(null);
  function confirmed(id:string){if(!id.trim())return;feedback.current?.complete({kind:'donation',state:'confirmed',confirmationId:id});onComplete?.();}
  const broadcast=chainBroadcast(projectChainSettings,'donations');
  return <section aria-label="Donation options">
    <div className="donation-tabs" role="group" aria-label="Donation views"><button type="button" aria-pressed={tab==='give'} onClick={()=>setTab('give')}>Donate</button><button type="button" aria-pressed={tab==='view'} onClick={()=>setTab('view')}>View donations</button></div>
    {tab==='give'?<><InfoHint label="Donation details"><p className="muted">Voluntary donations will support project construction, faith workers and clearly disclosed charitable purposes.</p>
      <p className="fine-print">God token donations use an EVM receiving address and are listed separately from general EVM donations. BTC and SOL have independent addresses. Donations do not purchase forgiveness or spiritual status.</p>
      <p>{broadcast?'Donations use the configured network. Opening this panel does not request a payment.':'In-app payments are not enabled. Opening this panel does not request a payment.'} View donations shows only verified incoming transfers when the ranking source is configured.</p></InfoHint>
      <PublicDonationAddresses/>
      {showToken&&<Suspense fallback={<p role="status">Preparing configured token…</p>}><GodTokenPanel compact account={account?.family==='evm'?account.address:undefined}/></Suspense>}
      {godToken.token?<><label className="field-label">Donation amount · {GOD_TOKEN_NAME}<input type="text" inputMode="decimal" autoComplete="off" maxLength={116} value={amount} disabled={pending} onChange={e=>{setAmount(e.target.value);feedback.current?.clear();}} placeholder="e.g. 1"/></label><Suspense fallback={<p role="status">Preparing wallet options…</p>}><NativeTokenSubmission token={godToken.token} amount={amount} destination={{kind:'donation'}} wallets={wallets} preferred={preferred} account={account} prepareNetwork={prepareNetwork} scope={scope} start={start} pending={pending} waitPhase={waitPhase} openHistory={openHistory} onConfirmed={confirmed}/></Suspense><RitualFeedback ref={feedback} soundEnabled={soundEnabled} onSpeakingChange={onSpeakingChange}/></>:<button className="primary full" disabled>In-app donations coming later</button>}</>:
      <Suspense fallback={<p role="status">Preparing donation ranking…</p>}><DonationLeaderboard/></Suspense>}
  </section>;
}
