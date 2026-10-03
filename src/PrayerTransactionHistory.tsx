import type {PrayerAttempt} from './usePrayerTransactions';
import RitualFeedback from './RitualFeedback';
import {useRef} from 'react';
import type {RitualFeedbackPort} from './ritualFeedbackState';
import {prayerStatusMessages as messages} from './transactionStatusMessages';
import TransactionReceiptControls from './TransactionReceiptControls';
export default function PrayerTransactionHistory({entries,check,soundEnabled,onSpeakingChange}:{entries:PrayerAttempt[];check:(id:string)=>Promise<void>;soundEnabled:boolean;onSpeakingChange:(playing:boolean)=>void}){
  const feedback=useRef<RitualFeedbackPort>(null);
  return <section className="prayer-history" aria-label="Prayer transaction history">
    <p className="fine-print">This tab keeps transaction details only in memory. Copy the hash or keep wallet history before closing/reloading. No text, key or audio is saved to browser storage. Receipt checks use the original network, independent of your current login.</p>
    {!entries.length&&<p>No prayer transaction attempts in this tab.</p>}
    {entries.map(e=><article key={e.id} className="faith-screen-review"><p role="status">{messages[e.status]}</p>
      {e.network&&<p>{e.network} · chain {e.chainId}</p>}
      <dl>{e.payer&&<><dt>Submitting wallet</dt><dd><code>{e.payer}</code></dd></>}{e.contract&&<><dt>Prayer contract</dt><dd><code>{e.contract}</code></dd></>}{e.recordId&&<><dt>Record ID</dt><dd><code>{e.recordId}</code></dd></>}</dl>
      <TransactionReceiptControls id={e.id} hash={e.hash} checking={e.checking} check={check} kind="prayer"/>
      {e.status==='confirmed'&&<button type="button" className="text-button" onClick={()=>feedback.current?.complete({kind:'prayer',state:'confirmed',confirmationId:e.recordId})}>Hear sanctuary response</button>}
    </article>)}
    <RitualFeedback ref={feedback} soundEnabled={soundEnabled} immediateSound onSpeakingChange={onSpeakingChange}/>
  </section>;
}
