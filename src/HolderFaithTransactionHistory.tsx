import {useRef} from 'react';
import RitualFeedback from './RitualFeedback';
import type {RitualFeedbackPort} from './ritualFeedbackState';
import type {HolderFaithAttempt} from './useHolderFaithTransactions';
import {holderFaithStatusMessages as messages} from './transactionStatusMessages';
import TransactionReceiptControls from './TransactionReceiptControls';
export default function HolderFaithTransactionHistory({entries,check,soundEnabled,onSpeakingChange}:{entries:HolderFaithAttempt[];check:(id:string)=>Promise<void>;soundEnabled:boolean;onSpeakingChange:(playing:boolean)=>void}){
  const feedback=useRef<RitualFeedbackPort>(null);
  return <section className="prayer-history" aria-label="Faith transaction history">
    <p className="fine-print">Confession and praise transaction details are kept only in this tab’s memory. Copy the hash or keep wallet history before closing/reloading. No faith text, key or audio is saved to browser storage. Receipt checks use the original network, independent of current login or holdings.</p>
    {!entries.length&&<p>No confession or praise transaction attempts in this tab.</p>}
    {entries.map(e=><article key={e.id} className="faith-screen-review"><p role="status">{messages[e.status]}</p>
      {e.kind&&<h3>{e.kind==='confession'?'Confession':'Praise'}</h3>}{e.network&&<p>{e.network} · chain {e.chainId}</p>}
      <dl>{e.payer&&<><dt>Submitting wallet</dt><dd><code>{e.payer}</code></dd></>}{e.contract&&<><dt>Holder record contract</dt><dd><code>{e.contract}</code></dd></>}{e.recordId&&<><dt>Record ID</dt><dd><code>{e.recordId}</code></dd></>}</dl>
      <TransactionReceiptControls id={e.id} hash={e.hash} checking={e.checking} check={check} kind="faith"/>
      {e.status==='confirmed'&&e.kind&&<button type="button" className="text-button" onClick={()=>feedback.current?.complete({kind:e.kind!,state:'confirmed',confirmationId:e.recordId})}>Hear sanctuary response</button>}
    </article>)}
    <RitualFeedback ref={feedback} soundEnabled={soundEnabled} immediateSound onSpeakingChange={onSpeakingChange}/>
  </section>;
}
