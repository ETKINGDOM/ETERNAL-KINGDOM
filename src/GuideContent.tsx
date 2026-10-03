import { useEffect, useImperativeHandle, useRef, useState, type Ref } from 'react';
import { flushSync } from 'react-dom';
import { Pause, Play, Upload, Volume2 } from 'lucide-react';
import { guide } from './content/guide';
import { narration } from './content/narration';

export type GuideContentHandle = { startFirstAnswer: () => void };

export default function GuideContent({onSpeakingChange,ref}:{onSpeakingChange?:(playing:boolean)=>void;ref?:Ref<GuideContentHandle>}={}) {
  const [question,setQuestion]=useState(0);
  const [playing,setPlaying]=useState(false);
  const [error,setError]=useState('');
  const [volume,setVolume]=useState(.85);
  const [audition,setAudition]=useState<{url:string;name:string;question:number}|null>(null);
  const audio=useRef<HTMLAudioElement>(null);
  const playbackRequest=useRef(0);
  const clip=narration.clips[question];
  const approved=clip?.textVersion===guide.version?clip:undefined;
  const preview=audition?.question===question?audition:null;
  const src=preview?.url??approved?.src;
  useEffect(()=>{onSpeakingChange?.(playing);return()=>onSpeakingChange?.(false);},[playing,onSpeakingChange]);
  useEffect(()=>{playbackRequest.current++;setPlaying(false);setError('');},[question,src]);
  useEffect(()=>{if(audio.current)audio.current.volume=volume;},[volume,src]);
  useEffect(()=>()=>{if(audition)URL.revokeObjectURL(audition.url);},[audition]);
  useEffect(()=>{const el=audio.current;return()=>{playbackRequest.current++;el?.pause();};},[]);
  async function play(el:HTMLAudioElement){
    const request=++playbackRequest.current;
    try{await el.play();if(request===playbackRequest.current)setError('');}
    catch{if(request===playbackRequest.current)setError('This recording could not play. Try the playback control again.');}
  }
  async function toggle(){
    const el=audio.current;if(!el||!src)return;
    if(!el.paused){playbackRequest.current++;el.pause();return;}
    await play(el);
  }
  function choose(index:number){
    playbackRequest.current++;
    audio.current?.pause();
    // Commit the new clip before play(), within the question's user gesture.
    // This also works when the listener clicks the already selected question.
    flushSync(()=>{setQuestion(index);setPlaying(false);setError('');});
    const el=audio.current;
    if(!el?.getAttribute('src'))return;
    el.currentTime=0;
    void play(el);
  }
  // Called from the opener's click, not an effect: keeps browser user activation
  // and avoids duplicate starts during Strict Mode's mount/cleanup checks.
  useImperativeHandle(ref,()=>({startFirstAnswer:()=>choose(0)}));
  return <div className="founder-story">
    <div className="founder-title"><span className="founder-sigil">✧</span><div><h3>{guide.name}</h3><p>A human calling. A shared beginning.</p></div></div>
    <div className="questions">{guide.questions.map((q,i)=><button key={q.question} className={i===question?'chosen':''} onClick={()=>choose(i)}>{String(i+1).padStart(2,'0')} <span>{q.question}</span></button>)}</div>
    <blockquote className="testimony" tabIndex={0} aria-label="Founder testimony">“{guide.questions[question].answer}”</blockquote>
    <audio ref={audio} src={src} preload="none" onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)} onEnded={()=>setPlaying(false)} onError={()=>{setPlaying(false);setError('The approved recording is unavailable. The complete text remains above.');}} />
    <div className="narration-player" data-narration-state={src?'ready':'unconfigured'}>
      <button className="narration-play" disabled={!src} onClick={toggle} aria-label={playing?'Pause narration':'Play narration'}>{playing?<Pause size={20}/>:<Play size={20}/>}</button>
      <div><strong>{preview?'Your local voice audition':approved?'Listen to the founder':'A voice worthy of the story'}</strong><span>{preview?preview.name:approved?`${approved.voice}${approved.synthetic?' · AI-generated voice':''}`:'Warm · resonant · reassuring'}</span></div>
      <Volume2 size={15}/><label className="sr-only" htmlFor="narration-volume">Narration volume</label><input id="narration-volume" type="range" min="0" max="1" step=".05" value={volume} onChange={e=>setVolume(Number(e.target.value))}/>
    </div>
    <p className="fine-print">Opening the Builder starts the first answer. Choose another question to switch, or select it again to restart. Pause anytime; closing this window stops the voice.{!src&&' This answer is awaiting an approved recording; its text remains available.'}</p>
    {error&&<p role="alert" className="error">{error}</p>}
    {import.meta.env.DEV&&<details className="voice-audition"><summary><Upload size={13}/> Audition a voice file · local preview</summary><p>A file you own or have permission to use. It stays in this browser, is not uploaded, and does not replace the world’s shared narration.</p><input aria-label="Local narration audition" type="file" accept="audio/*" onChange={e=>{const file=e.target.files?.[0];if(!file)return;if(!file.type.startsWith('audio/')||file.size>30*1024*1024){setError('Choose an audio file smaller than 30 MB.');return;}audio.current?.pause();setAudition({url:URL.createObjectURL(file),name:file.name,question});}}/>{audition&&<button onClick={()=>{audio.current?.pause();setAudition(null);}}>Remove local audition</button>}</details>}
  </div>;
}
