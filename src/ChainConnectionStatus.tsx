import {chainSetup} from './chainSetup';
import {projectChainSettings} from './projectChainSettings';
import {useEffect,useRef,useState} from 'react';
import type {ReadinessRow} from './chainReadiness';
export default function ChainConnectionStatus(){
  const [rows,setRows]=useState<ReadinessRow[]|null>(null),[busy,setBusy]=useState(false),epoch=useRef(0),controller=useRef<AbortController|null>(null);
  useEffect(()=>()=>{epoch.current++;controller.current?.abort();},[]);
  async function inspect(){
    if(controller.current)return;const current=++epoch.current,abort=new AbortController();controller.current=abort;setBusy(true);setRows(null);
    try{const {checkChainReadiness}=await import('./chainReadiness');const result=await checkChainReadiness(projectChainSettings,abort.signal);if(epoch.current===current)setRows(result);}
    catch{if(epoch.current===current)setRows([{feature:'Network inspection',state:'failed',detail:'Inspection unavailable. Nothing was enabled or sent.'}]);}
    finally{if(epoch.current===current){controller.current=null;setBusy(false);}}
  }
  return <details className="chain-connection-status" onToggle={e=>{if(!e.currentTarget.open){epoch.current++;controller.current?.abort();controller.current=null;setBusy(false);setRows(null);}}}><summary>Project connection status</summary><p className="fine-print">Configuration only, not a live-network or contract audit. Reading this status requests no wallet access. Project settings are build-owned; players cannot enable payments.</p>
    {chainSetup(projectChainSettings).map(row=><p className="fine-print" key={row.feature}><b>{row.feature}</b> · {row.state==='configured'?'Settings supplied · still requires live verification':row.state==='disabled'?'Settings supplied · broadcasting disabled':row.state==='invalid'?'Invalid settings':'Not connected'}{row.missing.length>0&&<> · Missing: {row.missing.join(', ')}</>}</p>)}
    <p className="fine-print">ETH / SOL / BTC donation execution and group voice remain reserved interfaces, not enabled by setting the God token contract. One-to-one live voice requires a separate invitation, acceptance and each participant’s microphone consent. A person gift also requires that person’s opt-in published EVM receiving address.</p>
    <p className="fine-print">Optional inspection sends only public configured addresses to the RPC. It requests no wallet, personal balance, faith words or transaction; it never enables payments.</p>
    <button type="button" className="secondary-button" disabled={busy} onClick={()=>void inspect()}>{busy?'Inspecting public settings…':'Inspect public chain settings'}</button>
    {rows&&<div role="status" aria-label="Public chain inspection">{rows.map(row=><p className="fine-print" key={row.feature}><b>{row.feature}</b> · {row.state} · {row.detail}</p>)}</div>}
  </details>;
}
