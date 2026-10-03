import { ChevronDown,ChevronUp,Flag,MessageCircle,X } from 'lucide-react';
import {useEffect,useRef,useState} from 'react';
import type { ChatMessage } from '../shared/protocol';
import { recentPublicMessages } from './recentPublicChatState';
import { graphemeExcerpt } from './textPresentation';
import type {SocialPeer} from '../shared/social';
type WhisperLine={id:string;text:string;time:number;mine:boolean;peer:SocialPeer};

export default function RecentPublicChat({messages,expanded,onToggle,onOpen,onReport,onHide,compact=false,onWhisper,canWhisper,safetyControls=false,whispers=[],onPrivate}:{
  messages:readonly ChatMessage[];expanded:boolean;onToggle:()=>void;onOpen:()=>void;
  onReport:(message:ChatMessage)=>void;onHide:(sender:string)=>void;
  compact?:boolean;onWhisper?:(message:ChatMessage)=>void;canWhisper?:(message:ChatMessage)=>boolean;safetyControls?:boolean;whispers?:WhisperLine[];onPrivate?:(peer:SocialPeer)=>void;
}){
  const recent=recentPublicMessages(messages,Date.now());
  const lines=[...recent.map(message=>({id:message.id,time:message.time,message,private:null as WhisperLine|null})),...whispers.slice(-5).map(line=>({id:line.id,time:line.time,message:null as ChatMessage|null,private:line}))].sort((a,b)=>a.time-b.time).slice(-5);
  const [mobileOpen,setMobileOpen]=useState(false),[newMessages,setNewMessages]=useState(false);
  const latest=lines.at(-1)?.id??null,seen=useRef(latest);
  const open=compact?mobileOpen:expanded;
  useEffect(()=>{setMobileOpen(false);setNewMessages(false);seen.current=latest;},[compact]);
  useEffect(()=>{if(open){seen.current=latest;setNewMessages(false);}else if(latest&&latest!==seen.current)setNewMessages(true);},[latest,open]);
  const toggle=()=>{if(compact)setMobileOpen(v=>!v);else onToggle();};
  if(compact&&!open)return <section className="recent-public-chat recent-public-chat--compact" data-expanded="false" aria-label="Recent public messages" aria-live="off"><button type="button" className="recent-chat-icon" aria-label={newMessages?'Expand recent public messages · new messages':'Expand recent public messages'} aria-expanded="false" aria-controls="recent-public-chat-list" onClick={toggle}><MessageCircle size={19}/>{newMessages&&<span className="recent-chat-new-dot" aria-hidden="true"/>}</button><div id="recent-public-chat-list" hidden/></section>;
  return <section className={`recent-public-chat${compact?' recent-public-chat--compact':''}`} data-expanded={open} aria-label="Recent public messages" aria-live="off">
    <div className="recent-chat-heading">
      <button type="button" className="recent-chat-open" aria-label="Open public chat history" onClick={onOpen}><MessageCircle size={14}/><span>{whispers.length?'Chat · public & whispers':'Public · this room'}</span></button>
      <button type="button" className="recent-chat-toggle" aria-label={open?'Collapse recent public messages':'Expand recent public messages'} aria-expanded={open} aria-controls="recent-public-chat-list" onClick={toggle}>{open?<ChevronDown size={16}/>:<ChevronUp size={16}/>}</button>
    </div>
    <div id="recent-public-chat-list" hidden={!open}>
      {lines.length===0?<p className="recent-chat-empty">Be the first to greet this room.</p>:<ul>{lines.map(line=>{const m=line.message,w=line.private,reply=Boolean(m&&onWhisper&&(!canWhisper||canWhisper(m)));return w?<li key={w.id} className="recent-whisper"><button type="button" className="recent-chat-read" aria-label={`Reply to ${w.peer.name}`} onClick={()=>onPrivate?.(w.peer)}><b><bdi>{w.mine?`To ${w.peer.name}`:w.peer.name}</bdi> · Whisper</b><span dir="auto">{graphemeExcerpt(w.text,80)}</span></button></li>:m?<li key={m.id}>
        <button type="button" className="recent-chat-read" aria-label={reply?`Whisper to ${m.name}`:`Read public message from ${m.name}`} onClick={()=>reply?onWhisper?.(m):onOpen()}>
          <b><bdi>{m.name}</bdi></b><span dir="auto">{graphemeExcerpt(m.text.replace(/\s+/gu,' ').trim(),80)}</span>
        </button>
        {safetyControls&&<><button type="button" className="recent-chat-action" aria-label={`Report recent public message from ${m.name}`} onClick={()=>onReport(m)}><Flag size={13}/></button>
        <button type="button" className="recent-chat-action" aria-label={`Hide recent messages from ${m.name}`} title="Hide this connection's messages locally" onClick={()=>onHide(m.sender)}><X size={13}/></button></>}
      </li>:null;})}</ul>}
    </div>
  </section>;
}
