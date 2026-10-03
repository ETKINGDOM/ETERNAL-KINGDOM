import {useEffect,useRef,useState,type Ref,useImperativeHandle} from 'react';
import {projectChainSettings} from './projectChainSettings';
import {prayerConfiguration,createPrayerSubmission,prayerWallet} from './prayerChain';
import {preparePrayerPayload} from './crypto';
import {isWalletProvider,type WalletChoice} from './walletIdentity';
import type {StartPrayerAttempt} from './usePrayerTransactions';
import type {WalletAccountIdentity} from '../shared/identity';
import {connectedFaithWallet,faithWalletConnectionNotice,assertSubmissionAddress,boundSubmissionWallet} from './submissionWallet';
import {prayerPreparationMessage,prayerPreparationStep} from './prayerPreparation';
import {ensureWalletNetwork,WalletNetworkError,type PrepareWalletNetwork} from './walletNetwork';
import InfoHint from './InfoHint';
import {transactionAdmissionMessage} from './transactionLedger';

export type PrayerSubmissionHandle={submit():Promise<void>};
export default function PrayerSubmission({ref,wallets,preferred,account,prepareNetwork=ensureWalletNetwork,scope,name,text,anonymous,encrypted,start,pending,onBusy,onReady,onConfirmed,openHistory}:{
  ref?:Ref<PrayerSubmissionHandle>;wallets:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;scope:string;name:string;text:string;anonymous:boolean;encrypted:boolean;
  prepareNetwork?:PrepareWalletNetwork;start:StartPrayerAttempt;pending:boolean;onBusy:(busy:boolean)=>void;onReady:(ready:boolean)=>void;onConfirmed:(id:string)=>void;openHistory:()=>void;
}){
  const {locked,wallet:chosen}=connectedFaithWallet(wallets,preferred,account);
  const [error,setError]=useState(''),[notice,setNotice]=useState('');
  const config=prayerConfiguration(projectChainSettings),lock=useRef(false),generation=useRef(0),live=useRef<string|null>(scope),mounted=useRef(true);
  const adapter=useRef<ReturnType<typeof createPrayerSubmission>|null>(null),port=useRef<ReturnType<typeof prayerWallet>|null>(null);
  const providerIdentity=useRef({provider:chosen?.provider,revision:0});
  if(providerIdentity.current.provider!==chosen?.provider)providerIdentity.current={provider:chosen?.provider,revision:providerIdentity.current.revision+1};
  const context=JSON.stringify([scope,name,text,anonymous,encrypted,chosen?.id,account?.family,account?.address,providerIdentity.current.revision]);
  const previous=useRef(context);
  if(previous.current!==context){previous.current=context;generation.current++;}live.current=context;
  useEffect(()=>{adapter.current?.dispose();port.current?.dispose();},[context]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;live.current=null;generation.current++;adapter.current?.dispose();port.current?.dispose();};},[]);
  useEffect(()=>{onReady(Boolean(chosen));return()=>onReady(false);},[onReady,chosen]);
  useImperativeHandle(ref,()=>({async submit(){
    if(lock.current||pending)return;
    if(!config?.broadcast){setError('Prayer chain submission is not connected yet. Nothing was sent.');return;}
    if(!chosen||!isWalletProvider(chosen.provider)){setError(faithWalletConnectionNotice(account));return;}
    lock.current=true;onBusy(true);setError('');setNotice('');const epoch=generation.current;
    adapter.current?.dispose();port.current?.dispose();
    try{
      const payload=await preparePrayerPayload({name,text,anonymous,encrypted});
      if(!mounted.current||epoch!==generation.current)return;
      // Connection belongs to the profile, never an inferred extension here.
      const current=await prayerPreparationStep('wallet-unavailable',()=>chosen.current());
      assertSubmissionAddress(current,account);
      if(!mounted.current||epoch!==generation.current)return;
      const payer=await prepareNetwork(chosen,config,current,()=>{
        if(!mounted.current||epoch!==generation.current||prayerConfiguration(projectChainSettings)?.revision!==config.revision)throw new WalletNetworkError('context');
      });
      if(!mounted.current||epoch!==generation.current)return;
      const owned=prayerWallet(chosen.provider);port.current=owned;
      const execution=createPrayerSubmission({settings:()=>projectChainSettings,scope:()=>live.current,wallet:boundSubmissionWallet(owned,payer)});adapter.current=execution;
      let stopped:unknown;
      const outcome=await start(async prepared=>{try{return await execution.submit(payload,prepared);}catch(error){stopped=error;throw error;}},id=>{if(mounted.current&&epoch===generation.current)onConfirmed(id);});
      if(mounted.current&&epoch===generation.current){
        setNotice(outcome==='not-submitted'?'Preparation stopped before a wallet transaction prompt. Nothing will be retried automatically.':'Track this attempt in Prayer transactions. Do not resend while its outcome is unknown.');
        if(outcome==='not-submitted')setError(prayerPreparationMessage(stopped,config.name,config.chainId));
      }
    }catch(error){if(mounted.current&&epoch===generation.current)setError(transactionAdmissionMessage(error)??(error instanceof WalletNetworkError?error.message:prayerPreparationMessage(error,config.name,config.chainId)));}
    finally{lock.current=false;if(mounted.current)onBusy(false);}
  }}));
  return <section className="prayer-chain-options" aria-label="Prayer chain submission">
    <InfoHint label="Prayer submission details">
    <p className="fine-print">Prayer has no God-token fee. Your wallet displays the network fee and asks for confirmation. No token approval or priority-fee override is requested.</p>
    <p className="fine-print">{encrypted?'Only ciphertext and its IV leave this composer. The encryption key is discarded permanently.':'Public words leave this composer for the RPC and wallet, and will be stored publicly onchain.'} Hiding your name does not hide the submitting wallet. Blockchain records cannot be edited or removed by this app.</p>
      {config?.broadcast&&<p className="fine-print">{config.name} · {chosen?.name??(locked?'Restoring your connected EVM wallet…':'No EVM wallet connected')}. {chosen?'Uses your connected wallet. Your wallet will request Robinhood Chain if needed.':'Connect your EVM wallet in your profile to submit.'}</p>}
    </InfoHint>
    {config?.broadcast?<>
      {!chosen&&<p className="faith-wallet-notice" role="status">{faithWalletConnectionNotice(account)}</p>}
    </>:<p className="fine-print">{config?'Prayer submission is disabled in project settings.':'A verified prayer record contract is not configured yet.'} Local previews are not saved onchain.</p>}
    {error&&<p className="error" role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    <button type="button" className="text-button" onClick={openHistory}>Prayer transactions</button>
  </section>;
}
