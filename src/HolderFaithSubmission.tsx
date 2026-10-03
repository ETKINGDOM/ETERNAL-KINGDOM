import {useEffect,useRef,useState,useImperativeHandle,type Ref} from 'react';
import {projectChainSettings} from './projectChainSettings';
import {holderFaithConfiguration} from './holderFaithReadiness';
import {createHolderFaithSubmission} from './holderFaithChain';
import {prayerWallet} from './prayerChain';
import {prepareHolderFaithPayload} from './crypto';
import {isWalletProvider,type WalletChoice} from './walletIdentity';
import type {HolderFaithKind} from '../shared/holderFaithRecords';
import type {StartHolderFaithAttempt} from './useHolderFaithTransactions';
import type {WalletAccountIdentity} from '../shared/identity';
import {connectedFaithWallet,faithWalletConnectionNotice,assertSubmissionAddress,boundSubmissionWallet} from './submissionWallet';
import {ensureWalletNetwork,WalletNetworkError,type PrepareWalletNetwork} from './walletNetwork';
import InfoHint from './InfoHint';
import {transactionAdmissionMessage} from './transactionLedger';

export type HolderFaithSubmissionHandle={submit():Promise<void>};
export default function HolderFaithSubmission({ref,kind,wallets,preferred,account,prepareNetwork=ensureWalletNetwork,scope,name,text,anonymous,encrypted,start,pending,onBusy,onReady,onConfirmed,openHistory}:{
  ref?:Ref<HolderFaithSubmissionHandle>;kind:HolderFaithKind;wallets:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;scope:string;name:string;text:string;anonymous:boolean;encrypted:boolean;
  prepareNetwork?:PrepareWalletNetwork;start:StartHolderFaithAttempt;pending:boolean;onBusy:(busy:boolean)=>void;onReady:(ready:boolean)=>void;onConfirmed:(id:string)=>void;openHistory:()=>void;
}){
  const {locked,wallet:chosen}=connectedFaithWallet(wallets,preferred,account);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const config=holderFaithConfiguration(projectChainSettings),enabled=Boolean(config?.broadcast);
  const lock=useRef(false),generation=useRef(0),live=useRef<string|null>(scope),mounted=useRef(true);
  const adapter=useRef<ReturnType<typeof createHolderFaithSubmission>|null>(null),port=useRef<ReturnType<typeof prayerWallet>|null>(null);
  const providerIdentity=useRef({provider:chosen?.provider,revision:0});
  if(providerIdentity.current.provider!==chosen?.provider)providerIdentity.current={provider:chosen?.provider,revision:providerIdentity.current.revision+1};
  const context=JSON.stringify([scope,kind,name,text,anonymous,encrypted,chosen?.id,account?.family,account?.address,providerIdentity.current.revision]),previous=useRef(context);
  if(previous.current!==context){previous.current=context;generation.current++;}live.current=context;
  useEffect(()=>{setError('');setNotice('');adapter.current?.dispose();port.current?.dispose();},[context]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;live.current=null;generation.current++;adapter.current?.dispose();port.current?.dispose();};},[]);
  useEffect(()=>{onReady(Boolean(chosen));return()=>onReady(false);},[onReady,chosen]);
  useImperativeHandle(ref,()=>({async submit(){
    if(lock.current||pending)return;
    if(!enabled||!config){setError('Holder faith submission is not connected. Nothing was sent.');return;}
    if(!chosen||!isWalletProvider(chosen.provider)){setError(faithWalletConnectionNotice(account));return;}
    lock.current=true;onBusy(true);setError('');setNotice('');const epoch=generation.current;
    adapter.current?.dispose();port.current?.dispose();
    try{
      const payload=await prepareHolderFaithPayload({kind,name,text,anonymous,encrypted});
      if(!mounted.current||epoch!==generation.current)return;
      const current=await chosen.current();
      assertSubmissionAddress(current,account);
      if(!mounted.current||epoch!==generation.current)return;
      const network=projectChainSettings.status==='valid'?projectChainSettings.config.network:null;
      if(!network)throw new WalletNetworkError('unavailable');
      const payer=await prepareNetwork(chosen,network,current,()=>{
        if(!mounted.current||epoch!==generation.current||holderFaithConfiguration(projectChainSettings)?.configRevision!==config.configRevision)throw new WalletNetworkError('context');
      });
      if(!mounted.current||epoch!==generation.current)return;
      const owned=prayerWallet(chosen.provider);port.current=owned;
      const execution=createHolderFaithSubmission({settings:()=>projectChainSettings,scope:()=>live.current,wallet:boundSubmissionWallet(owned,payer)});adapter.current=execution;
      const outcome=await start(prepared=>execution.submit(payload,prepared),id=>{if(mounted.current&&epoch===generation.current)onConfirmed(id);});
      if(mounted.current&&epoch===generation.current){
        if(outcome==='insufficient')setError('At least 1 whole God token is required in the submitting EVM wallet. No transaction was requested.');
        else if(outcome==='cancelled')setNotice('Wallet confirmation cancelled. Nothing will be retried automatically.');
        else if(outcome==='not-submitted'){setError(`No transaction was requested. Check your EVM wallet is on ${config.networkName} and the record connection is available.`);setNotice('Track this attempt in Faith transactions.');}
        else setNotice('Track this attempt in Faith transactions. Do not resend while its outcome is unknown.');
      }
    }catch(error){if(mounted.current&&epoch===generation.current)setError(transactionAdmissionMessage(error)??(error instanceof WalletNetworkError?error.message:'Could not prepare this record. Check your wallet network and Faith transactions before another attempt.'));}
    finally{lock.current=false;if(mounted.current)onBusy(false);}
  }}));
  return <section className="prayer-chain-options" aria-label="Holder faith chain submission">
    <p className="faith-holding-rule">Hold at least 1 God.</p>
    <InfoHint label="Holding and submission details">
    <p className="fine-print">Hold at least 1 whole configured God token in the submitting EVM wallet. No token is deducted, approved or burned. Your wallet displays and confirms network Gas. The record contract checks holding again at execution.</p>
    <p className="fine-print">{encrypted?'Only ciphertext and its IV leave this composer. The encryption key is discarded permanently.':'Public words leave this composer for the public RPC and wallet, even if you later cancel.'} Hiding your name does not hide the submitting wallet. Confirmed records cannot be edited or removed by this app.</p>
      {enabled&&config&&<p className="fine-print">{config.networkName} · {chosen?.name??(locked?'Restoring your connected EVM wallet…':'No EVM wallet connected')}. {chosen?'Uses your connected wallet. Your wallet will request Robinhood Chain if needed.':'Connect your EVM wallet in your profile to submit.'}</p>}
    </InfoHint>
    {enabled&&config?<>
      {!chosen&&<p className="faith-wallet-notice" role="status">{faithWalletConnectionNotice(account)}</p>}
    </>:<p className="fine-print">The token and deployed holder record contract are not enabled. This remains a local preview, not an onchain record.</p>}
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" className="text-button" onClick={openHistory}>Faith transactions</button>
  </section>;
}
