import type { LiveSpeechAdapter } from '../shared/adapters';
import { analyzeFaithText,FAITH_TEXT_LIMITS } from '../shared/faithReview';

export type SpeechResultEvent={results:ArrayLike<{isFinal:boolean;0:{transcript:string}}>} ;
export type BrowserRecognition={lang:string;continuous:boolean;interimResults:boolean;maxAlternatives:number;
  onstart:(()=>void)|null;onend:(()=>void)|null;onresult:((event:SpeechResultEvent)=>void)|null;onerror:((event:{error:string})=>void)|null;
  start():void;stop():void;abort():void;};
export type RecognitionConstructor=new()=>BrowserRecognition;
export const SPEECH_LANGUAGES=[['en-US','English (US)'],['en-GB','English (UK)'],['zh-CN','中文（简体）'],['zh-TW','中文（繁體）'],
  ['es-ES','Español'],['fr-FR','Français'],['de-DE','Deutsch'],['pt-BR','Português'],['ar-SA','العربية'],['he-IL','עברית'],
  ['hi-IN','हिन्दी'],['id-ID','Bahasa Indonesia'],['ja-JP','日本語'],['ko-KR','한국어'],['ru-RU','Русский'],['tr-TR','Türkçe'],['fa-IR','فارسی']] as const;

export function finalizedSpeechText(event:SpeechResultEvent):string{
  const results=event.results;
  if(!Number.isSafeInteger(results.length)||results.length<0||results.length>256)throw Error('limit');
  const pieces:string[]=[];let units=0;
  for(let i=0;i<results.length;i++){
    const result=results[i];if(!result||typeof result.isFinal!=='boolean')throw Error('failed');if(!result.isFinal)continue;
    const text=result[0]?.transcript;if(typeof text!=='string')throw Error('failed');
    units+=text.length;if(units>FAITH_TEXT_LIMITS.characters*2)throw Error('limit');pieces.push(text.trim());
  }
  const text=pieces.filter(Boolean).join(' ');if(!text)return '';
  if(!analyzeFaithText(text).valid)throw Error('limit');return text;
}
function recognitionConstructor():RecognitionConstructor|null{
  try {const surface=globalThis as typeof globalThis & {SpeechRecognition?:RecognitionConstructor;webkitSpeechRecognition?:RecognitionConstructor};
    const candidate=surface.SpeechRecognition??surface.webkitSpeechRecognition;return typeof candidate==='function'?candidate:null;
  }catch{return null;}
}
export function browserSpeechAdapter(getConstructor:()=>RecognitionConstructor|null=recognitionConstructor):LiveSpeechAdapter{
  let active=false;
  return {available:()=>{try{return Boolean(getConstructor());}catch{return false;}},start(options){
    if(active||options.consent!=='browser-managed-service'||!SPEECH_LANGUAGES.some(([language])=>language===options.language))throw Error('Speech unavailable');
    const Constructor=getConstructor();if(!Constructor)throw Error('Speech unavailable');
    const recognition=new Constructor();active=true;let closed=false,finishing=false,hasText=false;
    let timer:ReturnType<typeof setTimeout>|undefined,grace:ReturnType<typeof setTimeout>|undefined;
    function cleanup(){if(closed)return false;closed=true;active=false;clearTimeout(timer);clearTimeout(grace);
      recognition.onstart=null;recognition.onend=null;recognition.onresult=null;recognition.onerror=null;return true;}
    const abort=()=>{try{recognition.abort();}catch{/* Browser may have stopped already. */}};
    const cancel=()=>{if(cleanup()){abort();options.onState('idle');}};
    const fail=(code:Parameters<typeof options.onError>[0])=>{if(cleanup()){abort();options.onError(code);options.onState('idle');}};
    const stop=()=>{
      if(closed||finishing)return;finishing=true;options.onState('finishing');clearTimeout(timer);
      grace=setTimeout(()=>{if(cleanup()){abort();if(!hasText)options.onError('no-speech');options.onState('idle');}},3000);
      try{recognition.stop();}catch{fail('failed');}
    };
    try{recognition.lang=options.language;recognition.continuous=true;recognition.interimResults=false;recognition.maxAlternatives=1;}
    catch{fail('unavailable');return {stop,cancel};}
    recognition.onstart=()=>{if(!closed&&!finishing)options.onState('listening');};
    recognition.onend=()=>{if(cleanup()){if(!hasText)options.onError('no-speech');options.onState('idle');}};
    recognition.onresult=event=>{
      if(closed)return;
      try {const text=finalizedSpeechText(event);if(text){hasText=true;options.onText(text);}}
      catch(error){fail(error instanceof Error&&error.message==='limit'?'limit':'failed');}
    };
    recognition.onerror=event=>{if(closed)return;const code=event.error;
      fail(code==='not-allowed'||code==='service-not-allowed'?'permission':code==='no-speech'?'no-speech':code==='language-not-supported'||code==='audio-capture'?'unavailable':'failed');};
    options.onState('requesting');timer=setTimeout(stop,60000);
    try{recognition.start();}catch{fail('failed');}
    return {stop,cancel};
  }};
}
