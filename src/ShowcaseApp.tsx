import {lazy,Suspense,useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {flushSync} from 'react-dom';
import {ArrowRight,DoorOpen,ScrollText,Volume2,VolumeX,X} from 'lucide-react';
import {COLORS,type Scene} from '../shared/world';
import {isScenic,isScene,portalsFor,SCENE_INFO} from '../shared/scenes';
import type {Posture} from '../shared/protocol';
import {useWorld} from './useWorld';
import {resolveWorldRenderer,worldRenderers,type WorldRendererProps} from './worldRenderers';
import type {QualityPreference} from './renderQuality';
import {Ambient} from './Ambient';
import GuideContent,{type GuideContentHandle} from './GuideContent';
import FeatureBoundary from './FeatureBoundary';
import RunControl from './RunControl';
import PostureControls from './PostureControls';
import WorldToolbar from './WorldToolbar';
import MobileWorldControls from './MobileWorldControls';
import useTouchLayout from './useTouchLayout';
import {createMovementInput} from './touchMovement';
import {projectLinks} from './content/projectLinks';
import './showcase.css';

// No identity, token, transaction or social hooks mount in this mode. This is
// a distinct guest-only entry point, not a disabled form with a fallback CA.
const rendererId=resolveWorldRenderer(new URLSearchParams(location.search).get('view'));
const WorldRenderer=lazy(worldRenderers[rendererId].load);
const profile={name:'Pilgrim',color:COLORS[0]};
export default function ShowcaseApp(){
  const touch=useTouchLayout(),input=useMemo(createMovementInput,[]);
  const [entered,setEntered]=useState(false),[scene,setScene]=useState<Scene>('plaza');
  const [quality,setQuality]=useState<QualityPreference>('auto'),[running,setRunning]=useState(false);
  const [collapsed,setCollapsed]=useState(touch),[names,setNames]=useState(true);
  const [guideOpen,setGuideOpen]=useState(false),[notice,setNotice]=useState('');
  const [stopSignal,setStopSignal]=useState(0),[sound,setSound]=useState(false),[visible,setVisible]=useState(!document.hidden);
  const ambient=useRef<Ambient|null>(null),busy=useRef(false),guide=useRef<GuideContentHandle>(null),dialog=useRef<HTMLDialogElement>(null);
  const world=useWorld(scene,1,profile,entered);
  const active=entered&&visible&&!guideOpen&&world.status==='online';
  const onSpeaking=useCallback((playing:boolean)=>ambient.current?.setDucked(playing),[]);
  useEffect(()=>{const change=()=>setVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  useEffect(()=>{if(!active)input.clear();},[active,input]);
  useEffect(()=>()=>{void ambient.current?.stop();},[]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4000);return()=>clearTimeout(timer);},[notice]);
  useEffect(()=>{if(!guideOpen)return;const el=dialog.current!;el.showModal();return()=>el.close();},[guideOpen]);
  async function toggleSound(){
    if(busy.current)return;busy.current=true;
    try{
      if(ambient.current){const old=ambient.current;ambient.current=null;setSound(false);await old.stop();}
      else {const next=new Ambient();ambient.current=next;next.setVolume(.38);await next.start();setSound(true);}
    }catch{await ambient.current?.stop();ambient.current=null;setSound(false);setNotice('Ambient sound is unavailable in this browser.');}
    finally{busy.current=false;}
  }
  function openGuide(){input.clear();setStopSignal(v=>v+1);flushSync(()=>setGuideOpen(true));guide.current?.startFirstAnswer();}
  function travel(destination?:Scene){
    const next=destination??(scene==='plaza'?'temple':'plaza');
    if(!isScene(next)||next===scene||rendererId==='2d'&&isScenic(next)||destination&&!portalsFor(scene).some(p=>p.to===next))return;
    input.clear();setGuideOpen(false);setStopSignal(v=>v+1);setScene(next);
  }
  function posture(p:Posture){input.clear();setStopSignal(v=>v+1);world.send({v:1,type:'posture',posture:p});}
  const props:WorldRendererProps={scene,players:world.players,bubbles:[],showPlayerNames:names,onTogglePlayerNames:()=>setNames(v=>!v),
    self:world.self,active,stopWalkingSignal:stopSignal,quality,running,movementInput:input,
    move:p=>{world.send({v:1,type:'move',...p});},onStand:()=>{world.send({v:1,type:'posture',posture:'standing'});},onGuide:openGuide,onTravel:travel,
    onPerson:()=>{},onInspectStreet:()=>setNotice('Explore the streets. Trading is paused.'),
    onRitual:()=>setNotice('Explore and listen. Onchain features are paused.')};
  const soundButton=<button className="sound-button" onClick={()=>void toggleSound()} aria-label={sound?'Mute ambient sound':'Enable ambient sound'} aria-pressed={sound}>{sound?<Volume2 size={16}/>:<VolumeX size={16}/>}</button>;
  return <>
    {!entered&&<section className="entry-gate entry-3d" role="dialog" aria-modal="true" aria-labelledby="entry-title"><div className="entry-veil"/><div className="entry-content">
      <img className="brand-star" src="/brand/logo.jpg" alt="" width={48} height={48}/><span className="eyebrow">ONE CREATOR · ONE ETERNAL WORLD</span>
      <h1 id="entry-title">Leave the noise.<br/><em>Enter the light.</em></h1><div className="entry-rule"/><p>A place to be still.<br/>A world to walk together.</p>
      <span className="showcase-label">Preview · Explore and listen.<br/>Onchain features are paused.</span>
      <div className="entry-render-options"><label><input type="checkbox" checked={quality==='performance'} onChange={e=>setQuality(e.target.checked?'performance':'auto')}/> Prefer lighter 3D graphics</label></div>
      <button className="enter-world" onClick={()=>{setEntered(true);void toggleSound();}}>Enter the world <ArrowRight size={18}/></button>
      <span className="entry-note">Guest entry · no wallet required · headphones recommended</span>
      <a className="entry-whitepaper entry-official-x" href={projectLinks.whitepaper} target="_blank" rel="noopener noreferrer"><ScrollText size={16}/> Whitepaper · Our founding vision</a>
      <a className="entry-official-x" href={projectLinks.officialX} target="_blank" rel="noopener noreferrer">𝕏 Official X</a>
    </div><span className="entry-version">ETERNAL KINGDOM / SANCTUARY PREVIEW</span></section>}
    <div className="app-shell immersive showcase-shell" data-mode="showcase" data-scene={scene} data-panel="none" data-touch-controls={touch&&active&&collapsed} data-dock-collapsed={collapsed} inert={!entered}>
      <header className="site-header"><a className="brand" href="#world"><img className="brand-star" src="/brand/logo.jpg" alt="" width={48} height={48}/><div>ETERNAL KINGDOM<small>ONE CREATOR · ONE ETERNAL WORLD</small></div></a><span className="showcase-label">Preview · Explore and listen</span></header>
      <main id="world"><div className="world-layout"><section className="world-card" aria-label="Interactive world">
        <div className="scene-top"><div className="location-pill"><span className="live-dot" data-online={world.status==='online'}/>{SCENE_INFO[scene].name}</div><div className="scene-top-controls"><button className="text-button showcase-listen" onClick={openGuide}>Hear the founding dream</button><div className="sound-controls">{soundButton}</div></div></div>
        <FeatureBoundary label="World view"><Suspense fallback={<div className="art-loading" role="status">Preparing the world…</div>}><WorldRenderer key={scene} {...props}/></Suspense></FeatureBoundary>
        <div className="sanctuary-caption" key={scene}><span>{SCENE_INFO[scene].caption}</span><h1>{scene==='temple'?'Be still. You are here.':SCENE_INFO[scene].name}</h1><p>{SCENE_INFO[scene].subtitle}</p></div>
        {notice&&<p className="showcase-notice" role="status">{notice}</p>}
        <WorldToolbar collapsed={collapsed} onCollapse={setCollapsed}><RunControl running={running} enabled={active} toggle={()=>setRunning(v=>!v)}/><PostureControls posture={world.players.find(p=>p.id===world.self)?.posture??'standing'} disabled={!active} shortcutsEnabled={active} onChange={posture} visible={!collapsed}/>
          <button className="text-button travel-button" onClick={()=>travel()} disabled={!active}><DoorOpen size={18}/>{scene==='plaza'?'Enter the Sanctuary':'Return to the courtyard'}</button>
        </WorldToolbar>
        {touch&&active&&collapsed&&<MobileWorldControls input={input} resetKey={`${scene}:${world.self}:${guideOpen}`} posture={world.players.find(p=>p.id===world.self)?.posture??'standing'} onPosture={posture}/>}
      </section></div>
      <section className="guide-card"><div><span className="eyebrow">THE FOUNDING DREAM</span><h3>The Builder</h3><p>A human calling. A shared beginning.</p></div><button className="text-button" onClick={openGuide}>Listen <ArrowRight size={18}/></button></section>
      </main>
    </div>
    {guideOpen&&<dialog ref={dialog} aria-label="The founding dream" onCancel={e=>{e.preventDefault();setGuideOpen(false);}} onClick={e=>{if(e.target===e.currentTarget)setGuideOpen(false);}}><div className="modal-head"><div><span className="eyebrow">THE BUILDER</span><h2>The founding dream</h2></div><button className="icon-button" aria-label="Close dialog" onClick={()=>setGuideOpen(false)}><X size={20}/></button></div><FeatureBoundary label="The founding dream" close={()=>setGuideOpen(false)}><GuideContent ref={guide} onSpeakingChange={onSpeaking}/></FeatureBoundary></dialog>}
  </>;
}
