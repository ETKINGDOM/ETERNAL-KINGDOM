import { useEffect,useRef } from 'react';
import { Send } from 'lucide-react';
import { ChatCompositionGuard,chatKeyboardInset } from './chatInputCompatibility';

// Both entry points share the same draft and room sender. Focus is ordinary
// browser focus, not a sticky chat mode or a second multiplayer connection.
export default function PublicChatInput({value,onChange,onSend,onFocus,disabled,online,quick=false,recipient,onPublic,sendBusy=false}:{
  value:string;onChange:(text:string)=>void;onSend:()=>void;onFocus:()=>void;disabled:boolean;online:boolean;quick?:boolean;recipient?:string;onPublic?:()=>void;sendBusy?:boolean;
}){
  const composing=useRef(new ChatCompositionGuard()),input=useRef<HTMLInputElement>(null),form=useRef<HTMLFormElement>(null);
  useEffect(()=>{
    if(!quick)return;
    const viewport=window.visualViewport;
    const resize=()=>{
      // Keep the focused mobile input above the virtual keyboard. Browser
      // focus/scroll stays native; the canvas is never resized by this control.
      const inset=chatKeyboardInset(innerHeight,viewport,document.activeElement===input.current);
      form.current?.style.setProperty('--chat-keyboard-inset',`${inset}px`);
    };
    viewport?.addEventListener('resize',resize);viewport?.addEventListener('scroll',resize);
    input.current?.addEventListener('focus',resize);input.current?.addEventListener('blur',resize);
    const field=input.current;
    return()=>{viewport?.removeEventListener('resize',resize);viewport?.removeEventListener('scroll',resize);field?.removeEventListener('focus',resize);field?.removeEventListener('blur',resize);};
  },[quick]);
  const id=quick?'quick-chat-message':'chat-message';
  return <form ref={form} className={quick?'quick-chat-input':'chat-input'} aria-label={recipient?'Whisper message entry':quick?'Quick public chat':'Public chat message entry'} onSubmit={e=>{
    e.preventDefault();if(disabled||sendBusy||composing.current.blocksSubmit(performance.now()))return;onSend();
  }}>
    {recipient?<button type="button" className="quick-chat-channel-button" onClick={onPublic} aria-label="Return to public chat" title="Return to public chat">Whisper · <bdi>{recipient}</bdi><span aria-hidden="true">×</span></button>:quick&&<span className="quick-chat-channel" title="Visible to everyone in this room">Public</span>}
    <label className="sr-only" htmlFor={id}>{recipient?'Whisper message':quick?'Quick public message':'Public message'}</label>
    <input ref={input} id={id} placeholder={recipient?`Message ${recipient}…`:online?'Message this room…':'Waiting for your connection…'} value={value}
      onChange={e=>onChange(e.target.value)} onFocus={onFocus} onBlur={()=>composing.current.reset()}
      onCompositionStart={()=>composing.current.start()} onCompositionEnd={()=>composing.current.end(performance.now())}
      onKeyDown={e=>{if(composing.current.blocksKey({key:e.key,isComposing:e.nativeEvent.isComposing,keyCode:e.nativeEvent.keyCode},performance.now()))e.preventDefault();}}
      aria-describedby={quick?'quick-chat-help':undefined} maxLength={recipient?400:300} disabled={disabled} autoComplete="off" dir="auto" enterKeyHint="send"/>
    <button disabled={disabled||sendBusy||!value.trim()} type="submit" aria-label={recipient?'Send whisper':quick?'Send quick public message':'Send public message'} onClick={()=>{
      // A mouse/touch send should not strand focus on the send button.
      if(!disabled){composing.current.reset();input.current?.focus();}
    }}><Send size={17}/></button>
    {quick&&<span id="quick-chat-help" className="sr-only">{recipient?'Private to the selected person. Hosted chat is not end-to-end encrypted.':'Public and unencrypted.'} Enter sends. Click the world to walk. Keep private prayers and confessions in the separate composer.</span>}
  </form>;
}
