import {useCallback,useEffect,useRef,useState} from 'react';
import type {Hash} from 'viem';
import type {NativeTokenProof} from './nativeTokenTransfer';
import {admitTransaction,isUnresolvedTransaction,beginReceiptCheck,finishReceiptCheck,disposeTransactionChecks,scheduleReceiptRecheck,notifyReceiptOnce} from './transactionLedger';
export type NativeTokenAttempt={id:string;status:'preparing'|'not-submitted'|'pending'|'cancelled'|'unconfirmed'|'confirmed'|'failed'|'unknown';proof?:NativeTokenProof;hash?:Hash;checking:boolean};
export type StartNativeTokenAttempt=(work:(prepared:(p:NativeTokenProof)=>void)=>Promise<{hash:Hash;proof:NativeTokenProof}>,confirmed?:(hash:Hash)=>void,submitted?:(hash:Hash)=>void)=>Promise<void>;
export function useNativeTokenTransactions(){
  const [entries,setEntries]=useState<NativeTokenAttempt[]>([]),alive=useRef(true);
  const ledger=useRef(new Map<string,{entry:NativeTokenAttempt;controller?:AbortController;timer?:ReturnType<typeof setTimeout>;rounds:number;confirmed?:(hash:Hash)=>void;notified:boolean}>());
  const publish=useCallback(()=>{if(alive.current)setEntries([...ledger.current.values()].map(v=>({...v.entry})).reverse());},[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;disposeTransactionChecks(ledger.current.values());};},[]);
  const check=useCallback(async(id:string)=>{
    const item=ledger.current.get(id);if(!alive.current||!item?.entry.proof||!item.entry.hash||item.entry.checking)return;
    const {controller,signal}=beginReceiptCheck(item);publish();
    try{const {evmGiftRpcPort}=await import('./evmGiftPorts'),{verifyNativeTokenReceipt}=await import('./nativeTokenTransfer');signal.throwIfAborted();
      item.entry.status=(await verifyNativeTokenReceipt(evmGiftRpcPort(item.entry.proof.rpcUrl,signal),item.entry.proof,item.entry.hash,signal)).status;
    }catch{if(!controller.signal.aborted)item.entry.status='unknown';}
    finally{finishReceiptCheck(item,controller);publish();}
    notifyReceiptOnce(item,alive.current,()=>item.confirmed?.(item.entry.hash!));
    scheduleReceiptRecheck(item,alive.current,()=>void check(id));
  },[publish]);
  const start=useCallback<StartNativeTokenAttempt>(async(work,confirmed,submitted)=>{
    admitTransaction(ledger.current,'preparing',true);
    const item={entry:{id:crypto.randomUUID(),status:'preparing' as NativeTokenAttempt['status'],checking:false} as NativeTokenAttempt,rounds:0,confirmed,notified:false};
    ledger.current.set(item.entry.id,item);publish();
    const prepared=(proof:NativeTokenProof)=>{item.entry.proof=proof;publish();};
    try{const result=await work(prepared);if(!/^0x[0-9a-fA-F]{64}$/.test(result.hash))throw Error('Submission is uncertain. Check your wallet before resending.');prepared(result.proof);item.entry.hash=result.hash;item.entry.status='pending';}
    catch(e){item.entry.status=e instanceof Error&&e.message==='You cancelled the wallet confirmation.'?'cancelled':e instanceof Error&&e.message==='Submission is uncertain. Check your wallet before resending.'?'unconfirmed':'not-submitted';}
    publish();if(item.entry.hash&&alive.current){try{submitted?.(item.entry.hash);}catch{/* UI callbacks cannot reclassify a broadcast transaction. */}void check(item.entry.id);}
  },[publish,check]);
  return {entries,start,check,pending:entries.some(isUnresolvedTransaction)};
}
