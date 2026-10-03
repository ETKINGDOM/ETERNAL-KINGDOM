import { useEffect,useRef,useState } from 'react';
import type { LiveSpeechAdapter } from '../shared/adapters';
import { analyzeFaithText } from '../shared/faithReview';
import { browserSpeechAdapter,SPEECH_LANGUAGES } from './browserSpeech';
const messages={permission:'Microphone or speech-service permission was denied. You can keep typing.',unavailable:'This microphone or language is unavailable in this browser. You can keep typing.',
  'no-speech':'No finalized speech was recognized. No text was inserted.',limit:'Recognized text exceeded the private composer limits or contained unsupported characters. Shorten your next recording or type instead.',failed:'Speech recognition did not finish normally. Review any text already shown; nothing was submitted.'};
export default function FaithSpeechInput({append,onActiveChange,disabled=false,adapter}:{append:(text:string)=>boolean;onActiveChange:(active:boolean)=>void;disabled?:boolean;adapter?:LiveSpeechAdapter}){
  const port=useRef(adapter??browserSpeechAdapter());
  const [available]=useState(()=>port.current.available());
  const [consent,setConsent]=useState(false),[language,setLanguage]=useState('en-US'),[text,setText]=useState(''),[error,setError]=useState('');
  const [state,setState]=useState<'requesting'|'listening'|'finishing'|'idle'>('idle');
  const session=useRef<ReturnType<LiveSpeechAdapter['start']>|null>(null),epoch=useRef(0),locked=useRef(false),mounted=useRef(true);
  const callback=useRef(onActiveChange);callback.current=onActiveChange;
  const active=state!=='idle';
  function cancel(clear=false){epoch.current++;locked.current=false;const current=session.current;session.current=null;current?.cancel();setState('idle');callback.current(false);if(clear)setText('');}
  useEffect(()=>{
    mounted.current=true;
    const hidden=()=>{if(document.hidden){epoch.current++;locked.current=false;const current=session.current;session.current=null;current?.cancel();setState('idle');callback.current(false);}};
    document.addEventListener('visibilitychange',hidden);
    return()=>{mounted.current=false;epoch.current++;locked.current=false;session.current?.cancel();session.current=null;callback.current(false);document.removeEventListener('visibilitychange',hidden);};
  },[]);
  function start(){
    if(!available||!consent||disabled||locked.current||text.trim())return;
    locked.current=true;const version=++epoch.current;setText('');setError('');callback.current(true);
    try {
      session.current=port.current.start({language,consent:'browser-managed-service',onText:value=>{if(mounted.current&&epoch.current===version)setText(value);},
        onState:value=>{if(mounted.current&&epoch.current===version){setState(value);if(value==='idle'){locked.current=false;session.current=null;callback.current(false);}}},
        onError:code=>{if(mounted.current&&epoch.current===version)setError(messages[code]);}});
    }catch{locked.current=false;session.current=null;setState('idle');callback.current(false);setError(messages.unavailable);}
  }
  const valid=analyzeFaithText(text).valid;
  return <section className="faith-speech" aria-label="Voice to text">
    <details onToggle={e=>{if(!e.currentTarget.open)cancel(true);}}><summary onClick={e=>{if(e.currentTarget.parentElement?.hasAttribute('open'))cancel(true);}}>Speak your words · optional</summary>
    <p className="fine-print">Your browser controls speech recognition and may send your microphone audio to its speech service before any encryption. Eternal Kingdom cannot guarantee that service’s retention, location or offline processing. Encrypted or anonymous confession does not make voice transcription private. Prefer typing for sensitive words.</p>
    <p className="fine-print">This app does not create or store an audio file, upload your transcript, publish it, or submit a transaction. Do not record other people. Stop or close this window to end capture; audio already processed by the browser service cannot be recalled.</p>
    {!available?<p role="status">Voice transcription is unavailable in this browser. Typing is always available.</p>:<>
      <label className="field-label" htmlFor="faith-speech-language">Spoken language · not translation</label><select id="faith-speech-language" value={language} disabled={active||disabled} onChange={e=>{setLanguage(e.target.value);setText('');setError('');}}>{SPEECH_LANGUAGES.map(([value,label])=><option value={value} key={value}>{label}</option>)}</select>
      <label className="check-row"><input type="checkbox" checked={consent} disabled={disabled} onChange={e=>{setConsent(e.target.checked);if(!e.target.checked)cancel(true);}}/> I consent to my browser’s speech service processing my voice.</label>
      {!active?<button className="secondary-button full" type="button" disabled={!consent||disabled||Boolean(text.trim())} onClick={start}>Start voice transcription</button>:<div className="faith-speech-actions"><button className="secondary-button" type="button" disabled={state==='finishing'} onClick={()=>session.current?.stop()}>Stop and review text</button><button className="secondary-button" type="button" onClick={()=>cancel(true)}>Cancel voice transcription</button></div>}
      <p role="status">{state==='requesting'?'Waiting for microphone permission…':state==='listening'?'Listening · maximum 60 seconds':state==='finishing'?'Finishing recognition…':'Microphone inactive · review before inserting text'}</p>
    </>}
    {text&&<><label className="field-label" htmlFor="faith-voice-text">Your voice transcript · private review</label><textarea id="faith-voice-text" dir="auto" rows={3} value={text} disabled={active} maxLength={4000} onChange={e=>{setText(e.target.value);setError('');}}/>
      {!active&&<p className="fine-print">Append or discard this reviewed transcript before starting another recording.</p>}
      <button className="secondary-button full" type="button" disabled={active||disabled||!valid} onClick={()=>{if(append(text)){setText('');setError('');}else setError('Adding this transcript would exceed the composer limits. Shorten it or edit your existing draft first.');}}>Append transcript to my draft</button>
      <button className="text-button" type="button" onClick={()=>cancel(true)}>Discard voice text</button></>}
    {error&&<p className="error" role="alert">{error}</p>}
    <p className="fine-print">Language availability and accuracy depend on your browser/service. Speech becomes editable text only. It never starts prayer, confession, praise, a wallet prompt or public chat automatically.</p>
    </details>
  </section>;
}
