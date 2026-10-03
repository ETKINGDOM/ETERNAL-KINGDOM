import {useEffect,useRef,useState} from 'react';
import type {Address} from 'viem';
import {evmReceivingAddressSchema} from '../shared/profile';
import type {RecordKind} from '../shared/adapters';
import {RefreshCw,MoreHorizontal} from 'lucide-react';
import {createFaithRecordReader,type FaithRecordReader,type FaithFeedResult} from './faithRecordFeed';
import {createPublicFaithReader} from './databaseFaithReader';
import {recentSharedRecords,rememberSharedRecords,forgetSharedRecords} from './faithRecordDisplayCache';
import {projectChainSettings} from './projectChainSettings';
import {faithIndexConfiguration} from '../shared/faithIndex';
import InfoHint from './InfoHint';
import {appendRecordPage,PUBLIC_RECORD_PAGE_SIZE,PUBLIC_RECORD_EXPAND_SIZE} from './faithRecordPagination';
import './faith.css';
import './sacredRecords.css';

const indexConfiguration=faithIndexConfiguration(projectChainSettings),recentAppendOnly=!!indexConfiguration;
const projectReader=createPublicFaithReader(projectChainSettings),personalReader=createFaithRecordReader(projectChainSettings,undefined,{authorHistory:true,floor:indexConfiguration?.floor,appendOnlyStateAtHead:recentAppendOnly,retryReadFailures:true});
const labels={prayer:'Prayer',confession:'Confession',praise:'Praise'};
export default function SacredRecordList({active,personal=false,account,reader=personal?personalReader:projectReader}:{active:boolean;personal?:boolean;account?:string;reader?:FaithRecordReader}){
  const [address,setAddress]=useState(account??'');
  const [author,setAuthor]=useState(account);
  const [initial]=useState(()=>!personal&&active?recentSharedRecords(reader):null);
  const [result,setResult]=useState<FaithFeedResult|null>(initial?.page??null);
  const [checkedAt,setCheckedAt]=useState<number|null>(initial?.checkedAt??null);
  const [loading,setLoading]=useState(active&&(!personal||!!account));
  const [filter,setFilter]=useState<RecordKind|'all'>('all');
  const [visibleLimit,setVisibleLimit]=useState(PUBLIC_RECORD_PAGE_SIZE);
  const [loadError,setLoadError]=useState(false);
  const [hidden,setHidden]=useState<Set<string>>(()=>new Set());
  const [request,setRequest]=useState<{before?:string;revision:number}>({revision:0});
  const generation=useRef(0);
  const pollingUntil=useRef(Date.now()+180000);
  const fastUntil=useRef(Date.now()+30000);
  const parsed=evmReceivingAddressSchema.safeParse(address);
  useEffect(()=>{
    const own=++generation.current,controller=new AbortController();
    setLoading(false);
    if(!active||(personal&&!author))return ()=>{controller.abort();};
    const cached=!personal&&!request.before?recentSharedRecords(reader):null;
    setResult(old=>request.before?old:personal?null:cached?.page??(old?.status==='available'?old:null));
    if(cached)setCheckedAt(cached.checkedAt);
    setLoading(true);
    setLoadError(false);
    void reader.read({signal:controller.signal,author:personal?author as Address:undefined,before:request.before}).then(next=>{
      if(controller.signal.aborted||generation.current!==own)return;
      if(request.before&&next.status!=='available'){setLoadError(true);return;}
      setResult(old=>request.before&&next.status==='available'&&old?.status==='available'?appendRecordPage(old,next):next);
      if(next.status==='available'){
        setCheckedAt(Date.now());
        if(!personal&&!request.before)rememberSharedRecords(reader,next);
      }else if(!personal)forgetSharedRecords(reader);
    }).catch(()=>{
      if(!controller.signal.aborted&&generation.current===own){if(request.before)setLoadError(true);else{setResult({status:'unavailable'});if(!personal)forgetSharedRecords(reader);}}
    }).finally(()=>{if(!controller.signal.aborted&&generation.current===own)setLoading(false);});
    return ()=>{controller.abort();};
  },[active,personal,author,reader,request]);
  const refresh=()=>{setVisibleLimit(PUBLIC_RECORD_PAGE_SIZE);pollingUntil.current=Date.now()+180000;fastUntil.current=Date.now()+30000;setRequest(old=>({revision:old.revision+1}));};
  const page=result?.status==='available'?result:null;
  const unavailableIndex=!!reader.sharedIndex&&result?.status==='unavailable';
  useEffect(()=>{
    if(!active||personal||loading||page?.indexing===undefined&&!unavailableIndex||request.before&&!page?.indexing&&!unavailableIndex||(page?.indexing||unavailableIndex)&&Date.now()>pollingUntil.current)return;
    const fast=page?.indexing||unavailableIndex||Date.now()<fastUntil.current;
    const timer=setTimeout(()=>{if(document.visibilityState==='visible')setRequest(old=>({...old,revision:old.revision+1}));},fast?5000:15000);
    return()=>clearTimeout(timer);
  },[active,personal,loading,page,request.before,unavailableIndex]);
  useEffect(()=>{
    if(!active||personal||page?.indexing===undefined&&!reader.sharedIndex||request.before&&!page?.indexing&&!unavailableIndex)return;
    const visible=()=>{if(document.visibilityState==='visible'){pollingUntil.current=Date.now()+180000;fastUntil.current=Date.now()+30000;setRequest(old=>({...old,revision:old.revision+1}));}};
    document.addEventListener('visibilitychange',visible);return()=>document.removeEventListener('visibilitychange',visible);
  },[active,personal,page?.indexing,request.before,reader,unavailableIndex]);
  const records=page?.records.filter(r=>!hidden.has(r.id)&&(filter==='all'||r.kind===filter))??[];
  return <section className="sacred-records" aria-label={personal?'Personal chain records':'Shared chain records'}>
    {personal&&!account&&<form className="sacred-account" onSubmit={e=>{e.preventDefault();if(!parsed.success||loading)return;setAuthor(parsed.data);refresh();}}>
      <label className="field-label">Submitting EVM address · read only<input value={address} onChange={e=>setAddress(e.target.value)} autoComplete="off" spellCheck={false} maxLength={42} placeholder="0x…"/></label>
      <button type="submit" className="secondary-button full" disabled={!parsed.success||loading}>Read this wallet’s records</button>
      <InfoHint label="Personal record lookup details"><p>A guest or Solana pilgrim can enter the EVM address used to submit. No signing required. Only publicly readable chain records are returned.</p></InfoHint>
    </form>}
    {personal&&account&&<div className="personal-record-account">Your connected EVM wallet <InfoHint label="Personal record lookup details"><p>Automatically reads the submitting address {account}. No extra wallet connection or signature. Records submitted from another address belong to that address.</p></InfoHint></div>}
    <div className="sacred-filters" role="group" aria-label="Filter sacred records">{(['all','prayer','confession','praise'] as const).map(kind=>
      <button type="button" key={kind} aria-pressed={filter===kind} onClick={()=>{setFilter(kind);setVisibleLimit(PUBLIC_RECORD_PAGE_SIZE);}}>{kind==='all'?'All':labels[kind]}</button>)}</div>
    <div className="sacred-toolbar"><span className="sacred-loading" role="status">{loading?(page?'Updating…':'Loading…'):''}</span>
      <button type="button" className="sacred-refresh" aria-label="Refresh records" disabled={loading||!active||(personal&&!author)} onClick={refresh}><RefreshCw size={16}/></button>
      <InfoHint label="About these records">
        <p>Names and words are user submissions. Anonymous names and encrypted words are masked; anonymity does not hide the onchain sender.</p>
        <p>{reader.database?'Reads the public database without querying the blockchain. Records are verified before storage; historical imports retain their earlier verification date. New records can appear later if the RPC is limited.':'Reads the configured RPC and checks record evidence at three-block depth.'} Verification is provisional inclusion, not L1 settlement or permanent finality. {(page?.indexing!==undefined||personal&&reader===personalReader&&recentAppendOnly)&&'For these exact append-only contracts, original transactions, receipts and canonical blocks are compared with recent anchored record storage; this is not an archive-state proof. '}Reading an address does not prove ownership. A failed refresh does not mean the chain is empty.</p>
        {page&&<p>{page.network} · chain {page.chainId} · blocks {page.from}–{page.to}. {personal?'History is filtered by submitting wallet from the configured contract start. Proofs are verified in bounded pages; the count describes loaded verified records, not unverified events or a religious rank.':reader.database?'Saved public records only, not a claim that all chain history is synchronized. Opening this screen does not scan old blocks. The database is replaceable; the chain record is independent.':page.indexing===undefined?'This window only; not a lifetime total.':'Shared verified projection. Older history is backfilled while the public screen is in use; a cache is rebuildable, not the permanent record.'}
          {page.missing.length>0&&` ${page.missing.map(k=>k==='prayer'?'Prayer':'Confession/praise').join(' and ')} reading is not configured.`}</p>}
        {page&&(page.unchecked>0||page.unverified>0)&&<p>{page.unchecked} events not checked due to the request limit; {page.unverified} could not be verified. Omitted events are not displayed or retrieved by older-window navigation.</p>}
        {checkedAt&&<p>Last read: {new Date(checkedAt).toLocaleTimeString('en')}. A recently checked shared list may appear while updating; no new records appear before verification.</p>}
        {reader.database&&page?.verifiedAt&&<p>Last database verification/update: {new Date(page.verifiedAt).toLocaleString('en',{timeZone:'UTC'})} UTC. This does not reverify every saved record on each visit.</p>}
        <p>Refresh replaces this view. Hidden entries stay hidden while this panel is open. The server caches only the public, masked projection. Personal lookups, raw envelopes, keys and ciphertext are not stored in this cache. Nothing is saved to browser storage.</p>
      </InfoHint>
    </div>
    {personal&&!author&&<p role="status">Enter the EVM address that submitted your words. Wallet sign-in alone does not create a light.</p>}
    {loading&&!page&&<div className="sacred-skeleton" aria-hidden="true">{[0,1,2].map(i=><div key={i}><span/><span/></div>)}</div>}
    {!loading&&result?.status==='unconfigured'&&<p role="status">Records are not connected.</p>}
    {!loading&&result?.status==='unavailable'&&<p role="status">Couldn’t load records. Try refreshing.</p>}
    {!loading&&loadError&&<p role="status">Couldn’t load more. Try again.</p>}
    {page&&<>
      {personal&&<div className="personal-record-counts"><p className="sacred-count">{page.records.length} verified {page.records.length===1?'record':'records'} loaded{page.olderBefore?' · more available':''}</p><div>{(['prayer','confession','praise'] as const).map(kind=><span key={kind}>{labels[kind]} <strong>{page.records.filter(r=>r.kind===kind).length}</strong></span>)}</div></div>}
      {!records.length&&!loading&&<p role="status">{page.unverified>0?'Some records could not be verified. Try refreshing.':reader.database?(page.indexing?'Syncing new records…':'No saved records in this view.'):(page.indexing?'Searching older history…':'No verified records in this view.')}</p>}
      {records.slice(0,visibleLimit).map(r=><article className="sacred-entry" key={r.id} data-sacred-record={r.kind}>
        <span className="entry-type">{labels[r.kind]}</span><bdi className="sacred-name">{r.name}</bdi>
        <p className="sacred-words" dir="auto">{r.words}</p>
        <details className="sacred-details"><summary aria-label={`Record options · ${labels[r.kind]} · ${r.name}`}><MoreHorizontal size={18}/></summary>
          <time dateTime={r.createdAt}>{new Date(r.createdAt).toLocaleString('en',{timeZone:'UTC'})} · UTC</time><dl>
          <dt>Transaction</dt><dd><code>{r.transactionHash}</code></dd><dt>Contract</dt><dd><code>{r.contract}</code></dd><dt>Block</dt><dd>{r.blockNumber}</dd>
        </dl><button type="button" className="text-button" onClick={()=>setHidden(old=>new Set([...old].slice(-127).concat(r.id)))}>Hide this entry</button></details>
      </article>)}
      {(records.length>visibleLimit||page.olderBefore!==null)&&<button type="button" className="text-button sacred-older" aria-label="Show more records" disabled={loading} onClick={()=>{
        // A failed older-page read cannot accumulate invisible expansion credit.
        const nextLimit=Math.min(visibleLimit,records.length)+PUBLIC_RECORD_EXPAND_SIZE;
        setVisibleLimit(nextLimit);
        if(records.length<nextLimit&&page.olderBefore)setRequest(old=>({before:page.olderBefore!,revision:old.revision+1}));
      }}><MoreHorizontal size={22}/></button>}
    </>}
  </section>;
}
