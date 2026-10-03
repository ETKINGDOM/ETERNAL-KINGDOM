import { useEffect,useRef,useState } from 'react';
import { formatUnits,type Address,type Hash } from 'viem';
import type { PublishedGiftRecipient,PersonGiftRecipientAdapter } from '../shared/gifts';
import { giftAmountUnits } from '../shared/gifts';
import type { GodTokenSnapshot } from '../shared/chainConfiguration';
import { configuredGodToken } from '../shared/chainConfiguration';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import { projectChainSettings } from './projectChainSettings';
import { isWalletProvider,type WalletChoice } from './walletIdentity';
import { injectedEvmGiftWallet,evmGiftRpcPort } from './evmGiftPorts';
import { createEvmPersonGiftExecution,type PreparedPersonGift } from './evmPersonGiftExecution';
import { prepareGodTokenTransfer } from './godTokenService';
import { verifiedGiftReceipt } from './giftReceipt';
import type { StartGiftAttempt } from './useGiftTransactions';
import {transactionAdmissionMessage} from './transactionLedger';

export default function GiftTransactionReview({amount,token,recipient,recipients,wallets,scope,startAttempt,pending,openHistory}:{
  amount:string;token:GodTokenSnapshot;recipient:PublishedGiftRecipient;recipients:PersonGiftRecipientAdapter;wallets:WalletChoice[];
  scope:string;startAttempt:StartGiftAttempt;pending:boolean;openHistory:()=>void;
}){
  const [chosen,setChosen]=useState<WalletChoice|null>(null),[quote,setQuote]=useState<PreparedPersonGift|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[checked,setChecked]=useState(false),[irreversible,setIrreversible]=useState(false),[notice,setNotice]=useState('');
  const [expired,setExpired]=useState(false);
  const live=useRef<string|null>(scope);live.current=scope;
  const generation=useRef(0),lock=useRef(false),request=useRef<AbortController|null>(null),mounted=useRef(true);
  const execution=useRef<ReturnType<typeof createEvmPersonGiftExecution>|null>(null);
  const config=projectChainSettings.status==='valid'?projectChainSettings.config:null;
  const supported=Boolean(config?.network?.testnet&&config.network.executionFeeModel==='standard-evm');
  const broadcast=Boolean(supported&&config?.testnetGiftBroadcast);
  const evmWallets=wallets.filter(w=>w.family==='evm');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;live.current=null;generation.current++;request.current?.abort();};},[]);
  useEffect(()=>{
    generation.current++;request.current?.abort();setQuote(null);setChecked(false);setIrreversible(false);setExpired(false);
    if(!chosen||!isWalletProvider(chosen.provider))return;
    let release:(()=>void)|undefined,port:ReturnType<typeof injectedEvmGiftWallet>|undefined,adapter:ReturnType<typeof createEvmPersonGiftExecution>|undefined;
    try {
      port=injectedEvmGiftWallet(chosen.provider);
      adapter=createEvmPersonGiftExecution({settings:()=>projectChainSettings,scope:()=>live.current,wallet:port,recipients,allowTestnetBroadcast:broadcast});
      execution.current=adapter;
      release=chosen.subscribe(()=>{generation.current++;request.current?.abort();setQuote(null);setChecked(false);setIrreversible(false);setError('Payment wallet changed. Review a new estimate.');});
    } catch {setError('This EVM payment wallet could not be initialized. No payment was requested.');}
    return()=>{generation.current++;request.current?.abort();if(execution.current===adapter)execution.current=null;adapter?.dispose();release?.();port?.dispose();};
  },[chosen,scope,recipients,broadcast]);
  useEffect(()=>{
    setExpired(false);if(!quote)return;
    const timer=setTimeout(()=>{setExpired(true);setChecked(false);setIrreversible(false);},Math.max(0,quote.expiresAt-Date.now()));return()=>clearTimeout(timer);
  },[quote]);
  async function connect(wallet:WalletChoice){
    if(lock.current)return;lock.current=true;setBusy(true);setError('');setQuote(null);setChecked(false);setIrreversible(false);
    const epoch=++generation.current;
    try {const account=await wallet.connect();if(account.family!=='evm')throw Error('Wrong wallet family');if(mounted.current&&epoch===generation.current)setChosen(wallet);}
    catch {if(mounted.current&&epoch===generation.current)setError('EVM payment-wallet connection was not completed. Your world login is unchanged.');}
    finally {lock.current=false;if(mounted.current)setBusy(false);}
  }
  async function estimate(){
    const adapter=execution.current;if(!adapter||lock.current)return;
    lock.current=true;setBusy(true);setError('');setNotice('');setQuote(null);setChecked(false);setIrreversible(false);
    const controller=new AbortController();request.current=controller;const epoch=++generation.current;
    try {const prepared=await adapter.prepare({recipient,asset:token,amount:giftAmountUnits(amount,token.decimals)},controller.signal);
      if(mounted.current&&epoch===generation.current)setQuote(prepared);
    } catch {if(mounted.current&&epoch===generation.current)setError('Estimate could not be verified. Check the configured test network, token/native balances and current receiving settings. No transfer was requested.');}
    finally {controller.abort();if(request.current===controller)request.current=null;lock.current=false;if(mounted.current)setBusy(false);}
  }
  async function submit(){
    const adapter=execution.current,current=quote;
    if(!broadcast||!adapter||!current||!checked||!irreversible||expired||Date.now()>=current.expiresAt||lock.current||pending)return;
    lock.current=true;setBusy(true);setQuote(null);setChecked(false);setIrreversible(false);setError('');
    try {
      // Retain immutable proof/RPC independently of this modal's lifecycle.
      const transfer=prepareGodTokenTransfer(projectChainSettings,current.asset as GodTokenSnapshot,current.recipient.address,formatUnits(current.amount,current.asset.decimals));
      const rpcUrl=configuredGodToken(projectChainSettings)!.rpcUrl;
      await startAttempt({network:current.asset.networkName,chainId:current.asset.chainId,payer:current.payer,recipient:current.recipient.address,
        token:current.asset.contract,amount:formatUnits(current.amount,current.asset.decimals),symbol:current.asset.symbol},
        ()=>adapter.submit(current),
        (hash:Hash,signal:AbortSignal)=>verifiedGiftReceipt(evmGiftRpcPort(rpcUrl,signal),transfer,current.payer as Address,hash,signal));
      if(mounted.current)setNotice('This attempt is listed in Gift transactions. Check its status before another attempt.');
    } catch(error) {if(mounted.current)setError(transactionAdmissionMessage(error)??'A confirmation is already open or preparation became invalid. Check Gift transactions and your wallet; do not resend blindly.');}
    finally {lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <section className="gift-transaction-review" aria-label="EVM gift transaction review">
    <h3>{broadcast?'Testnet transfer confirmation':'Read-only testnet estimate'}</h3>
    {!supported?<p className="gift-note">This network needs its own fee adapter. Transfers and estimates are unavailable.</p>:<>
      <p className="gift-note">Choose a separate EVM payment wallet. This does not replace your SOL/EVM/guest world login or authorize a payment. No chain switch, approval or login signature is automatic.</p>
      <div className="gift-wallet-choices">{evmWallets.map(wallet=><button className="secondary-button full" key={wallet.id} disabled={busy} onClick={()=>void connect(wallet)}>Connect {wallet.name} for gift estimate</button>)}</div>
      {!evmWallets.length&&<p>No injected EVM payment wallet found. Open this site in an EVM wallet browser or install an EVM wallet. SOL wallets cannot sign this transfer.</p>}
      {chosen&&<><p>Payment wallet: {chosen.name}</p><p className="gift-note">Estimating sends payer/recipient addresses and amount to the project-configured public RPC and re-reads public receiving settings. Your optional blessing stays in this browser. Nothing is signed or sent to the chain.</p><button className="secondary-button full" disabled={busy} onClick={()=>void estimate()}>{busy?'Checking gift…':'Estimate gift — no payment'}</button></>}
      {quote&&<div className="gift-local-review" role="region" aria-label="Verified gift estimate">
        <p>{formatUnits(quote.amount,quote.asset.decimals)} {GOD_TOKEN_NAME} · {quote.asset.networkName} · chain {quote.asset.chainId}</p>
        <dl className="gift-transaction-fields"><dt>From</dt><dd><code>{quote.payer}</code></dd><dt>To · ownership {quote.recipient.ownershipVerified?'verified by adapter':'not verified'}</dt><dd><code>{quote.recipient.address}</code></dd>
          <dt>Gas limit · includes 20% buffer</dt><dd>{quote.gasLimit.toString()}</dd><dt>Estimated fee ceiling · not a final fee</dt><dd>{formatUnits(quote.feeCeiling,18)} {quote.nativeSymbol} ({quote.feeCeiling.toString()} base units)</dd></dl>
        <p role="status">{expired?'Estimate expired. Request a new estimate.':'Valid for at most 60 seconds. Receiving settings, wallet and fees are rechecked before the wallet prompt.'}</p>
        {broadcast?<><label className="gift-consent"><input type="checkbox" checked={checked} disabled={busy||expired} onChange={e=>setChecked(e.target.checked)}/>I checked the full recipient address, token, test network, amount and fee ceiling.</label>
          <label className="gift-consent"><input type="checkbox" checked={irreversible} disabled={busy||expired} onChange={e=>setIrreversible(e.target.checked)}/>I understand a transfer is irreversible; publication can change during wallet confirmation. My blessing is not sent.</label>
          <button className="primary full" disabled={busy||pending||expired||!checked||!irreversible} onClick={()=>void submit()}>Confirm testnet gift in wallet</button></>:<p className="gift-note">Broadcasting is disabled in project settings. This estimate cannot open a payment prompt.</p>}
      </div>}
    </>}
    {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {pending&&<p role="status">A gift confirmation is already in progress. Check your wallet and Gift transactions.</p>}
    <button className="text-button" onClick={openHistory}>View gift transactions</button>
  </section>;
}
