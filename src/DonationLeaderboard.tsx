import {useEffect,useRef,useState} from 'react';
import {appendDonationPage,createDonationRankingReader,donationRanks,type DonationRanking,type DonationRankingReader} from './donationRankingReader';
import {projectChainSettings} from './projectChainSettings';
import {GOD_TOKEN_NAME} from '../shared/godTokenPresentation';
import './donations.css';
import InfoHint from './InfoHint';
import EvmDonationList from './EvmDonationList';

const projectReader=createDonationRankingReader(projectChainSettings);
const short=(address:string)=>`${address.slice(0,6)}…${address.slice(-4)}`;
export default function DonationLeaderboard({reader=projectReader}:{reader?:DonationRankingReader}){
  const [asset,setAsset]=useState('god-token');
  const [ranking,setRanking]=useState<DonationRanking|null>(null);
  const [status,setStatus]=useState<'idle'|'loading'|'unconfigured'|'unavailable'|'available'>('idle');
  const current=useRef<AbortController|null>(null),lifetime=useRef(0),busy=useRef(false);
  async function read(previous:DonationRanking|null){
    if(busy.current)return;busy.current=true;
    const controller=new AbortController(),epoch=++lifetime.current;current.current?.abort();current.current=controller;
    setStatus('loading');if(!previous)setRanking(null);
    try{
      const result=await reader.read(controller.signal,previous?.next??undefined);
      if(controller.signal.aborted||lifetime.current!==epoch)return;
      if(result.status!=='available'){setRanking(null);setStatus(result.status);return;}
      const next=appendDonationPage(previous,result);setRanking(next);setStatus('available');
    }catch{if(!controller.signal.aborted&&lifetime.current===epoch){setRanking(null);setStatus('unavailable');}}
    finally{if(lifetime.current===epoch){busy.current=false;}}
  }
  useEffect(()=>{
    setRanking(null);setStatus('idle');
    if(asset==='god-token')void read(null);
    return()=>{lifetime.current++;current.current?.abort();busy.current=false;};
  },[reader,asset]);
  function select(next:string){
    if(next===asset)return;
    lifetime.current++;current.current?.abort();busy.current=false;setRanking(null);setStatus('idle');setAsset(next);
  }
  const rows=ranking?donationRanks(ranking.records,ranking.snapshot.token):[];
  const partial=Boolean(ranking&&(ranking.next||ranking.unverified));
  return <section className="donation-ranking" aria-label="Donation leaderboard">
    <h3>Donations</h3>
    <label className="field-label">Donation asset<select aria-label="Donation ranking asset" value={asset} onChange={e=>select(e.target.value)}>
      <option value="god-token">{GOD_TOKEN_NAME}</option><option value="evm">EVM</option><option value="sol">SOL</option><option value="btc">BTC</option>
    </select></label>
    {asset==='evm'?<EvmDonationList/>:asset!=='god-token'?<p role="status">{asset.toUpperCase()} donation ranking is not connected.</p>:<>
      <button type="button" className="secondary-button full" onClick={()=>void read(null)} disabled={status==='loading'}>Refresh donation ranking</button>
      {status==='loading'&&<p role="status">Checking donations…</p>}
      {status==='unconfigured'&&<p role="status">Donation ranking is not connected.</p>}
      {status==='unavailable'&&<p role="status">Donation totals could not be verified. Please refresh.</p>}
      {ranking&&<>
        <p className="donation-range">{GOD_TOKEN_NAME} · {ranking.snapshot.token.networkName}</p>
        {partial&&<p role="status" className="donation-caveat">Partial totals — scan not finished or some events could not be verified.</p>}
        <InfoHint label="Donation snapshot details"><p>From block {ranking.snapshot.start} through {ranking.snapshot.through} · {ranking.pages} {ranking.pages===1?'page':'pages'} checked.</p>
          <label className="field-label">Public donation recipient<input readOnly value={ranking.snapshot.recipient} onFocus={e=>e.currentTarget.select()}/></label><p>Not a lifetime total or current treasury balance. {ranking.unverified} events could not be counted. Positions can change as the scan continues.</p></InfoHint>
        {!!rows.length&&<ol className="donation-ranks" aria-label="Ranked donors">{rows.slice(0,50).map(r=><li key={r.donor.toLowerCase()} className="donation-rank-row">
          <span className="donation-place">#{r.rank}</span><div><strong title={r.donor}>{short(r.donor)}</strong><small>{r.count} {r.count===1?'donation':'donations'}</small></div>
          <div className="donation-total"><strong>{r.amount}</strong><small>{GOD_TOKEN_NAME}</small></div>
          <details><summary>Wallet &amp; evidence</summary><label className="field-label">Donor wallet · select and copy<input readOnly value={r.donor} onFocus={e=>e.currentTarget.select()}/></label>
            <ul>{ranking.records.filter(record=>record.donor.toLowerCase()===r.donor.toLowerCase()).slice(-20).reverse().map(record=><li key={record.id}><span>Block {record.block}</span><code>{record.hash}</code></li>)}</ul>
            <p className="fine-print">Latest 20 verified hashes for this donor in the scanned period. A wallet address is not a verified name or religious identity.</p>
          </details>
        </li>)}</ol>}
        {rows.length>50&&<p className="fine-print">Showing the leading 50 of {rows.length} contributing addresses in this scanned period.</p>}
        {!rows.length&&<p role="status">No verified direct transfers counted{ranking.next?' yet. Continue the scan to check the remaining period.':' in this period.'}</p>}
        {ranking.next&&<button type="button" className="primary full" disabled={status==='loading'} onClick={()=>void read(ranking)}>Continue ranking scan</button>}
      </>}
    </>}
    <InfoHint label="Donation ranking details"><p>Thank you for helping build a place of peace. Giving does not buy forgiveness, access or a spiritual rank.</p><p>Set the God token, public recipient and ranking start block to connect the God ranking. No amounts or ranks are invented.</p><p>Amounts are summed by public sending wallet, using integer token units. Equal totals share a position. Only successful direct standard ERC-20 transfers to the configured public address count; gifts to people, self-transfers, mint/burn, zero transfers and ambiguous or unverified events do not.</p>
      <p>Each read checks at most 12 events in a 1,000-block window. Continue manually to finish the snapshot, including busy blocks; nothing is silently skipped. RPC/response and in-memory limits can require a future indexer. Refresh resets the scan. Nothing is stored in browser storage or sent to public chat.</p>
      <p>This reads a trusted RPC at three-block depth, not independent consensus or L1 settlement. Sender addresses are public. Fee/rebase/proxy/custom tokens need separate review; event evidence does not guarantee token value or current treasury funds. Withdrawals do not erase historical contribution totals. EVM native coins use their own index interface; SOL and BTC adapters remain reserved.</p></InfoHint>
  </section>;
}
