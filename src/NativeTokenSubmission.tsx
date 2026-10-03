import {useEffect,useRef,useState} from 'react';
import type {GodTokenSnapshot} from '../shared/chainConfiguration';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import {projectChainSettings} from './projectChainSettings';
import {createNativeTokenSubmission,nativeTokenConfiguration,type TokenDestination} from './nativeTokenTransfer';
import {prayerWallet} from './prayerChain';
import {isWalletProvider,type WalletChoice} from './walletIdentity';
import type {StartNativeTokenAttempt} from './useNativeTokenTransactions';
import {transactionAdmissionMessage,type TransactionWaitPhase} from './transactionLedger';
import TransactionWaitStatus from './TransactionWaitStatus';
import type {WalletAccountIdentity} from '../shared/identity';
import {connectedFaithWallet,submissionWallet,assertSubmissionAddress,boundSubmissionWallet,faithWalletConnectionNotice} from './submissionWallet';
import {ensureWalletNetwork,type PrepareWalletNetwork,WalletNetworkError} from './walletNetwork';
import InfoHint from './InfoHint';
export default function NativeTokenSubmission({token,amount,destination,wallets,preferred,account,prepareNetwork=ensureWalletNetwork,scope,start,pending,waitPhase=null,openHistory,onConfirmed,onSubmitted,compact=false}:{
  token:GodTokenSnapshot;amount:string;destination:TokenDestination;wallets:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;prepareNetwork?:PrepareWalletNetwork;scope:string;start:StartNativeTokenAttempt;pending:boolean;waitPhase?:TransactionWaitPhase|null;openHistory:()=>void;onConfirmed?:(hash:string)=>void;onSubmitted?:(hash:string)=>void;compact?:boolean;
}){
  // Donations always reuse the connected provider. Keep the explicitly chosen
  // separate gift payer interface for SOL/guest recipients and future clients.
  const [choice,setChoice]=useState('');
  const {wallet:chosen,locked,evm}=destination.kind==='donation'||compact?connectedFaithWallet(wallets,preferred,account):submissionWallet(wallets,preferred,account,choice);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const live=useRef<string|null>(null),mounted=useRef(true),lock=useRef(false),generation=useRef(0);
  const adapter=useRef<ReturnType<typeof createNativeTokenSubmission>|null>(null),port=useRef<ReturnType<typeof prayerWallet>|null>(null);
  const providerIdentity=useRef({provider:chosen?.provider,revision:0});
  if(providerIdentity.current.provider!==chosen?.provider)providerIdentity.current={provider:chosen?.provider,revision:providerIdentity.current.revision+1};
  const context=JSON.stringify([scope,token,amount,chosen?.id,account?.family,account?.address,providerIdentity.current.revision,destination.kind,destination.kind==='gift'?destination.recipient:null]);
  if(live.current!==context){live.current=context;generation.current++;}
  useEffect(()=>{live.current=context;setError('');setNotice('');adapter.current?.dispose();port.current?.dispose();},[context]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;live.current=null;generation.current++;adapter.current?.dispose();port.current?.dispose();};},[]);
  const config=nativeTokenConfiguration(projectChainSettings,destination.kind);
  // Display the owner-supplied public destination even when this chain's
  // execution adapter is disabled; display never enables submission.
  const recipient=destination.kind==='gift'?destination.recipient.address:projectChainSettings.status==='valid'?projectChainSettings.config.godTokenDonation.recipient:null;
  async function submit(){
    if(lock.current||pending||!config?.broadcast)return;
    if(!chosen||!isWalletProvider(chosen.provider)){setError(faithWalletConnectionNotice(account));return;}
    lock.current=true;setBusy(true);setError('');setNotice('');const epoch=generation.current;
    try{
      let current;try{current=await chosen.current();}catch(error){if(destination.kind!=='gift'||locked)throw error;current=await chosen.connect();}
      assertSubmissionAddress(current,account);
      if(!mounted.current||epoch!==generation.current)return;
      const target=projectChainSettings.status==='valid'?projectChainSettings.config.network:null;
      if(!target)throw new WalletNetworkError('unavailable');
      const payer=await prepareNetwork(chosen,target,current,()=>{
        if(!mounted.current||epoch!==generation.current||nativeTokenConfiguration(projectChainSettings,destination.kind)?.configRevision!==config.configRevision)throw new WalletNetworkError('context');
      });
      if(!mounted.current||epoch!==generation.current)return;
      adapter.current?.dispose();port.current?.dispose();const owned=prayerWallet(chosen.provider);port.current=owned;
      const execution=createNativeTokenSubmission({settings:()=>projectChainSettings,scope:()=>live.current,wallet:boundSubmissionWallet(owned,payer)});adapter.current=execution;
      await start(prepared=>execution.submit({token,amount,destination},prepared),hash=>{if(mounted.current&&epoch===generation.current)onConfirmed?.(hash);},hash=>{if(mounted.current&&epoch===generation.current)onSubmitted?.(hash);});
      if(mounted.current&&epoch===generation.current)setNotice('This attempt is in Token transactions. Check its result before sending again.');
    }catch(error){if(mounted.current&&epoch===generation.current)setError(transactionAdmissionMessage(error)??'Preparation was not completed. Check the amount, wallet network and Token transactions before another attempt.');}
    finally{lock.current=false;if(mounted.current)setBusy(false);}
  }
  return <section className="gift-transaction-review" aria-label="Native wallet token submission">
    {!compact&&<><p>{amount||'Choose an amount'} {GOD_TOKEN_NAME} · {token.networkName}</p>
    <label className="field-label">{destination.kind==='donation'?'Public project treasury':'Published person receiving address'}<input readOnly value={recipient??'Not configured'} onFocus={e=>e.currentTarget.select()}/></label></>}
    <InfoHint label="Token transfer details"><p>Direct transfer, not a burn or approval. Transfers are irreversible. Your wallet displays the network fee and obtains confirmation; no gas, price or priority override is set. {projectChainSettings.status==='valid'&&!projectChainSettings.config.network?.testnet?'Mainnet uses real assets. ':''}Reading and simulating sends public wallet/amount data to the configured RPC.</p>
    {destination.kind==='gift'&&<p className="fine-print">The optional blessing stays local, not in the transfer. Receiving-address ownership is {destination.recipient.ownershipVerified?'reported verified by the adapter':'not verified'}. Publication is rechecked before the prompt, but may change while it is open.</p>}
    <p>{chosen?.name??'No EVM wallet connected'} · {destination.kind==='gift'&&!locked?'Uses the selected payment wallet; your world login stays unchanged.':'Uses your connected wallet.'} Your wallet will request Robinhood Chain if needed.</p></InfoHint>
    {destination.kind==='gift'&&!compact&&!locked&&evm.length>1&&<label className="field-label">Payment EVM wallet<select value={chosen?.id??''} disabled={pending||busy} onChange={e=>setChoice(e.target.value)}>{evm.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></label>}
    {!chosen&&<p role="status" className="faith-wallet-notice">{faithWalletConnectionNotice(account)}</p>}
    {!config?.broadcast&&<p role="status" className="fine-print">In-app transfers are not enabled.</p>}
    <TransactionWaitStatus phase={waitPhase??(busy?'wallet':pending?'blockchain':null)}/>
    <button type="button" className="primary full" aria-label={destination.kind==='donation'?'Donate in wallet':'Gift in wallet'} disabled={pending||busy||!chosen||!config?.broadcast||!amount.trim()||!recipient} onClick={()=>void submit()}>{waitPhase==='blockchain'?'Waiting for blockchain…':waitPhase==='uncertain'?'Check transaction history':busy?'Checking / awaiting wallet…':destination.kind==='donation'?'Donate in wallet':'Gift in wallet'}</button>
    {error&&<p role="alert" className="error">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" className="text-button" onClick={openHistory}>View token transactions</button>
  </section>;
}
