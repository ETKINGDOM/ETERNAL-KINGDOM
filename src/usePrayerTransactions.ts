import {useCallback,useEffect,useRef,useState} from 'react';
import type {Hash} from 'viem';
import type {PrayerProof,PrayerReceipt} from './prayerChain';
import {admitTransaction,isUnresolvedTransaction,beginReceiptCheck,finishReceiptCheck,disposeTransactionChecks,scheduleReceiptRecheck,notifyReceiptOnce} from './transactionLedger';
import {notifyConfiguredFaithTransaction} from './databaseFaithReader';
import {projectChainSettings} from './projectChainSettings';

export type PrayerAttempt={id:string;status:'preparing'|'not-submitted'|'pending'|'cancelled'|'unconfirmed'|PrayerReceipt['status'];hash?:Hash;
  network?:string;chainId?:number;contract?:string;payer?:string;recordId?:string;checking:boolean};
export type PrayerOutcome='pending'|'cancelled'|'unconfirmed'|'not-submitted';
export type StartPrayerAttempt=(work:(prepared:(proof:PrayerProof)=>void)=>Promise<{hash:Hash;proof:PrayerProof}>,confirmed?:(recordId:string)=>void)=>Promise<PrayerOutcome>;
export function usePrayerTransactions(){
  const [entries,setEntries]=useState<PrayerAttempt[]>([]);
  const ledger=useRef(new Map<string,{entry:PrayerAttempt;proof?:PrayerProof;controller?:AbortController;timer?:ReturnType<typeof setTimeout>;rounds:number;confirmed?: (id:string)=>void;notified:boolean}>());
  const alive=useRef(true);
  const publish=useCallback(()=>{if(alive.current)setEntries([...ledger.current.values()].map(v=>({...v.entry})).reverse());},[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;disposeTransactionChecks(ledger.current.values());};},[]);
  const check=useCallback(async(id:string)=>{
    const item=ledger.current.get(id);if(!item?.proof||!item.entry.hash||item.entry.checking||!alive.current)return;
    const {controller,signal}=beginReceiptCheck(item);publish();
    try{const {prayerRpc,verifyPrayerReceipt}=await import('./prayerChain');signal.throwIfAborted();item.entry.status=(await verifyPrayerReceipt(prayerRpc(item.proof.rpcUrl,signal),item.proof,item.entry.hash,signal)).status;}
    catch{if(!controller.signal.aborted)item.entry.status='unknown';}
    finally{finishReceiptCheck(item,controller);publish();}
    notifyReceiptOnce(item,alive.current,()=>{notifyConfiguredFaithTransaction(projectChainSettings,item.proof!,item.entry.hash!);item.confirmed?.(item.proof!.recordId);});
    // Bounded receipt reads, never retry a transaction or poll indefinitely.
    scheduleReceiptRecheck(item,alive.current,()=>void check(id));
  },[publish]);
  const start=useCallback<StartPrayerAttempt>(async(work,confirmed)=>{
    admitTransaction(ledger.current,'preparing',true);
    const item:{entry:PrayerAttempt;proof?:PrayerProof;rounds:number;confirmed?: (id:string)=>void;notified:boolean}={entry:{id:crypto.randomUUID(),status:'preparing',checking:false},rounds:0,confirmed,notified:false};
    ledger.current.set(item.entry.id,item);publish();
    const prepared=(p:PrayerProof)=>{item.proof=p;Object.assign(item.entry,{network:p.network,chainId:p.chainId,contract:p.contract,payer:p.payer,recordId:p.recordId});publish();};
    let outcome:PrayerOutcome;
    try{const result=await work(prepared);if(!/^0x[0-9a-fA-F]{64}$/.test(result.hash))throw Error('Submission is uncertain. Check your wallet before resending.');prepared(result.proof);item.entry.hash=result.hash;notifyConfiguredFaithTransaction(projectChainSettings,result.proof,result.hash);outcome='pending';}
    catch(e){outcome=e instanceof Error&&e.message==='You cancelled the wallet confirmation.'?'cancelled':e instanceof Error&&e.message==='Submission is uncertain. Check your wallet before resending.'?'unconfirmed':'not-submitted';}
    item.entry.status=outcome;publish();if(item.entry.hash&&alive.current)void check(item.entry.id);return outcome;
  },[publish,check]);
  return {entries,start,check,pending:entries.some(isUnresolvedTransaction)};
}
