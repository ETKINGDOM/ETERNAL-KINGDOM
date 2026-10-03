import { useCallback,useEffect,useRef,useState } from 'react';
import type { Hash } from 'viem';
import type { GiftReceiptStatus } from './giftReceipt';
import {admitTransaction,beginReceiptCheck,finishReceiptCheck,disposeTransactionChecks} from './transactionLedger';

export type GiftAttempt={id:string;network:string;chainId:number;payer:string;recipient:string;token:string;amount:string;symbol:string;
  status:'awaiting-wallet'|'unconfirmed'|'cancelled'|GiftReceiptStatus;hash?:Hash;checking:boolean};
export type GiftAttemptInput=Pick<GiftAttempt,'network'|'chainId'|'payer'|'recipient'|'token'|'amount'|'symbol'>;
export type StartGiftAttempt=(input:GiftAttemptInput,submit:()=>Promise<{transactionHash:string}>,check:(hash:Hash,signal:AbortSignal)=>Promise<{status:GiftReceiptStatus}>)=>Promise<void>;

// Tab-memory only. No names, blessings, private faith text, browser storage,
// telemetry, server posts, polling or automatic transaction retries.
export function useGiftTransactions(){
  const [entries,setEntries]=useState<GiftAttempt[]>([]);
  const ledger=useRef(new Map<string,{entry:GiftAttempt;check:(hash:Hash,signal:AbortSignal)=>Promise<{status:GiftReceiptStatus}>;controller?:AbortController}>());
  const alive=useRef(true);
  const publish=useCallback(()=>{if(alive.current)setEntries([...ledger.current.values()].map(v=>({...v.entry})).reverse());},[]);
  useEffect(()=>{alive.current=true;return()=>{alive.current=false;disposeTransactionChecks(ledger.current.values());};},[]);
  const start=useCallback<StartGiftAttempt>(async(input,submit,check)=>{
    admitTransaction(ledger.current,'awaiting-wallet');
    const entry:GiftAttempt={...input,id:crypto.randomUUID(),status:'awaiting-wallet',checking:false};
    const item={entry,check};ledger.current.set(entry.id,item);publish();
    try {
      const result=await submit();
      if(!/^0x[0-9a-fA-F]{64}$/.test(result.transactionHash))throw Error('Uncertain submission');
      entry.hash=result.transactionHash as Hash;entry.status='pending';
    } catch(error){
      // Do not display raw wallet/RPC responses; a failure is not proof of no payment.
      entry.status=error instanceof Error&&error.message.startsWith('You cancelled the wallet confirmation.')?'cancelled':'unconfirmed';
    }
    publish();
  },[publish]);
  const check=useCallback(async(id:string)=>{
    const item=ledger.current.get(id);if(!item?.entry.hash||item.entry.checking||!alive.current)return;
    const {controller,signal}=beginReceiptCheck(item);publish();
    try {item.entry.status=(await item.check(item.entry.hash,signal)).status;}
    catch {if(!controller.signal.aborted)item.entry.status='unknown';}
    finally {finishReceiptCheck(item,controller);publish();}
  },[publish]);
  return {entries,start,check,pending:entries.some(e=>e.status==='awaiting-wallet')};
}
