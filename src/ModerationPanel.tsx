import {useEffect,useRef,useState} from 'react';
import type {WalletSession} from '../shared/identity';
import {SCENES,SCENE_INFO,type Scene} from '../shared/scenes';
import {REPORT_REASONS} from '../shared/reporting';
import type {ModerationSnapshot,ModerationMutation,ReviewReport,ReviewDecision} from '../shared/moderation';
import {hostedModeration} from './moderationStorage';

const labels:Record<ReviewDecision|string,string>={dismiss:'Dismiss report','hide-message':'Hide public message','mute-15m':'Mute public text for 15 minutes',unmute:'Remove room mute',open:'Awaiting review'};
export default function ModerationPanel({session,initialScene,initialChannel,openProfile}:{session:WalletSession|null;initialScene:Scene;initialChannel:number;openProfile:()=>void}){
  const [scene,setScene]=useState(initialScene),[channel,setChannel]=useState(initialChannel),[snapshot,setSnapshot]=useState<ModerationSnapshot|null>(null);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState(''),[blocked,setBlocked]=useState(false);
  const [confirmation,setConfirmation]=useState<{command:ModerationMutation;name:string;text?:string}|null>(null);
  const serial=useRef(0),locked=useRef(false),controller=useRef<AbortController|null>(null);
  const scope=session?{accountId:session.accountId,sessionExpiresAt:session.expiresAt,scene,channel}:null;
  async function refresh(before?:number){
    if(!scope||locked.current)return;locked.current=true;setBusy(true);setConfirmation(null);
    const turn=++serial.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
    try{const value=await hostedModeration.read({...scope,kind:'list',...(before?{before}:{})},abort.signal);if(turn===serial.current){setSnapshot(value);setError('');setBlocked(false);}}
    catch(e){if(turn===serial.current){setSnapshot(null);setError(e instanceof Error?e.message:'Could not load moderation.');setBlocked(true);}}
    finally{if(turn===serial.current){locked.current=false;setBusy(false);}}
  }
  useEffect(()=>{setSnapshot(null);setError('');setNotice('');setConfirmation(null);locked.current=false;void refresh();return()=>{serial.current++;controller.current?.abort();};},[scene,channel,session?.accountId,session?.expiresAt]);
  function review(report:ReviewReport,decision:ReviewDecision){if(scope)setConfirmation({command:{...scope,kind:'review',reportId:report.id,expectedRevision:report.revision,decision,confirmed:true},name:report.message.name,text:report.message.text});}
  async function confirm(){
    if(!confirmation||locked.current||blocked)return;locked.current=true;setBusy(true);setError('');setNotice('');
    const turn=++serial.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;
    try{
      await hostedModeration.change(confirmation.command,abort.signal);if(turn!==serial.current)return;
      setNotice('Action confirmed by the room server.');setConfirmation(null);locked.current=false;await refresh();
    }catch(e){if(turn===serial.current){setError(e instanceof Error?e.message:'Action could not be confirmed. Refresh first.');setBlocked(true);setConfirmation(null);}}
    finally{if(turn===serial.current){locked.current=false;setBusy(false);}}
  }
  if(!session)return <div className="safety-panel"><p>Use the Report control beside a public message to report it. Guest reports are allowed.</p><p>Moderator tools require a verified wallet explicitly configured by the project operator. A nickname or religious title never grants access.</p><button className="primary full" onClick={openProfile}>Open wallet profile</button></div>;
  return <div className="safety-panel">
    <p>Public-room reports only. Private chats, confession drafts and receiving addresses are not available here. Decisions are manual; reporting alone never punishes a person.</p>
    <div className="safety-room"><label>Review map<select aria-label="Review map" value={scene} disabled={busy} onChange={e=>setScene(e.target.value as Scene)}>{SCENES.map(id=><option key={id} value={id}>{SCENE_INFO[id].name}</option>)}</select></label><label>Review channel<select aria-label="Review channel" value={channel} disabled={busy} onChange={e=>setChannel(Number(e.target.value))}>{[1,2,3].map(n=><option key={n} value={n}>Realm 0{n}</option>)}</select></label></div>
    <button className="secondary-button" disabled={busy} onClick={()=>void refresh()}>Refresh moderation</button>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
    {snapshot&&<>
      <p className="fine-print">Room-scoped decisions only. Wallet mutes survive reconnecting to this room; guest mutes cover one connection and can be evaded by reconnecting. No global bans, private-chat access or religious authority are implied.</p>
      {confirmation&&<section className="notice safety-confirm" aria-label="Confirm moderation action"><div><h3>{labels[confirmation.command.kind==='review'?confirmation.command.decision:'unmute']}</h3><p>{confirmation.name} · {SCENE_INFO[scene].name} / Realm 0{channel}</p>{confirmation.text&&<blockquote className="report-evidence">{confirmation.text}</blockquote>}<p>This affects public text in this room only. Hidden messages leave active chat and head bubbles, but existing copies cannot be recalled. Report evidence is retained for up to 7 days.</p><div className="social-actions"><button className="secondary-button" disabled={busy||blocked} onClick={()=>void confirm()}>Confirm moderation action</button><button className="text-button" disabled={busy} onClick={()=>setConfirmation(null)}>Cancel moderation action</button></div></div></section>}
      <h3>Reported public messages</h3>{!snapshot.reports.length&&<p>No retained reports in this room.</p>}
      {snapshot.reports.map(report=><article className="review-report" key={report.id} aria-label={`Report ${report.id}`}><b>{REPORT_REASONS[report.reason]}</b><small>{new Date(report.createdAt).toLocaleString()} · {labels[report.outcome]} · {report.targetKind} identity</small><blockquote className="report-evidence"><b>{report.message.name}</b><p>{report.message.text}</p></blockquote><code>{report.id}</code>{report.outcome==='open'&&<div className="social-actions">{(['dismiss','hide-message','mute-15m'] as const).map(decision=><button className="secondary-button" key={decision} disabled={busy||blocked||decision==='mute-15m'&&report.targetKind==='unknown'} onClick={()=>review(report,decision)}>{labels[decision]}</button>)}</div>}</article>)}
      {snapshot.nextBefore&&<button className="secondary-button" disabled={busy} onClick={()=>void refresh(snapshot.nextBefore!)}>Older reports</button>}
      <h3>Active room mutes</h3>{!snapshot.mutes.length&&<p>No active public-text mutes.</p>}{snapshot.mutes.map(mute=><div className="review-report" key={mute.subject}><b>{mute.name}</b><code>{mute.subject}</code><small>{mute.kind} · until {new Date(mute.until).toLocaleTimeString()}</small><button className="secondary-button" disabled={busy||blocked} onClick={()=>{if(scope)setConfirmation({command:{...scope,kind:'unmute',subject:mute.subject,expectedUntil:mute.until,confirmed:true},name:mute.name});}}>Remove room mute</button></div>)}
      <details><summary>Recent room audit</summary>{snapshot.audit.map(item=><p className="fine-print" key={item.id}>{new Date(item.time).toLocaleString()} · {labels[item.action]} · operator {item.actor.slice(0,12)} · {item.reportId??'mute removed'}</p>)}</details>
      <p className="fine-print">Up to 500 reports per room, retained for 7 days. Latest 50 audit events shown; up to 1,000 retained for 7 days. Refresh manually; no background administrator polling.</p>
    </>}
  </div>;
}
