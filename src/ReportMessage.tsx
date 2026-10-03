import {useEffect,useRef,useState} from 'react';
import type {ChatMessage,ClientPacket} from '../shared/protocol';
import {REPORT_REASONS,type ReportReason,type ReportReceipt} from '../shared/reporting';

export default function ReportMessage({message,online,reviewConfigured,receipt,send}:{message:ChatMessage;online:boolean;reviewConfigured:boolean;receipt:ReportReceipt|null;send:(packet:ClientPacket)=>boolean}){
  const [reason,setReason]=useState<ReportReason>('spam'),[requestId]=useState(()=>crypto.randomUUID()),[waiting,setWaiting]=useState(false),[attempted,setAttempted]=useState(false),[error,setError]=useState('');
  const timer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const result=receipt?.requestId===requestId?receipt:null;
  useEffect(()=>()=>clearTimeout(timer.current),[]);
  useEffect(()=>{if(result){clearTimeout(timer.current);setWaiting(false);setError('');}},[result]);
  const saved=result?.status==='saved'||result?.status==='duplicate';
  function submit(){
    if(waiting||saved)return;
    if(!send({v:1,type:'report',requestId,messageId:message.id,reason})){setError('Reconnect to this room before reporting.');return;}
    setAttempted(true);setWaiting(true);setError('');clearTimeout(timer.current);
    timer.current=setTimeout(()=>{setWaiting(false);setError('Receipt not confirmed. You may retry manually; the server will not duplicate a saved report.');},7000);
  }
  return <div className="safety-panel">
    <p>This reports only the selected public message. Private chats, faith drafts and wallet addresses are not attached.</p>
    <blockquote className="report-evidence"><b>{message.name}</b><p>{message.text}</p></blockquote>
    <label htmlFor="report-reason">Reason</label><select id="report-reason" value={reason} disabled={attempted} onChange={e=>setReason(e.target.value as ReportReason)}>{Object.entries(REPORT_REASONS).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
    <p className="fine-print">A copy of this public message and the selected reason may be kept for manual review for up to 7 days. Reporting does not automatically hide a message or punish anyone. Review is not guaranteed.</p>
    {!reviewConfigured&&<p className="notice">No moderator wallet is configured yet. Reports can be saved, but nobody is automatically notified or assigned to review them.</p>}
    {saved?<p role="status">{result.status==='duplicate'?'This message was already reported from your account or guest network.':'Report saved for manual review.'} Reference: {result.reportId}</p>:<button className="primary full" disabled={!online||waiting} onClick={submit}>{waiting?'Waiting for receipt…':attempted?'Retry report':'Submit public-message report'}</button>}
    {result?.status==='unavailable'&&<p role="alert">This message is no longer available for reporting. It may have expired, been hidden, or belonged to another room.</p>}
    {result?.status==='limited'&&<p role="alert">The reporting limit was reached. Please try later. No new report was saved.</p>}
    {error&&<p role="alert">{error}</p>}
  </div>;
}
