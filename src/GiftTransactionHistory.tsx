import type { GiftAttempt } from './useGiftTransactions';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
const status={
  'awaiting-wallet':'Confirmation in progress. Check your wallet; closing the window cannot recall a broadcast.',
  unconfirmed:'Submission not confirmed. Check your wallet history before trying again. No automatic retry.',
  cancelled:'Wallet confirmation cancelled. A new attempt requires a new review.',
  pending:'Submitted — not yet verified at three-block depth.',
  confirmed:'Transfer evidence verified at three-block depth. This is provisional, not permanent finality.',
  failed:'Verified reverted transaction. Gas may still have been spent.',
  unknown:'Receipt could not be verified. This does not prove success or failure. Check your wallet.',
};
export default function GiftTransactionHistory({entries,check}:{entries:GiftAttempt[];check:(id:string)=>Promise<void>}){
  return <section className="gift-preview gift-history" aria-label="Gift transaction history">
    <p className="gift-note">Only this open tab keeps these attempts. Closing the gift window keeps them; reloading or closing this page removes them. Copy submitted hashes and keep your wallet history. Names and blessings are never recorded here.</p>
    {!entries.length&&<p>No transfer attempts in this tab.</p>}
    {entries.map(entry=><article className="gift-local-review" key={entry.id}>
      <h3>{entry.amount} {GOD_TOKEN_NAME} · testnet</h3><p>{entry.network} · chain {entry.chainId}</p>
      <dl className="gift-transaction-fields"><dt>From</dt><dd><code>{entry.payer}</code></dd><dt>To</dt><dd><code>{entry.recipient}</code></dd></dl>
      <p role="status">{status[entry.status]}</p>
      {entry.hash&&<><label htmlFor={`gift-hash-${entry.id}`}>Transaction hash · select and copy</label><textarea id={`gift-hash-${entry.id}`} readOnly value={entry.hash} rows={2} onFocus={e=>e.currentTarget.select()}/>
        <button className="secondary-button full" disabled={entry.checking} onClick={()=>void check(entry.id)}>{entry.checking?'Checking receipt…':'Check receipt now'}</button>
        <p className="gift-note">On demand only. The original project-configured RPC receives this hash and transaction details. No wallet signature or resend is requested. A later check can reveal a reorg.</p></>}
    </article>)}
  </section>;
}
