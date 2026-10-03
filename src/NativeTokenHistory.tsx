import {useRef} from 'react';
import {formatUnits} from 'viem';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import type {NativeTokenAttempt} from './useNativeTokenTransactions';
import RitualFeedback from './RitualFeedback';
import type {RitualFeedbackPort} from './ritualFeedbackState';
import {nativeTokenStatusMessages as labels} from './transactionStatusMessages';
import TransactionReceiptControls from './TransactionReceiptControls';
export default function NativeTokenHistory({entries,check,soundEnabled,onSpeakingChange}:{entries:NativeTokenAttempt[];check:(id:string)=>Promise<void>;soundEnabled:boolean;onSpeakingChange:(v:boolean)=>void}){
  const feedback=useRef<RitualFeedbackPort>(null);
  return <section className="token-history" aria-label="Token transaction history"><p className="fine-print">Memory only, this tab. Keep your wallet history or copy the hash before reloading. No blessings, faith text or recipient nicknames are stored. Receipt checks use the original network. Unknown results must be checked before another attempt.</p>
    {!entries.length&&<p>No token transaction attempts in this tab.</p>}
    {entries.map(e=><article key={e.id} className="faith-screen-review"><p role="status">{labels[e.status]}</p>{e.proof&&<><h3>{e.proof.kind==='donation'?'Project donation':'Person gift'}</h3><p>{formatUnits(e.proof.transfer.amount,e.proof.transfer.token.decimals)} {GOD_TOKEN_NAME} · {e.proof.network}</p><dl><dt>From</dt><dd><code>{e.proof.payer}</code></dd><dt>To</dt><dd><code>{e.proof.transfer.recipient}</code></dd><dt>Token contract</dt><dd><code>{e.proof.transfer.to}</code></dd></dl></>}
      <TransactionReceiptControls id={e.id} hash={e.hash} checking={e.checking} check={check} kind="token"/>
      {e.status==='confirmed'&&e.proof?.kind==='donation'&&<button type="button" className="text-button" onClick={()=>feedback.current?.complete({kind:'donation',state:'confirmed',confirmationId:e.hash})}>Hear donation response</button>}
    </article>)}<RitualFeedback ref={feedback} soundEnabled={soundEnabled} immediateSound onSpeakingChange={onSpeakingChange}/>
  </section>;
}
