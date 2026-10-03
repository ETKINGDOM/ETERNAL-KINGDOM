import {useEffect,useRef,useState} from 'react';
import {EVM_DONATION_NETWORKS,type EvmDonationChainId} from '../shared/evmDonations';
import {projectChainSettings} from './projectChainSettings';
import {createEvmDonationReader,evmDonationRanks,type EvmDonationReader,type EvmDonationPage} from './evmDonationReader';
import InfoHint from './InfoHint';
const recipient=projectChainSettings.status==='valid'?projectChainSettings.config.godTokenDonation.recipient:null;
const projectReader=createEvmDonationReader({recipient});
export default function EvmDonationList({reader=projectReader}:{reader?:EvmDonationReader}){
  const [chainId,setChainId]=useState<EvmDonationChainId>(1),[page,setPage]=useState<EvmDonationPage|null>(null),[status,setStatus]=useState('loading');
  const active=useRef<AbortController|null>(null);
  const network=EVM_DONATION_NETWORKS.find(n=>n.chainId===chainId)!;
  function select(next:EvmDonationChainId){if(next===chainId)return;active.current?.abort();setPage(null);setStatus('loading');setChainId(next);}
  async function read(previous:EvmDonationPage|null){
    active.current?.abort();const controller=new AbortController();active.current=controller;setStatus('loading');
    if(!previous)setPage(null);
    try{
      const result=await reader.read(chainId,controller.signal,previous?.next??undefined);
      if(controller.signal.aborted)return;
      if(result.status!=='available'){setPage(null);setStatus(result.status);return;}
      if(result.chainId!==chainId||previous&&(previous.start!==result.start||previous.through!==result.through||previous.anchor.toLowerCase()!==result.anchor.toLowerCase())||result.next===previous?.next&&result.next!==null)throw Error('Snapshot changed');
      const records=[...previous?.records??[],...result.records];
      if(records.length>1000)throw Error('Display limit');
      const unverified=(previous?.unverified??0)+result.unverified;
      setPage({...result,records,unverified,partial:result.partial||unverified>0});setStatus('available');
    }catch{if(!controller.signal.aborted){setPage(null);setStatus('unavailable');}}
  }
  useEffect(()=>{void read(null);return()=>active.current?.abort();},[chainId,reader]);
  const rows=page?evmDonationRanks(page.records):[];
  return <section className="evm-donation-list" aria-label="EVM donations">
    <div className="evm-donation-networks" role="group" aria-label="EVM donation networks">{EVM_DONATION_NETWORKS.map(n=><button type="button" key={n.chainId} aria-pressed={n.chainId===chainId} onClick={()=>select(n.chainId)}>{n.name}<small>{n.symbol}</small></button>)}</div>
    <InfoHint label="EVM donation details"><p>Ethereum, Base and Arbitrum donations use ETH; BNB Chain uses BNB. Each network has a separate record source and totals. God is listed separately. No ETH and BNB amounts are added together.</p><p>Only verified successful direct native-currency transfers count. Token transfers, internal transfers, self-transfers and unverified transactions do not. An index discovers transactions; the chain verifies them. This is block inclusion, not a guarantee of L1 settlement. A record source must be configured before records can be displayed.</p></InfoHint>
    {status==='loading'&&<p role="status">Checking {network.name} donations…</p>}
    {status==='unconfigured'&&<p role="status">{network.name} · {network.symbol} record source is not connected yet.</p>}
    {status==='unavailable'&&<p role="status">Records could not be verified.</p>}
    {recipient&&<a className="text-button" href={`${network.explorer}/address/${recipient}`} target="_blank" rel="noopener noreferrer">View {network.symbol} on {network.name} explorer ↗</a>}
    {page&&<><p role="status">{page.partial?'Partial totals':'Verified transfers in this period'} · {network.name}</p>
      <ol className="donation-ranks" aria-label={`${network.name} donors`}>{rows.slice(0,50).map(r=><li className="donation-rank-row" key={r.donor.toLowerCase()}><span className="donation-place">#{r.rank}</span><div><strong>{r.donor.slice(0,6)}…{r.donor.slice(-4)}</strong><small>{r.count} donations</small></div><div className="donation-total"><strong>{r.amount}</strong><small>{network.symbol}</small></div></li>)}</ol>
      {!rows.length&&<p role="status">No verified transfers in this page.</p>}{page.next&&<button type="button" className="secondary-button full" disabled={status==='loading'} onClick={()=>void read(page)}>More donations</button>}</>}
  </section>;
}
