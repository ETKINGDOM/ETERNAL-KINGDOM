// Shared tab-memory bookkeeping only. No signing, network writes, persistence,
// proof validation or private faith text belongs in this module.
export const TAB_TRANSACTION_LIMIT=32;
const RECEIPT_TIMEOUT=20_000;
type Entry={id:string;status:string;checking:boolean;hash?:string};
export type TransactionWaitPhase='wallet'|'blockchain'|'uncertain';
export function isUnresolvedTransaction(entry:Pick<Entry,'status'>){return ['preparing','awaiting-wallet','pending','unknown','unconfirmed'].includes(entry.status);}
export function transactionWaitPhase(entries:readonly Pick<Entry,'status'>[]):TransactionWaitPhase|null{
  if(entries.some(e=>['preparing','awaiting-wallet'].includes(e.status)))return 'wallet';
  if(entries.some(e=>e.status==='pending'))return 'blockchain';
  return entries.some(e=>['unknown','unconfirmed'].includes(e.status))?'uncertain':null;
}
export type TransactionCheck={entry:Entry;controller?:AbortController;timer?:ReturnType<typeof setTimeout>;rounds?:number};
export class TransactionAdmissionError extends Error {
  constructor(readonly reason:'busy'|'unresolved'|'history-full'){
    super(reason==='busy'
      ?'Another wallet confirmation is already open. Finish or cancel it in your wallet before starting a new attempt. Nothing is retried automatically.'
      :reason==='unresolved'?'The previous blockchain result is still pending or unverified. Check transaction history before submitting again. No new transaction was requested; nothing is retried automatically.'
      :`This tab’s transaction history is full (${TAB_TRANSACTION_LIMIT} attempts). Save your transaction hashes and check any pending or uncertain result in your wallet before refreshing. No transaction was requested for this attempt.`);
  }
}
export function transactionAdmissionMessage(error:unknown){
  return error instanceof TransactionAdmissionError?error.message:null;
}
export function admitTransaction<T extends TransactionCheck>(ledger:Map<string,T>,waitingStatus:string,protectUnresolved=false){
  if([...ledger.values()].some(item=>item.entry.status===waitingStatus))throw new TransactionAdmissionError('busy');
  if(protectUnresolved&&[...ledger.values()].some(item=>isUnresolvedTransaction(item.entry)))throw new TransactionAdmissionError('unresolved');
  // Only evict a provably non-submitted, hash-less attempt. Never drop a
  // pending/unknown/unconfirmed result or any entry with a transaction hash.
  while(ledger.size>=TAB_TRANSACTION_LIMIT){
    const obsolete=[...ledger.values()].find(item=>!item.entry.hash&&!item.entry.checking&&['cancelled','not-submitted','insufficient'].includes(item.entry.status));
    if(!obsolete)throw new TransactionAdmissionError('history-full');
    obsolete.controller?.abort();clearTimeout(obsolete.timer);ledger.delete(obsolete.entry.id);
  }
}
export function beginReceiptCheck(item:TransactionCheck){
  clearTimeout(item.timer);item.timer=undefined;
  const controller=new AbortController();item.controller=controller;item.entry.checking=true;
  return {controller,signal:AbortSignal.any([controller.signal,AbortSignal.timeout(RECEIPT_TIMEOUT)])};
}
export function finishReceiptCheck(item:TransactionCheck,controller:AbortController){
  item.entry.checking=false;item.controller=undefined;controller.abort();
}
export function disposeTransactionChecks(items:Iterable<TransactionCheck>){
  for(const item of items){item.controller?.abort();clearTimeout(item.timer);}
}
export function scheduleReceiptRecheck(item:TransactionCheck,alive:boolean,check:()=>void){
  if(item.entry.status==='pending'&&(item.rounds??0)<2&&alive){
    item.rounds=(item.rounds??0)+1;item.timer=setTimeout(check,item.rounds*3000);
  }
}
export function notifyReceiptOnce(item:TransactionCheck&{notified:boolean},alive:boolean,notify:()=>void){
  if(item.entry.status==='confirmed'&&!item.notified&&alive){
    item.notified=true;try{notify();}catch{/* Presentation cannot change evidence. */}
  }
}
