import {lazy,Suspense,useState} from 'react';
import type {WalletSession} from '../shared/identity';
import './dailyLamp.css';
const DailyLampPanel=lazy(()=>import('./DailyLampPanel'));
const SacredRecordList=lazy(()=>import('./SacredRecordList'));

export default function LampstandPanel({session,openProfile,onLit}:{session:WalletSession|null;openProfile:()=>void;onLit:()=>void}){
  const [tab,setTab]=useState<'lamps'|'records'>('lamps');
  return <>
    <div className="lampstand-tabs" role="tablist" aria-label="Lampstand views">
      {(['lamps','records'] as const).map((value,i)=><button key={value} type="button" role="tab" id={`lampstand-tab-${value}`} aria-controls={`lampstand-panel-${value}`} aria-selected={tab===value} tabIndex={tab===value?0:-1} onClick={()=>setTab(value)} onKeyDown={e=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();
        const next=e.key==='Home'?'lamps':e.key==='End'?'records':i===0?'records':'lamps';setTab(next);document.getElementById(`lampstand-tab-${next}`)?.focus();
      }}>{value==='lamps'?'Light a lamp':'My records'}</button>)}
    </div>
    <div role="tabpanel" id={`lampstand-panel-${tab}`} aria-labelledby={`lampstand-tab-${tab}`}>
      <Suspense fallback={<p role="status">{tab==='lamps'?'Loading your lamps…':'Loading your records…'}</p>}>
        {tab==='lamps'?<DailyLampPanel session={session} openProfile={openProfile} onLit={onLit}/>:<SacredRecordList active personal account={session?.family==='evm'?session.address:undefined}/>}
      </Suspense>
    </div>
  </>;
}
