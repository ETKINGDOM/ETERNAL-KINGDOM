import {useEffect,useRef,useState} from 'react';
import type {Address} from 'viem';
import {evmReceivingAddressSchema} from '../shared/profile';
import type {RecordKind} from '../shared/adapters';
import {RefreshCw,MoreHorizontal} from 'lucide-react';
import {createFaithRecordReader,type FaithRecordReader,type FaithFeedResult} from './faithRecordFeed';
import {recentSharedRecords,rememberSharedRecords,forgetSharedRecords} from './faithRecordDisplayCache';
import {projectChainSettings} from './projectChainSettings';
import InfoHint from './InfoHint';
import './faith.css';
import './sacredRecords.css';

const projectReader=createFaithRecordReader(projectChainSettings);
const labels={prayer:'Prayer',confession:'Confession',praise:'Praise'};
export default function SacredRecordList({active,personal=false,account,reader=projectReader}:{active:boolean;personal?:boolean;account?:string;reader?:FaithRecordReader}){
  const [address,setAddress]=useState(account??'');
  const [author,setAuthor]=useState(account);
  const [initial]=useState(()=>!personal&&active?recentSharedRecords(reader):null);
  const [result,setResult]=useState<FaithFeedResult|null>(initial?.page??null);
  const [checkedAt,setCheckedAt]=useState<number|null>(initial?.checkedAt??null);
  const [loading,setLoading]=useState(active&&(!personal||!!account));
  const [filter,setFilter]=useState<RecordKind|'all'>('all');
  const [hidden,setHidden]=useState<Set<string>>(()=>new Set());
  const [request,setRequest]=useState<{before?:string;revision:number}>({revision:0});
  const generation=useRef(0);
  const parsed=evmReceivingAddressSchema.safeParse(address);
  useEffect(()=>{
    const own=++generation.current,controller=new AbortController();
    setLoading(false);
    if(!active||(personal&&!author))return ()=>{controller.abort();};
    const cached=!personal&&!request.before?recentSharedRecords(reader):null;
    setResult(old=>personal||request.before?null:cached?.page??(old?.status==='available'?old:null));
    if(cached)setCheckedAt(cached.checkedAt);
    setLoading(true);
    void reader.read({signal:controller.signal,author:personal?author as Address:undefined,before:request.before}).then(next=>{
      if(controller.signal.aborted||generation.current!==own)return;
      setResult(next);
      if(next.status==='available'){
        setCheckedAt(Date.now());
        if(!personal&&!request.before)rememberSharedRecords(reader,next);
      }else if(!personal)forgetSharedRecords(reader);
    }).catch(()=>{
      if(!controller.signal.aborted&&generation.current===own){setResult({status:'unavailable'});if(!personal)forgetSharedRecords(reader);}
    }).finally(()=>{if(!controller.signal.aborted&&generation.current===own)setLoading(false);});
    return ()=>{controller.abort();};
  },[active,personal,author,reader,request]);
  const refresh=()=>setRequest(old=>({revision:old.revision+1}));
  const page=result?.status==='available'?result:null;
  const records=page?.records.filter(r=>!hidden.has(r.id)&&(filter==='all'||r.kind===filter))??[];
  return <section className="sacred-records" aria-label={personal?'Personal chain records':'Shared chain records'}>
    {personal&&<form className="sacred-account" onSubmit={e=>{e.preventDefault();if(!parsed.success||loading)return;setAuthor(parsed.data);refresh();}}>
      <label className="field-label">Submitting EVM address · read only<input value={address} onChange={e=>setAddress(e.target.value)} autoComplete="off" spellCheck={false} maxLength={42} placeholder="0x…"/></label>
      <button type="submit" className="secondary-button full" disabled={!parsed.success||loading}>Read this wallet’s records</button>
      <p>A guest or Solana pilgrim can enter the EVM address used to submit. No signing required.</p>
    </form>}
    <div className="sacred-filters" role="group" aria-label="Filter sacred records">{(['all','prayer','confession','praise'] as const).map(kind=>
      <button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>setFilter(kind)}>{kind==='all'?'All':labels[kind]}</button>)}</div>
    <div className="sacred-toolbar"><span className="sacred-loading" role="status">{loading?(page?'Updating…':'Loading…'):''}</span>
      <button type="button" className="sacred-refresh" aria-label="Refresh records" disabled={loading||!active||(personal&&!author)} onClick={refresh}><RefreshCw size={16}/></button>
      <InfoHint label="About these records">
        <p>Names and words are user submissions. Anonymous names and encrypted words are masked; anonymity does not hide the onchain sender.</p>
        <p>Reads the configured RPC and checks record evidence at three-block depth, not L1 settlement or permanent finality. Reading an address does not prove ownership. A failed refresh does not mean the chain is empty.</p>
        {page&&<p>{page.network} · chain {page.chainId} · blocks {page.from}–{page.to}. This window only; not a lifetime total.
          {page.missing.length>0&&` ${page.missing.map(k=>k==='prayer'?'Prayer':'Confession/praise').join(' and ')} reading is not configured.`}</p>}
        {page&&(page.unchecked>0||page.unverified>0)&&<p>{page.unchecked} events not checked due to the request limit; {page.unverified} could not be verified. Omitted events are not displayed or retrieved by older-window navigation.</p>}
        {checkedAt&&<p>Last checked: {new Date(checkedAt).toLocaleTimeString('en')}. A recently checked shared list may appear while updating; no new records appear before verification.</p>}
        <p>Refresh replaces this window. Hidden entries stay hidden while this panel is open. Only the masked shared list is kept in tab memory for 20 seconds; personal lookups and raw envelopes are not cached between reads. Nothing is saved to browser storage.</p>
      </InfoHint>
    </div>
    {personal&&!author&&<p role="status">Enter the EVM address that submitted your words. Wallet sign-in alone does not create a light.</p>}
    {loading&&!page&&<div className="sacred-skeleton" aria-hidden="true">{[0,1,2].map(i=><div key={i}><span/><span/></div>)}</div>}
    {!loading&&result?.status==='unconfigured'&&<p role="status">Records are not connected.</p>}
    {!loading&&result?.status==='unavailable'&&<p role="status">Couldn’t load records. Try refreshing.</p>}
    {page&&<>
      {personal&&<p className="sacred-count">✦ {page.records.length} verified {page.records.length===1?'record':'records'} in this window. No simulated lights.</p>}
      {!records.length&&!loading&&<p role="status">No verified records in this view.</p>}
      {records.map(r=><article className="sacred-entry" key={r.id} data-sacred-record={r.kind}>
        <span className="entry-type">{labels[r.kind]}</span><bdi className="sacred-name">{r.name}</bdi>
        <p className="sacred-words" dir="auto">{r.words}</p>
        <details className="sacred-details"><summary aria-label={`Record options · ${labels[r.kind]} · ${r.name}`}><MoreHorizontal size={18}/></summary>
          <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString('en',{timeZone:'UTC'})} · UTC</time><dl>
          <dt>Transaction</dt><dd><code>{r.transactionHash}</code></dd><dt>Contract</dt><dd><code>{r.contract}</code></dd><dt>Block</dt><dd>{r.blockNumber}</dd>
        </dl><button type="button" className="text-button" onClick={()=>setHidden(old=>new Set([...old].slice(-127).concat(r.id)))}>Hide this entry</button></details>
      </article>)}
      {page.olderBefore!==null&&<button type="button" className="text-button sacred-older" aria-label="Read older block window" disabled={loading} onClick={()=>setRequest(old=>({before:page.olderBefore!,revision:old.revision+1}))}>Older records</button>}
    </>}
  </section>;
}
