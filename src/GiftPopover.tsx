import {useEffect,useRef,useState} from 'react';
import {Gift,X,RefreshCw} from 'lucide-react';
import {giftTargetKey,validatedGiftRecipient,type GiftTarget,type GiftRecipientResult,type PersonGiftRecipientAdapter} from '../shared/gifts';
import type {WalletAccountIdentity} from '../shared/identity';
import type {WalletChoice} from './walletIdentity';
import type {PrepareWalletNetwork} from './walletNetwork';
import type {StartNativeTokenAttempt} from './useNativeTokenTransactions';
import type {TransactionWaitPhase} from './transactionLedger';
import {useGodToken} from './useGodToken';
import {useGodBalance} from './useGodBalance';
import {giftAmountUnits} from '../shared/gifts';
import {projectChainSettings} from './projectChainSettings';
import {prepareGodTokenTransfer} from './godTokenService';
import NativeTokenSubmission from './NativeTokenSubmission';
import InfoHint from './InfoHint';
import './personMenu.css';
export default function GiftPopover({target,name,recipients,wallets,preferred,account,prepareNetwork,scope,start,pending,waitPhase=null,openHistory,openSettings,close}:{target:GiftTarget;name:string;recipients:PersonGiftRecipientAdapter;wallets:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;prepareNetwork:PrepareWalletNetwork;scope:string;start:StartNativeTokenAttempt;pending:boolean;waitPhase?:TransactionWaitPhase|null;openHistory:()=>void;openSettings:()=>void;close:()=>void}){
  const god=useGodToken(),key=giftTargetKey(target),current=useRef(scope);current.current=scope;
  const [resolved,setResolved]=useState<{key:string;value:GiftRecipientResult}|null>(null),[amount,setAmount]=useState(''),[error,setError]=useState(''),[reload,setReload]=useState(0),[connecting,setConnecting]=useState(false);
  const [payer,setPayer]=useState<{wallet:WalletChoice;account:WalletAccountIdentity}|null>(null),mounted=useRef(true);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
  useEffect(()=>{const controller=new AbortController();setResolved(null);setError('');setAmount('');setPayer(null);void recipients.lookup(target,controller.signal).then(value=>{if(!controller.signal.aborted)setResolved({key,value:validatedGiftRecipient(target,value)});}).catch(()=>{if(!controller.signal.aborted)setError('Receiving address unavailable. Try again.');});return()=>controller.abort();},[key,recipients,reload]);
  const recipient=resolved?.key===key?resolved.value:null,address=recipient?.status==='available'?recipient.address:null;
  const connected=account?.family==='evm'?{wallet:preferred,account}:payer;
  const balance=useGodBalance(god.token,connected?.account.address,scope);
  let validAmount=false;try{if(amount&&address&&god.token){prepareGodTokenTransfer(projectChainSettings,god.token,address,amount);validAmount=true;}}catch{}
  const insufficient=validAmount&&balance.status==='available'&&balance.balance!==null&&giftAmountUnits(amount,god.token!.decimals)>balance.balance.units;
  const selfGift=Boolean(address&&connected?.account.address.toLowerCase()===address.toLowerCase());
  const payable=validAmount&&!insufficient&&!selfGift&&balance.status==='available';
  async function connect(wallet:WalletChoice){if(connecting||pending)return;const context=scope;setConnecting(true);setError('');try{const value=await wallet.connect();if(mounted.current&&current.current===context&&value.family==='evm')setPayer({wallet,account:value});}catch{if(mounted.current&&current.current===context)setError('EVM connection did not finish. No transfer requested.');}finally{if(mounted.current)setConnecting(false);}}
  return <section className="private-gift-popover" aria-label={`Gift to ${name}`}><header><Gift size={18}/><h3>Gift · <bdi>{name}</bdi></h3>{target.kind==='wallet'&&<button className="icon-button" aria-label="Refresh published receiving address" disabled={pending||connecting} onClick={()=>setReload(v=>v+1)}><RefreshCw size={15}/></button>}<button className="icon-button" aria-label="Close gift" onClick={close}><X size={16}/></button></header>
    <InfoHint label="Gift details"><p>Uses the configured God token on Robinhood Chain. Your wallet confirms the network fee and transfer. No token approval, burn or blessing text is attached.</p><p>This is a one-way gift, not an exchange or spiritual purchase. The published receiving address is checked again before requesting payment. Its ownership is not proven by the display name.</p><p>A returned transaction hash closes this panel; only a verified receipt means success. Never resend an unresolved attempt. SOL login can connect a separate EVM payer here without changing its world identity.</p></InfoHint>
    {target.kind==='guest'?<p role="status">This guest has no published EVM address.</p>:!recipient&&!error?<p role="status">Checking receiving address…</p>:!address?<p role="status">{recipient?.status==='disabled'?'Gifts are disabled by this person.':'No published EVM receiving address.'}</p>:<>
      <label className="field-label">EVM receiving address<input readOnly value={address} onFocus={e=>e.currentTarget.select()}/></label>
      {connected?.account&&<><p role="status" aria-label="God gift balance">{balance.status==='available'?`Available: ${balance.balance!.display} God`:balance.status==='error'?'Balance unavailable. Retry before gifting.':'Checking your God balance…'}</p>{balance.status==='error'&&<button className="text-button" onClick={()=>void balance.refresh()}>Retry God balance</button>}</>}
      <label className="field-label" htmlFor="gift-amount">God amount</label><input id="gift-amount" type="text" inputMode="decimal" autoComplete="off" maxLength={116} value={amount} onChange={e=>setAmount(e.target.value)} placeholder="0.00"/>
      {amount&&!validAmount&&god.token&&<p role="status">Enter a positive amount within the token’s precision.</p>}
      {insufficient&&<p role="status">Insufficient God balance.</p>}{selfGift&&<p role="status">Choose another person’s receiving address, not your own wallet.</p>}
      {!connected?.wallet&&(account?.family==='evm'?<><p role="status">Your EVM wallet is not available. Reconnect from your profile.</p><button className="secondary-button" disabled={pending} onClick={openSettings}>Reconnect wallet</button></>:<><p role="status">Connect an EVM payment wallet.</p>{wallets.filter(w=>w.family==='evm').map(w=><button className="secondary-button" key={w.id} disabled={connecting||pending} onClick={()=>void connect(w)}>{connecting?'Connecting…':`Connect ${w.name}`}</button>)}</>)}
      {god.token&&recipient?.status==='available'&&<NativeTokenSubmission compact token={god.token} amount={payable?amount:''} destination={{kind:'gift',recipient,recipients}} wallets={wallets} preferred={connected?.wallet} account={connected?.account} prepareNetwork={prepareNetwork} scope={scope} start={start} pending={pending} waitPhase={waitPhase} openHistory={openHistory} onSubmitted={close}/>}
      {!god.token&&<p role="status">{god.status==='loading'?'Checking God settings…':god.status==='error'?'God settings unavailable.':'God is not configured.'}</p>}
    </>}
    {error&&<p role="alert">{error}</p>}{error&&<button className="text-button" onClick={()=>setReload(v=>v+1)}>Retry receiving address</button>}
    <button className="text-button" onClick={openSettings}>My receiving address</button>
  </section>;
}
