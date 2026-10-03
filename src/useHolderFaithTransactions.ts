import {useCallback,useEffect,useRef,useState} from 'react';
import type {Hash} from 'viem';
import type {HolderFaithKind} from '../shared/holderFaithRecords';
import type {HolderFaithProof,HolderFaithReceipt} from './holderFaithChain';
import {admitTransaction,isUnresolvedTransaction,beginReceiptCheck,finishReceiptCheck,disposeTransactionChecks,scheduleReceiptRecheck,notifyReceiptOnce} from './transactionLedger';
import {notifyConfiguredFaithTransaction} from './databaseFaithReader';
import {projectChainSettings} from './projectChainSettings';

export type HolderFaithAttempt={id:string;status:'preparing'|'not-submitted'|'cancelled'|'unconfirmed'|'insufficient'|HolderFaithReceipt['status'];kind?:HolderFaithKind;hash?:Hash;
  network?:string;chainId?:number;contract?:string;payer?:string;recordId?:string;checking:boolean};
export type HolderFaithOutcome='pending'|'cancelled'|'unconfirmed'|'insufficient'|'not-submitted';
export type StartHolderFaithAttempt=(work:(prepared:(proof:HolderFaithProof)=>void)=>Promise<{hash:Hash;proof:HolderFaithProof}>,confirmed?:(recordId:string)=>void)=>Promise<HolderFaithOutcome>;
export function useHolderFaithTransactions(){
  const [entries,setEntries]=useState<HolderFaithAttempt[]>([]);
  const ledger=useRef(new Map<string,{entry:HolderFaithAttempt;proof?:HolderFaithProof;controller?:AbortController;timer?:ReturnType<typeof setTimeout>;rounds:number;confirmed?:(id:string)=>void;notified:boolean}>());
  const alive=useRef(true);
  const publish=useCallback(()=>{if(alive.current)setEntries([...ledger.current.values()].map(item=>({...item.entry})).reverse());},[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;disposeTransactionChecks(ledger.current.values());};},[]);
  const check=useCallback(async(id:string)=>{
    const item=ledger.current.get(id);if(!item?.proof||!item.entry.hash||item.entry.checking||!alive.current)return;
    const {controller,signal}=beginReceiptCheck(item);publish();
    try{const {holderFaithRpc,verifyHolderFaithReceipt}=await import('./holderFaithChain');signal.throwIfAborted();item.entry.status=(await verifyHolderFaithReceipt(holderFaithRpc(item.proof.rpcUrl,signal),item.proof,item.entry.hash,signal)).status;}
    catch{if(!controller.signal.aborted)item.entry.status='unknown';}
    finally{finishReceiptCheck(item,controller);publish();}
    notifyReceiptOnce(item,alive.current,()=>{notifyConfiguredFaithTransaction(projectChainSettings,item.proof!,item.entry.hash!);item.confirmed?.(item.proof!.recordId);});
    scheduleReceiptRecheck(item,alive.current,()=>void check(id));
  },[publish]);
  const start=useCallback<StartHolderFaithAttempt>(async(work,confirmed)=>{
    admitTransaction(ledger.current,'preparing',true);
    const item:{entry:HolderFaithAttempt;proof?:HolderFaithProof;rounds:number;confirmed?:(id:string)=>void;notified:boolean}={entry:{id:crypto.randomUUID(),status:'preparing',checking:false},rounds:0,confirmed,notified:false};
    ledger.current.set(item.entry.id,item);publish();
    const prepared=(p:HolderFaithProof)=>{item.proof=p;Object.assign(item.entry,{kind:p.kind,network:p.network,chainId:p.chainId,contract:p.contract,payer:p.payer,recordId:p.recordId});publish();};
    let outcome:HolderFaithOutcome;
    try{const result=await work(prepared);if(!/^0x[0-9a-fA-F]{64}$/.test(result.hash))throw Error('Submission is uncertain. Check your wallet before resending.');prepared(result.proof);item.entry.hash=result.hash;notifyConfiguredFaithTransaction(projectChainSettings,result.proof,result.hash);outcome='pending';}
    catch(e){outcome=e instanceof Error&&e.message==='You cancelled the wallet confirmation.'?'cancelled':e instanceof Error&&e.message==='At least 1 whole God token is required for confession and praise.'?'insufficient':e instanceof Error&&e.message==='Submission is uncertain. Check your wallet before resending.'?'unconfirmed':'not-submitted';}
    item.entry.status=outcome;publish();if(item.entry.hash&&alive.current)void check(item.entry.id);return outcome;
  },[publish,check]);
  return {entries,start,check,pending:entries.some(isUnresolvedTransaction)};
}
