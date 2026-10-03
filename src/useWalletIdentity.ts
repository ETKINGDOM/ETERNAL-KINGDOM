import { useEffect, useRef, useState } from 'react';
import { getWallets } from '@wallet-standard/app';
import type { Wallet } from '@wallet-standard/base';
import { sameWalletAccount, type WalletAccountIdentity, type WalletSession } from '../shared/identity';
import { evmWallet, hostedIdentity, isWalletProvider, type WalletChoice } from './walletIdentity';
import { isSolanaWallet, solanaWallet } from './solanaWallet';
import { discoverInjectedSolana, mergeSolanaChoice } from './injectedSolanaWallet';
import { discoverInjectedEvm, mergeEvmChoice } from './injectedEvmWallet';
import {readBrowserRememberedWallet,saveBrowserRememberedWallet,rememberedChoice,matchesRememberedAccount,readWalletQuietly,type RememberedWallet} from './rememberedWallet';
import {ensureWalletNetwork,matchesSessionNetwork,sameWalletAddress,WalletNetworkError,type WalletNetwork} from './walletNetwork';
import {projectChainSettings} from './projectChainSettings';
import {releaseStorageKey} from './releaseScope';

type Connection=WalletAccountIdentity&{wallet:WalletChoice};
const REVOKE_KEY=releaseStorageKey('ek:auth:signout-pending'),PROVIDER_KEY=releaseStorageKey('ek:auth:provider');
const pendingRevoke=()=>{try{return localStorage.getItem(REVOKE_KEY)==='1';}catch{return false;}};
const markRevoke=(pending:boolean)=>{try{if(pending)localStorage.setItem(REVOKE_KEY,'1');else localStorage.removeItem(REVOKE_KEY);}catch{/* In-memory state still fails closed. */}};
function authStorageAvailable(){try{localStorage.setItem('ek:auth:storage-check','1');localStorage.removeItem('ek:auth:storage-check');return true;}catch{return false;}}
export function useWalletIdentity(){
  const [wallets,setWallets]=useState<WalletChoice[]>([]),[session,setSession]=useState<WalletSession|null>(null);
  const [connection,setConnection]=useState<Connection|null>(null),[busy,setBusy]=useState<'connect'|'sign'|'logout'|null>(null);
  const [error,setError]=useState(''),[ready,setReady]=useState(false);
  const [lastLogin,setLastLogin]=useState(readBrowserRememberedWallet),lastRef=useRef(lastLogin);
  function remember(value:RememberedWallet){lastRef.current=value;setLastLogin(value);saveBrowserRememberedWallet(value);}
  function pauseRememberedConnection(){const last=lastRef.current;if(last?.resume)remember({...last,resume:false});}
  const revoking=useRef(pendingRevoke()),[pendingSignout,setPendingSignout]=useState(revoking.current);
  function setRevocation(pending:boolean){revoking.current=pending;setPendingSignout(pending);markRevoke(pending);}
  const revision=useRef(0),live=useRef(true),connected=useRef(connection),currentSession=useRef(session);connected.current=connection;currentSession.current=session;
  const selected=useRef<WalletChoice|null>(null),unlisten=useRef(()=>{}),broadcast=useRef<BroadcastChannel|null>(null);
  const rescanRef=useRef(()=>{});
  const activeAttempt=useRef<number|null>(null);
  const networkRequest=useRef<{wallet:WalletChoice;address:WalletAccountIdentity;target:WalletNetwork;version:number}|null>(null);
  const targetNetwork=projectChainSettings.status==='valid'?projectChainSettings.config.network:null;
  const matchesSession=(wallet:WalletChoice,account:WalletAccountIdentity,expected:WalletSession)=>{
    const approved=networkRequest.current;
    return matchesSessionNetwork(account,expected,wallet,lastRef.current,targetNetwork)||Boolean(approved?.version===revision.current&&approved.wallet.provider===wallet.provider&&sameWalletAddress(account,expected)&&account.chainId===approved.target.chainId);
  };
  const restoring=useRef(false),restoreRef=useRef(()=>{});
  const queue=useRef<Promise<unknown>>(Promise.resolve());
  const enqueue=<T,>(work:()=>Promise<T>):Promise<T>=>{const next=queue.current.then(work,work);queue.current=next.catch(()=>{});return next;};
  async function logout(note='',keepRememberedConnection=false){
    if(!keepRememberedConnection)pauseRememberedConnection();
    revision.current++;activeAttempt.current=null;setRevocation(true);setSession(null);setConnection(null);connected.current=null;currentSession.current=null;setError(note);setBusy('logout');
    try{await enqueue(()=>hostedIdentity.logout());setRevocation(false);broadcast.current?.postMessage('changed');}
    catch{if(live.current)setError('Sign-out could not be confirmed. Retry before signing in again. You can still explore as a guest.');}
    finally{if(live.current)setBusy(null);}
  }
  const logoutRef=useRef(logout);logoutRef.current=logout;
  function rememberRestored(wallet:WalletChoice,account:WalletAccountIdentity,expected:WalletSession,version:number){
    // Restore the actual selected provider as well as the server session. A
    // stored address/brand alone must never choose a transaction provider.
    if(!live.current||version!==revision.current||selected.current!==wallet||currentSession.current!==expected||!matchesSession(wallet,account,expected)||expected.expiresAt<=Date.now()||revoking.current||activeAttempt.current!==null)return;
    if(!connected.current||connected.current.wallet.provider!==wallet.provider||!sameWalletAccount(connected.current,account)){
      const next={wallet,...account};connected.current=next;setConnection(next);
    }
    if(!lastRef.current)remember({version:1,walletId:wallet.id,account,resume:true});
  }
  function watch(wallet:WalletChoice){
    unlisten.current();selected.current=wallet;
    const changed=()=>{
      const approved=networkRequest.current;
      if(approved?.wallet===wallet){
        void wallet.current().then(account=>{
          if(approved.version!==revision.current)return;
          if(!sameWalletAddress(account,approved.address)||account.chainId!==approved.target.chainId)void logoutRef.current('Wallet account or network changed. Please verify again.');
        }).catch(()=>{if(approved.version===revision.current)void logoutRef.current('Wallet unavailable. Please verify again.');});return;
      }
      if(connected.current||currentSession.current)void logoutRef.current('Wallet account or network changed. Please verify again.');
    };
    try{const clear=wallet.subscribe(changed);unlisten.current=()=>{try{clear();}catch{/* Removed provider. */}};}catch{selected.current=null;throw new Error('Wallet events unavailable');}
    // A wallet can register after session restoration. Check that late provider
    // as well, without prompting for access or signing anything automatically.
    const expected=currentSession.current,version=revision.current;
    if(expected)void wallet.current().then(account=>{
      if(selected.current===wallet&&version===revision.current&&currentSession.current?.accountId===expected.accountId&&!matchesSession(wallet,account,expected))void logoutRef.current('Wallet changed. Please verify again.');
      else if(selected.current===wallet)rememberRestored(wallet,account,expected,version);
    }).catch(()=>{if(selected.current===wallet&&version===revision.current&&currentSession.current?.accountId===expected.accountId)void logoutRef.current('Wallet unavailable. Please verify again.');});
  }
  async function restoreConnection(){
    const last=lastRef.current,wallet=rememberedChoice(last,wallets);
    if(!last?.resume||!wallet||!ready||restoring.current||revoking.current||pendingRevoke()||currentSession.current||connected.current||activeAttempt.current!==null)return;
    restoring.current=true;const version=revision.current;
    try{
      // current() only reads already-authorized accounts. No connect, signing,
      // network switch or authenticated identity can result from this read.
      const account=await readWalletQuietly(wallet);
      if(!live.current||version!==revision.current||lastRef.current!==last||currentSession.current||connected.current||activeAttempt.current!==null||revoking.current||pendingRevoke()||!matchesRememberedAccount(last,account))return;
      watch(wallet);const next={wallet,...account};connected.current=next;setConnection(next);
    }catch{/* Missing/locked/unauthorized wallet keeps the normal manual entry. */}
    finally{restoring.current=false;}
  }
  restoreRef.current=()=>{void restoreConnection();};
  useEffect(()=>{restoreRef.current();},[wallets,ready,session,lastLogin,pendingSignout]);
  useEffect(()=>{
    live.current=true;let cancelled=false,requiresCleanStart=!authStorageAvailable();
    const refresh=async()=>{
      const version=revision.current;
      try{
        // Without writable storage we cannot remember a failed revocation after
        // reload: revoke any old cookie first instead of restoring it blindly.
        if(revoking.current||pendingRevoke()||requiresCleanStart){setRevocation(true);await enqueue(()=>hostedIdentity.logout());setRevocation(false);requiresCleanStart=false;}
        const result=await enqueue(()=>hostedIdentity.session());
        if(!cancelled&&version===revision.current){currentSession.current=result;setSession(result);setReady(true);if(!result)restoreRef.current();}
      }catch{if(!cancelled){setReady(true);setError('Wallet login is temporarily unavailable. Guest exploration still works.');}}
    };
    const announce=(event:Event)=>{
      if(!(event instanceof CustomEvent))return;
      const detail:unknown=event.detail;
      if(typeof detail!=='object'||detail===null||!('provider' in detail)||!isWalletProvider(detail.provider)||!('info' in detail))return;
      const info=detail.info;
      if(typeof info!=='object'||info===null||!('rdns' in info)||typeof info.rdns!=='string'||info.rdns.length>100||!('name' in info)||typeof info.name!=='string')return;
      const wallet=evmWallet(info.rdns,info.name.slice(0,50),detail.provider);
      // Metadata is display-only. Never render provider HTML or remote icons.
      setWallets(old=>mergeEvmChoice(old,wallet));
      try{if(!selected.current&&localStorage.getItem(PROVIDER_KEY)===wallet.id)watch(wallet);}catch{/* Optional preference. */}
    };
    addEventListener('eip6963:announceProvider',announce);dispatchEvent(new Event('eip6963:requestProvider'));
    // Wallet Standard registration handles extensions that load before or after
    // this page. Discovery never calls connect/sign or reads balances.
    const standard=getWallets();
    const registerSolana=(...providers:Wallet[])=>{
      for(const provider of providers){
        try{
          if(!isSolanaWallet(provider))continue;
          const wallet=solanaWallet(provider);
          setWallets(old=>mergeSolanaChoice(old,wallet));
          if(!selected.current&&localStorage.getItem(PROVIDER_KEY)===wallet.id)watch(wallet);
        }catch{/* Malformed or unavailable wallet is not a world failure. */}
      }
    };
    const unregisterSolana=(...providers:Wallet[])=>{
      if(selected.current&&providers.some(p=>p===selected.current?.provider)&&(connected.current||currentSession.current))void logoutRef.current('Wallet disconnected. Please verify again.');
      setWallets(old=>old.filter(w=>!providers.some(p=>p===w.provider)));
    };
    const stopRegister=standard.on('register',registerSolana),stopUnregister=standard.on('unregister',unregisterSolana);registerSolana(...standard.get());
    const discoverInjected=()=>{
      if(cancelled)return;
      for(const wallet of discoverInjectedEvm(window)){
        setWallets(old=>mergeEvmChoice(old,wallet));
        try{if(!selected.current&&localStorage.getItem(PROVIDER_KEY)===wallet.id)watch(wallet);}catch{/* Optional preference. */}
      }
      for(const wallet of discoverInjectedSolana(window)){
        setWallets(old=>mergeSolanaChoice(old,wallet));
        try{if(!selected.current&&localStorage.getItem(PROVIDER_KEY)===wallet.id)watch(wallet);}catch{/* Optional preference. */}
      }
    };
    const rescan=()=>{dispatchEvent(new Event('eip6963:requestProvider'));registerSolana(...standard.get());discoverInjected();};
    rescanRef.current=rescan;discoverInjected();
    addEventListener('ethereum#initialized',discoverInjected);addEventListener('solana#initialized',discoverInjected);
    if(typeof BroadcastChannel!=='undefined'){
      broadcast.current=new BroadcastChannel('ek-wallet-session');
      broadcast.current.onmessage=event=>{
        if(event.data!=='changed')return;
        // A different tab may choose a different wallet. Do not let this tab's
        // old provider revoke the newly verified shared browser session.
        revision.current++;activeAttempt.current=null;unlisten.current();selected.current=null;
        const last=readBrowserRememberedWallet();lastRef.current=last;setLastLogin(last);
        setSession(null);currentSession.current=null;setConnection(null);connected.current=null;setBusy(null);void refresh();
      };
    }
    const resume=()=>{if(document.visibilityState==='visible'&&!networkRequest.current){rescan();void refresh();}};
    addEventListener('online',resume);document.addEventListener('visibilitychange',resume);void refresh();
    return()=>{cancelled=true;rescanRef.current=()=>{};live.current=false;revision.current++;activeAttempt.current=null;unlisten.current();selected.current=null;broadcast.current?.close();stopRegister();stopUnregister();removeEventListener('eip6963:announceProvider',announce);removeEventListener('ethereum#initialized',discoverInjected);removeEventListener('solana#initialized',discoverInjected);removeEventListener('online',resume);document.removeEventListener('visibilitychange',resume);};
  },[]);
  useEffect(()=>{
    if(!session)return;
    const expires=setTimeout(()=>{void logoutRef.current('Your login session expired. Please verify again.',true);},Math.max(0,session.expiresAt-Date.now()));
    // Silent account/network check after restoring a session, never request access.
    const wallet=selected.current;
    const version=revision.current;
    if(wallet)void wallet.current().then(account=>{
      if(currentSession.current?.accountId!==session.accountId)return;
      if(!matchesSession(wallet,account,session))void logoutRef.current('Wallet changed. Please verify again.');
      else rememberRestored(wallet,account,session,version);
    }).catch(()=>{if(currentSession.current?.accountId===session.accountId)void logoutRef.current('Wallet unavailable. Please verify again.');});
    return()=>clearTimeout(expires);
  },[session]);
  async function connect(wallet:WalletChoice){
    if(busy||activeAttempt.current!==null||revoking.current||!ready)return;
    pauseRememberedConnection();
    const version=++revision.current;activeAttempt.current=version;setBusy('connect');setError('');setSession(null);setConnection(null);connected.current=null;currentSession.current=null;setRevocation(true);
    try{
      watch(wallet);await enqueue(()=>hostedIdentity.logout());setRevocation(false);
      if(version!==revision.current)return;
      const account=await wallet.connect();
      if(version!==revision.current)return;
      const next={wallet,...account};connected.current=next;setConnection(next);
      // Continue only this user-clicked login attempt, once. Discovery, restored
      // sessions and resume events never trigger a signature prompt.
      await verifyAttempt(next,version);
    }catch{if(version===revision.current)setError('Wallet connection was declined or unavailable. You can continue as a guest.');}
    finally{if(version===revision.current){activeAttempt.current=null;setBusy(null);}}
  }
  async function verifyAttempt(next:Connection,version:number){
    if(version!==revision.current)return;
    setBusy('sign');setError('');
    const stillCurrent=async()=>{
      const account=await next.wallet.current();
      if(version!==revision.current||!sameWalletAccount(account,next))throw new Error('Wallet changed');
    };
    try{
      await stillCurrent();
      const {wallet:signer,...account}=next;
      const challenge=await enqueue(()=>hostedIdentity.challenge(account));
      if(version!==revision.current)return;
      const signature=await signer.sign(challenge.message,next,location.origin);
      await stillCurrent();if(typeof signature!=='string')throw new Error('No signature');
      const result=await enqueue(()=>hostedIdentity.verify(signature));await stillCurrent();
      if(!sameWalletAccount(result,next))throw new Error('Unexpected verified identity');
      if(version===revision.current){
        currentSession.current=result;setSession(result);
        remember({version:1,walletId:next.wallet.id,account,resume:true});
        try{localStorage.setItem(PROVIDER_KEY,next.wallet.id);}catch{/* Optional preference. */}
        broadcast.current?.postMessage('changed');
      }
    }catch{
      if(version===revision.current){setRevocation(true);setSession(null);setError('Login was cancelled, expired or could not be verified. No transaction was sent.');
        try{await enqueue(()=>hostedIdentity.logout());setRevocation(false);}catch{setError('Verification could not finish. Retry sign-out before signing in again.');}}
    }finally{if(version===revision.current){activeAttempt.current=null;setBusy(null);}}
  }
  async function verify(){
    const next=connected.current;
    if(busy||activeAttempt.current!==null||revoking.current||!next)return;
    const version=++revision.current;activeAttempt.current=version;
    await verifyAttempt(next,version);
  }
  async function prepareNetwork(wallet:WalletChoice,target:WalletNetwork,expected:WalletAccountIdentity|undefined,check:()=>void){
    const existing=connected.current,version=revision.current;
    if(networkRequest.current||activeAttempt.current!==null||revoking.current)throw new WalletNetworkError('context');
    const tracked=existing?.wallet.provider===wallet.provider;
    const request={wallet,address:expected??existing??await wallet.current(),target,version};
    if(tracked)networkRequest.current=request;
    let adopted=false;
    const adopt=(current:WalletAccountIdentity)=>{
      if(!tracked||!live.current||version!==revision.current||revoking.current||selected.current?.provider!==wallet.provider||!sameWalletAddress(current,existing!)||current.chainId!==target.chainId)return;
      const next={wallet,...current};connected.current=next;setConnection(next);adopted=true;
      // Keep the original independently verified proof/expiry. Only the live
      // execution network changes; no new sign-in or permission is granted.
      if(currentSession.current&&sameWalletAddress(current,currentSession.current))remember({version:1,walletId:wallet.id,account:current,resume:true});
    };
    try{
      const current=await ensureWalletNetwork(wallet,target,expected,()=>{check();if(!live.current||version!==revision.current||(tracked&&selected.current?.provider!==wallet.provider))throw new WalletNetworkError('context');});
      if(tracked){
        if(!sameWalletAddress(current,existing!))throw new WalletNetworkError('changed');
        adopt(current);
      }
      return current;
    }finally{
      // Closing a composer cancels its transaction, not an already accepted
      // native network change. Settle that read-only state without resending.
      if(tracked&&!adopted&&networkRequest.current===request){try{adopt(await wallet.current());}catch{/* The ordinary wallet recovery remains available. */}}
      if(networkRequest.current===request)networkRequest.current=null;
    }
  }
  return {wallets,session,connection,busy,error,ready,connect,verify,logout,lastLogin,prepareNetwork,rescanWallets:()=>rescanRef.current(),pendingSignout:pendingSignout||pendingRevoke()};
}
export type WalletIdentityModel=ReturnType<typeof useWalletIdentity>;
