import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {releaseStorageKey} from './releaseScope';
import { flushSync } from 'react-dom';
import { ArrowDown, ArrowRight, Check, ChevronDown, DoorOpen, Heart, Leaf, MessageCircle, ScrollText, Shield, Sparkles, Users, Volume2, VolumeX, X } from 'lucide-react';
import { clientPacketSchema,nameSchema, type Player,type ChatMessage,type Posture } from '../shared/protocol';
import { COLORS, type Scene } from '../shared/world';
import { isScene, isScenic, SCENE_INFO, portalsFor } from '../shared/scenes';
import type { RecordKind } from '../shared/adapters';
import FaithComposer from './FaithComposer';
import { useWorld, type Profile } from './useWorld';
import { resolveWorldRenderer, worldRenderers, type WorldRendererProps } from './worldRenderers';
import type { QualityPreference } from './renderQuality';
import GuideContent, { type GuideContentHandle } from './GuideContent';
import { Ambient } from './Ambient';
import {ResponseNarrationTail,useResponseNarration,useRitualLight,useRitualDelivery} from './ResponseNarration';
import PostureControls from './PostureControls';
import type { SanctuaryAction } from '../shared/places';
import RunControl from './RunControl';
import WorldToolbar from './WorldToolbar';
import { projectChainSettings } from './projectChainSettings';
import { chainBroadcast,configuredGodToken,isShowcase } from '../shared/chainConfiguration';
import ShowcaseApp from './ShowcaseApp';
import { streetFeature, type StreetFeature } from '../shared/market';
import { useWalletIdentity } from './useWalletIdentity';
import WalletIdentityPanel from './WalletIdentityPanel';
import {useAccountProfile} from './useAccountProfile';
import {DEFAULT_APPEARANCE} from '../shared/profile';
import {readGuestRecipient,saveGuestRecipient} from './profileStorage';
import ReceivingAddressEditor from './ReceivingAddressEditor';
import ProfileBackup from './ProfileBackup';
import GiftPublication from './GiftPublication';
import {hostedGiftRecipients} from './giftRecipientStorage';
import {useSocialChat} from './useSocialChat';
import PersonMenu from './PersonMenu';
import FriendsPanel from './FriendsPanel';
import FriendRequestsHud from './FriendRequestsHud';
import type {SocialPeer} from '../shared/social';
import {useCommunity} from './useCommunity';
import {usePartyVoice} from './usePartyVoice';
import PartyVoiceHud from './PartyVoiceHud';
import ReportMessage from './ReportMessage';
import ModerationPanel from './ModerationPanel';
import AnnouncementList from './AnnouncementList';
import PublicChatInput from './PublicChatInput';
import { firstGrapheme } from './textPresentation';
import RecentPublicChat from './RecentPublicChat';
import { readRecentChatPreference,saveRecentChatPreference } from './recentPublicChatState';
import { giftTargetFor,giftTargetKey } from '../shared/gifts';
import { currentGiftPerson,unconfiguredGiftRecipients,type GiftPreviewSelection } from './giftPreviewState';
import { worldRealm } from './mobileWalletLinks';
import { useGiftTransactions } from './useGiftTransactions';
import {usePrayerTransactions} from './usePrayerTransactions';
import {useHolderFaithTransactions} from './useHolderFaithTransactions';
import {useNativeTokenTransactions} from './useNativeTokenTransactions';
import {projectLinks} from './content/projectLinks';
import MobileWorldControls from './MobileWorldControls';
import useTouchLayout from './useTouchLayout';
import {createMovementInput} from './touchMovement';
import {consumeBrowserWalletReturn} from './walletReturn';
import WorldRitualResponse from './WorldRitualResponse';
import FeatureBoundary from './FeatureBoundary';
import {browserWorldVisit,saveBrowserWorldVisit} from './worldVisit';
import {transactionWaitPhase} from './transactionLedger';
import TransactionWaitStatus from './TransactionWaitStatus';
import InfoHint from './InfoHint';
import LampstandPanel from './LampstandPanel';
import ActivityCenter from './ActivityCenter';
import type {ActivityInput} from './activityMessages';

const initialWalletReturn=consumeBrowserWalletReturn(location.search);
const initialVisit=browserWorldVisit();
const requestedView=new URLSearchParams(location.search).get('view')??((initialWalletReturn??initialVisit)?.legacy?'2d':null);
const rendererId=resolveWorldRenderer(requestedView);
const WorldRenderer=lazy(worldRenderers[rendererId].load);
const legacyView=rendererId==='2d';
const BlessingAvatar=lazy(()=>import('./BlessingAvatar'));
const GiftPopover=lazy(()=>import('./GiftPopover'));
const GodTokenPanel=lazy(()=>import('./GodTokenPanel'));
const GiftTransactionHistory=lazy(()=>import('./GiftTransactionHistory'));
const PrayerTransactionHistory=lazy(()=>import('./PrayerTransactionHistory'));
const HolderFaithTransactionHistory=lazy(()=>import('./HolderFaithTransactionHistory'));
const SacredRecordList=lazy(()=>import('./SacredRecordList'));
const DonationPanel=lazy(()=>import('./DonationPanel'));
const NativeTokenHistory=lazy(()=>import('./NativeTokenHistory'));
const ChainConnectionStatus=lazy(()=>import('./ChainConnectionStatus'));
const DailyLampPanel=lazy(()=>import('./DailyLampPanel'));
const showGodTokenPanel=projectChainSettings.status==='invalid'||Boolean(configuredGodToken(projectChainSettings));
const prayerEnabled=chainBroadcast(projectChainSettings,'prayers');

const PROFILE_KEY = releaseStorageKey('ek:guest:v1');
function readProfile(): Profile {
  try { const p = JSON.parse(localStorage.getItem(PROFILE_KEY) ?? '{}'); if (nameSchema.safeParse(p.name).success && COLORS.includes(p.color)) return { name: p.name, color: p.color }; } catch { /* Private browsing is supported. */ }
  return { name: 'Pilgrim', color: COLORS[0] };
}
function Star({ small = false }: { small?: boolean }) { return <img alt="" aria-hidden="true" className={`brand-star ${small ? 'small' : ''}`} src="/brand/logo.jpg" width={small ? 24 : 48} height={small ? 24 : 48} />; }
function Modal({ title, children, close, eyebrow, className }: { title: string; children: ReactNode; close: () => void; eyebrow: string; className?:string }) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { const el = dialog.current!; el.showModal(); return () => el.close(); }, []);
  return <dialog ref={dialog} className={className} aria-label={title} onCancel={e => { e.preventDefault(); close(); }} onClick={e => { if (e.target === e.currentTarget) close(); }}>
    <div className="modal-head"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div><button className="icon-button" aria-label="Close dialog" onClick={close}><X size={20} /></button></div><FeatureBoundary label={title} close={close}>{children}</FeatureBoundary>
  </dialog>;
}
function ProfileEditor({ profile, save, hosted=false, disabled=false }: { profile: Profile; save: (p: Profile) => Promise<void>; hosted?:boolean;disabled?:boolean }) {
  const [name, setName] = useState(profile.name); const [color, setColor] = useState(profile.color); const [error, setError] = useState('');
  return <form onSubmit={e => { e.preventDefault();if(disabled)return; const parsed = nameSchema.safeParse(name); if (!parsed.success) { setError('Use 1–24 characters, without angle brackets or invisible control characters.'); return; } void save({ name: parsed.data, color }); }}>
    <InfoHint label="Appearance details"><p>{hosted?'Your name and robe color are saved with this wallet’s hosted profile. Names are not unique or verified religious identities.':'A name for this journey. Guest profiles are saved only in this browser; names are not verified identities.'}</p><p>{hosted?'Sign in with the same wallet on this service to restore your saved profile. This is hosted storage, not a permanent onchain record.':'Appearance is saved on this device. Signing in opens a separate wallet profile; guest settings are not overwritten.'}</p></InfoHint>
    <fieldset className="profile-fields" disabled={disabled}>
    <label className="field-label" htmlFor="pilgrim-name">Your name</label><input id="pilgrim-name" value={name} onChange={e => setName(e.target.value)} maxLength={24} autoComplete="nickname" />
    <label className="field-label">Robe color</label><div className="swatches">{COLORS.map(c => <button type="button" key={c} className={`swatch ${color === c ? 'selected' : ''}`} style={{ background: c }} aria-label={`Choose robe ${c}`} aria-pressed={color === c} onClick={() => setColor(c)}>{color === c && <Check size={18} />}</button>)}</div>
    {error && <p role="alert" className="error">{error}</p>}<button className="primary full" type="submit">Save my appearance <ArrowRight size={16} /></button>
    </fieldset>
  </form>;
}
export default function App(){return isShowcase(projectChainSettings)?<ShowcaseApp/>:<AlphaApp/>;}
function AlphaApp() {
  const touchLayout=useTouchLayout(),movementInput=useMemo(createMovementInput,[]);
  const [textFocused,setTextFocused]=useState(false);
  const responseNarration=useResponseNarration();
  const ritualLight=useRitualLight();
  const ritualDelivery=useRitualDelivery();
  const [lampActivity,setLampActivity]=useState<ActivityInput|null>(null);
  const [pageVisible,setPageVisible]=useState(!document.hidden),[presentedWorld,setPresentedWorld]=useState('');
  useEffect(()=>{const change=()=>setPageVisible(!document.hidden);document.addEventListener('visibilitychange',change);return()=>document.removeEventListener('visibilitychange',change);},[]);
  const modalSpeaking=useRef(false);
  const onModalSpeaking=useCallback((playing:boolean)=>{
    modalSpeaking.current=playing;
    // A newly requested Builder voice/microphone takes precedence; never overlap voices.
    if(playing)responseNarration.narrator.stop();
    audio.current?.setDucked(playing||responseNarration.narrator.getSnapshot().playing);
  },[responseNarration.narrator]);
  const giftTransactions=useGiftTransactions();
  const prayerTransactions=usePrayerTransactions();
  const holderTransactions=useHolderFaithTransactions();
  const tokenTransactions=useNativeTokenTransactions();
  const transactionPending=giftTransactions.pending||prayerTransactions.pending||holderTransactions.pending||tokenTransactions.pending;
  const waitPhase=transactionWaitPhase([...prayerTransactions.entries,...holderTransactions.entries,...tokenTransactions.entries])??(giftTransactions.pending?'wallet':null);
  const identity=useWalletIdentity();
  const session=identity.session;
  const accountProfile=useAccountProfile(identity.session);
  const [guestRecipient,setGuestRecipient]=useState(readGuestRecipient);
  const [running,setRunning]=useState(false);
  const [toolbarCollapsed,setToolbarCollapsed]=useState(touchLayout);
  useEffect(()=>{
    // Leave the small screen clear for the just-confirmed avatar cue.
    if(touchLayout&&ritualLight.cue&&ritualLight.cue.state!=='local-preview')setToolbarCollapsed(true);
  },[touchLayout,ritualLight.cue?.id]);
  const [faithKind,setFaithKind]=useState<RecordKind>('prayer');
  const [entered,setEntered]=useState(Boolean(initialWalletReturn||initialVisit));
  useEffect(()=>{
    if(!initialWalletReturn)return;
    // One-use presentation flag; wallet/address hints are not authentication.
    const url=new URL(location.href);url.searchParams.delete('walletReturn');
    history.replaceState(history.state,'',url);
  },[]);
  const [quality,setQuality]=useState<QualityPreference>(()=>{
    try{return localStorage.getItem('ek:render-quality:v1')==='performance'?'performance':'auto';}catch{return 'auto';}
  });
  useEffect(()=>{try{localStorage.setItem('ek:render-quality:v1',quality);}catch{/* Session choice still works. */}},[quality]);
  const [stopWalkingSignal,setStopWalkingSignal]=useState(0);
  const [entrySound,setEntrySound]=useState(true);
  const [soundVolume,setSoundVolume]=useState(.38);
  const [showPlayerNames,setShowPlayerNames]=useState(()=>{
    try{return localStorage.getItem('ek:show-player-names:v1')!=='false';}catch{return true;}
  });
  useEffect(()=>{try{localStorage.setItem('ek:show-player-names:v1',String(showPlayerNames));}catch{/* Session preference still works. */}},[showPlayerNames]);
  const [panel,setPanel]=useState<'chat'|'board'|null>(null);
  const [recentChatExpanded,setRecentChatExpanded]=useState(()=>{
    try{return readRecentChatPreference(localStorage);}catch{return true;}
  });
  function toggleRecentChat(){
    const next=!recentChatExpanded;setRecentChatExpanded(next);
    try{saveRecentChatPreference(localStorage,next);}catch{/* Storage access may be disabled. */}
  }
  const [transitioning,setTransitioning]=useState(false);
  const transitionTimer=useRef<ReturnType<typeof setTimeout>|undefined>(undefined);
  const [scene, setScene] = useState<Scene>(()=>{const requested=initialWalletReturn?.scene??initialVisit?.scene??new URLSearchParams(location.search).get('scene');return isScene(requested)&&(!legacyView||!isScenic(requested))?requested:'plaza';}); const [channel, setChannel] = useState(()=>initialWalletReturn?.channel??initialVisit?.channel??worldRealm(new URLSearchParams(location.search).get('realm'))); const [guestProfile, setGuestProfile] = useState(readProfile);
  useEffect(()=>{if(entered)saveBrowserWorldVisit({scene,channel,legacy:legacyView});},[entered,scene,channel]);
  const profile=identity.session?(accountProfile.profile?.appearance??DEFAULT_APPEARANCE):guestProfile;
  const sceneInfo=SCENE_INFO[scene];
  const [modal, setModalState] = useState<'profile' | 'guide' | 'faith' | 'donation' | 'vision' | 'lampstand' | 'street' | 'social' | 'report' | 'moderation' | 'blessing' | 'gift' | 'gift-transactions' | 'prayer-transactions' | 'faith-transactions' | 'token-transactions' | null>(initialWalletReturn?'profile':null); const [selection, setSelected] = useState<Player | null>(null);
  const [giftSelection,setGiftSelection]=useState<GiftPreviewSelection|null>(null);
  const [reportTarget,setReportTarget]=useState<ChatMessage|null>(null);
  const [friendsOpen,setFriendsOpen]=useState(false);
  const [inspectedStreet,setInspectedStreet]=useState<StreetFeature|null>(null);
  function inspectStreet(id:string){
    const feature=streetFeature(id);if(scene!=='market'||!feature)return;
    setInspectedStreet(feature);setStopWalkingSignal(v=>v+1);setModalState('street');
  }
  const guidePlayer=useRef<GuideContentHandle>(null);
  function setModal(next:typeof modal) {
    if(next==='faith')setFaithKind('prayer');
    if(next==='guide') {
      // All Builder entry points share the same user-initiated playback path.
      flushSync(()=>setModalState(next));
      guidePlayer.current?.startFirstAnswer();
    } else setModalState(next);
  }
  function openRitual(kind:SanctuaryAction){
    if(kind==='donation'){setModalState('donation');return;}
    setFaithKind(kind);setModalState('faith');
  }
  const [message, setMessage] = useState(''); const [hidden, setHidden] = useState<Set<string>>(new Set()); const [boardTab, setBoardTab] = useState('announcements');
  const openPublicScreen=()=>{setBoardTab('records');setPanel('board');};
  const [sound, setSound] = useState(false),[responsesEnabled,setResponsesEnabled]=useState(true); const audio = useRef<Ambient | null>(null); const soundBusy=useRef(false); const [audioError, setAudioError] = useState('');
  useEffect(()=>{audio.current?.setDucked(modalSpeaking.current||responseNarration.state.playing);},[responseNarration.state.playing]);
  useEffect(()=>{modalSpeaking.current=false;audio.current?.setDucked(responseNarration.narrator.getSnapshot().playing);},[modal,responseNarration.narrator]);
  const world = useWorld(scene, channel, profile, entered,identity.session); const log = useRef<HTMLDivElement>(null); const atBottom = useRef(true); const [unread, setUnread] = useState(false);
  const community=useCommunity(session,entered);
  useEffect(()=>{if(community.connected)community.send({v:1,type:'community-watch'});},[community.connected,profile.name,profile.color,community.send]);
  const socialChat=useSocialChat(session,entered,scene,channel,community);
  useEffect(()=>{setMessage('');setSelected(null);setFriendsOpen(false);},[session?.accountId,session?.expiresAt]);
  const peerFor=(person:Player):SocialPeer|null=>person.identity?.kind==='wallet'&&person.id!==world.self?{personId:person.identity.personId,name:person.name,family:person.identity.family}:null;
  useEffect(()=>{const peer=socialChat.target;if(!peer)return;const live=world.players.find(p=>p.identity?.kind==='wallet'&&p.identity.personId===peer.personId);if(live&&live.name!==peer.name)socialChat.choose({...peer,name:live.name});},[world.players,socialChat.target?.personId,socialChat.target?.name]);
  function whisper(peer:SocialPeer){if(!session){setModal('profile');return;}socialChat.choose(peer);setSelected(null);setFriendsOpen(false);requestAnimationFrame(()=>document.getElementById('quick-chat-message')?.focus());}
  function openWalletProfile(){setModal('profile');requestAnimationFrame(()=>document.querySelector('.wallet-identity')?.scrollIntoView({block:'start'}));}
  const canWhisperMessage=(m:ChatMessage)=>world.players.some(p=>p.id===m.sender&&Boolean(peerFor(p)));
  function whisperMessage(m:ChatMessage){const person=world.players.find(p=>p.id===m.sender);const peer=person&&peerFor(person);if(peer)whisper(peer);}
  useEffect(()=>{const ack=socialChat.ack;if(ack&&ack.peerId===socialChat.target?.personId)setMessage(old=>old.trim()===ack.text?'':old);},[socialChat.ack]);
  const voice=usePartyVoice(community,session?`${session.accountId}:${session.expiresAt}`:'guest');
  // Never let live voice carry a private confession/prayer spoken for transcription.
  useEffect(()=>{if(modal==='faith'&&voice.state.party)voice.session.leave('Private faith composer opened. Live voice and microphone stopped.');},[modal,voice.state.party,voice.session]);
  const selected=world.players.find(p=>p.id===selection?.id)??null;
  const senderScope=session?`${session.accountId}:${session.expiresAt}`:'guest';
  function lampLit(){
    ritualDelivery.clear();ritualLight.light.showDailyLamp(senderScope);
    setLampActivity({id:`lamp:${crypto.randomUUID()}`,kind:'lamp',status:'lit'});
    // Do not discard unsaved appearance changes when lighting in the profile.
    setModalState(current=>current==='lampstand'?null:current);
  }
  const activityItems=useMemo<ActivityInput[]>(()=>[
    ...prayerTransactions.entries.map(e=>({id:`prayer:${e.id}`,kind:'prayer' as const,status:e.status})),
    ...holderTransactions.entries.map<ActivityInput>(e=>({id:`faith:${e.id}`,kind:e.kind??'faith',status:e.status})),
    ...tokenTransactions.entries.map<ActivityInput>(e=>({id:`token:${e.id}`,kind:e.proof?.kind??'token',status:e.status})),
    ...giftTransactions.entries.map(e=>({id:`gift:${e.id}`,kind:'gift' as const,status:e.status})),
    ...(lampActivity?[lampActivity]:[]),
  ],[prayerTransactions.entries,holderTransactions.entries,tokenTransactions.entries,giftTransactions.entries,lampActivity]);
  // Closing a dialog keeps encouragement; changing world/session cannot replay it.
  useEffect(()=>{ritualDelivery.clear();},[scene,channel,senderScope,quality,ritualDelivery]);
  const presentationKey=JSON.stringify([scene,quality]);
  const onPresentationReady=useCallback((ready:boolean)=>setPresentedWorld(ready?JSON.stringify([scene,quality]):''),[scene,quality]);
  useEffect(()=>{
    if(!entered||!pageVisible||modal||selection||transitioning||presentedWorld!==presentationKey||ritualLight.cue?.startedAt!==null)return;
    // Let the closed dialog leave the top layer and the world paint first.
    let second=0;const first=requestAnimationFrame(()=>{second=requestAnimationFrame(()=>{
      if(ritualLight.cue?.state==='daily-lamp')ritualLight.light.activate(ritualLight.cue.id);else ritualDelivery.reveal();
    });});
    return()=>{cancelAnimationFrame(first);cancelAnimationFrame(second);};
  },[entered,pageVisible,modal,selection,transitioning,presentedWorld,presentationKey,ritualLight.cue?.id,ritualLight.cue?.startedAt,ritualDelivery]);
  const giftPerson=currentGiftPerson(giftSelection,world.players,{scene,channel,senderScope,online:world.status==='online',self:world.self});
  const giftRecipients=useMemo(()=>giftSelection?hostedGiftRecipients({version:1,scene:giftSelection.scene,channel:giftSelection.channel,connectionId:giftSelection.connectionId}):unconfiguredGiftRecipients,[giftSelection]);
  const giftContext=JSON.stringify([modal,scene,channel,senderScope,world.self,world.status,giftPerson?.id,giftSelection]);
  const giftEpoch=useRef({context:giftContext,revision:0});
  if(giftEpoch.current.context!==giftContext)giftEpoch.current={context:giftContext,revision:giftEpoch.current.revision+1};
  const giftScope=`${giftContext}:${giftEpoch.current.revision}`;
  useEffect(()=>{
    if(giftSelection&&(!giftPerson||modal))setGiftSelection(null);
  },[modal,giftPerson,giftSelection]);
  const visibleMessages = world.messages.filter(m => !hidden.has(m.sender));
  const visibleBubbles = world.bubbles.filter(b => !hidden.has(b.sender) && world.players.some(p => p.id === b.sender));
  useEffect(() => { if (atBottom.current) log.current?.scrollTo({ top: log.current.scrollHeight }); else setUnread(true); }, [world.messages,socialChat.privateLines.at(-1)?.id]);
  useEffect(() => { atBottom.current = true; setUnread(false); }, [scene, channel]);
  useEffect(() => () => { void audio.current?.stop(); clearTimeout(transitionTimer.current); }, []);
  useEffect(()=>{if(panel==='chat'&&atBottom.current)log.current?.scrollTo({top:log.current.scrollHeight});},[panel]);
  async function saveProfile(p: Profile) {
    if(identity.session){if(await accountProfile.saveAppearance(p))setModal(null);return;}
    setGuestProfile(p);try{localStorage.setItem(PROFILE_KEY,JSON.stringify(p));}catch{/* In-memory profile still works. */}setModal(null);
  }
  async function toggleSound() {
    if(soundBusy.current)return;soundBusy.current=true;
    try {
      if(audio.current||responseNarration.narrator.getSnapshot().playing){ritualDelivery.setSoundEnabled(false);setResponsesEnabled(false);const old=audio.current;audio.current=null;setSound(false);await old?.stop();return;}
      ritualDelivery.setSoundEnabled(true);setResponsesEnabled(true);const atmosphere=new Ambient();audio.current=atmosphere;atmosphere.setVolume(soundVolume);atmosphere.setDucked(modalSpeaking.current||responseNarration.narrator.getSnapshot().playing);await atmosphere.start();setSound(true);setAudioError('');
    } catch { await audio.current?.stop();audio.current=null;setSound(false);setAudioError('Ambient sound is unavailable in this browser.'); }
    finally{soundBusy.current=false;}
  }
  function chat() {
    if(!entered||transitioning||modal||!message.trim())return;
    if(socialChat.target){void socialChat.change(socialChat.target,'message',message);return;}
    if(world.status!=='online'||world.mutedUntil)return;
    const packet=clientPacketSchema.safeParse({v:1,type:'chat',text:message});
    if(!packet.success){world.setError('Use 1–300 characters without unsupported control characters.');return;}
    if(world.send(packet.data)){setMessage('');world.setError('');}
    else world.setError('Your message was not sent. Please wait for the connection and try again.');
  }
  const chatFocus=()=>{movementInput.clear();setStopWalkingSignal(v=>v+1);};
  const changePosture=(posture:Posture)=>{movementInput.clear();setStopWalkingSignal(v=>v+1);world.send({v:1,type:'posture',posture});};
  const editable=(target:EventTarget|null)=>target instanceof HTMLElement&&Boolean(target.isContentEditable||target.closest('input:not([type="checkbox"]):not([type="radio"]):not([type="range"]),textarea,[role="textbox"]'));
  useEffect(()=>{
    if(modal||!pageVisible){movementInput.clear();return;}
    // Dialog removal/wallet return can blur without a relatedTarget on phones.
    // Re-read the actual focus after the top layer has closed; never steal chat focus.
    const frame=requestAnimationFrame(()=>setTextFocused(editable(document.activeElement)));
    return()=>cancelAnimationFrame(frame);
  },[modal,selected?.id,pageVisible,movementInput]);
  const openRecentChat=()=>{atBottom.current=true;setUnread(false);setPanel('chat');};
  function travel(destination?:Scene) {
    if(transitioning)return;
    const next=destination??(scene==='plaza'?'temple':'plaza');
    if(next===scene||legacyView&&isScenic(next))return;
    if(destination&&!portalsFor(scene).some(portal=>portal.to===next))return;
    setPanel(null);setSelected(null);setModal(null);setMessage('');setTransitioning(true);
    transitionTimer.current=setTimeout(()=>{setScene(next);transitionTimer.current=setTimeout(()=>setTransitioning(false),700);},350);
  }
  const online = world.status === 'online';
  const controlActive=entered&&!transitioning&&!modal&&online;
  const chatDisabled=transitioning||Boolean(modal)||(socialChat.target?socialChat.uncertain||!session:!online||world.mutedUntil>0);
  const chatLines=[...visibleMessages.map(m=>({id:m.id,time:m.time,text:m.text,name:m.name,mine:m.sender===world.self,peer:world.players.find(p=>p.id===m.sender)?peerFor(world.players.find(p=>p.id===m.sender)!):null,private:false})),...socialChat.privateLines.map(m=>({id:m.id,time:m.time,text:m.text,name:m.mine?'You':m.peer.name,mine:m.mine,peer:m.peer,private:true}))].sort((a,b)=>a.time-b.time).slice(-60);
  const showTouchControls=touchLayout&&!legacyView&&controlActive&&!panel&&!textFocused&&toolbarCollapsed;
  const anySound=sound||responseNarration.state.playing;
  const ambientSoundButton=<button className="sound-button" onClick={toggleSound} aria-label={anySound ? 'Mute ambient sound' : 'Enable ambient sound'} aria-pressed={anySound}>{anySound ? <Volume2 size={16} /> : <VolumeX size={16} />} <span>Peaceful sound {anySound ? 'on' : 'off'}</span></button>;
  const rendererProps:WorldRendererProps={scene,ritualLightCue:ritualLight.cue,onPresentationReady,movementInput,players:world.players,bubbles:visibleBubbles,stopWalkingSignal,showPlayerNames,onTogglePlayerNames:()=>setShowPlayerNames(v=>!v),self:world.self,active:controlActive,quality,running,onRitual:openRitual,onInspectStreet:inspectStreet,onStand:()=>{world.send({v:1,type:'posture',posture:'standing'});},move:p=>{world.send({v:1,type:'move',...p});},onGuide:()=>setModal('guide'),onTravel:travel,onPerson:setSelected};
  return <>
  {!entered&&<section className="entry-gate entry-3d" role="dialog" aria-modal="true" aria-labelledby="entry-title" inert={modal==='blessing'}><div className="entry-veil"/><div className="entry-content"><Star/><span className="eyebrow">ONE CREATOR · ONE ETERNAL WORLD</span><h1 id="entry-title">Leave the noise.<br/><em>Enter the light.</em></h1><div className="entry-rule"/><p>A place to be still.<br/>A world to walk together.</p>
    {!legacyView&&<div className="entry-render-options">
      <label><input type="checkbox" checked={quality==='performance'} onChange={e=>setQuality(e.target.checked?'performance':'auto')}/> Prefer lighter 3D graphics</label>
      <small>Phones use optimized 3D automatically.</small>
      <button type="button" disabled data-renderer-option="lite">{worldRenderers.lite.label} · Coming later</button>
      {requestedView==='lite'&&<small role="status">Simple mobile is not available yet. You can enter the 3D world below.</small>}
    </div>}
    <label className="entry-sound"><input type="checkbox" checked={entrySound} onChange={e=>setEntrySound(e.target.checked)}/> Peaceful sound on entry</label><button autoFocus className="enter-world" onClick={()=>{setEntered(true);if(entrySound)void toggleSound();}}>Enter the world <ArrowRight size={18}/></button><span className="entry-note">Guest entry · no wallet required · headphones recommended</span><button className="entry-blessing" onClick={()=>setModal('blessing')} aria-label="Open God's Blessing avatar tool"><img src="/brand/logo.jpg" alt=""/><span>God's Blessing<small>Create your halo avatar · free</small></span></button>
    <a className="entry-whitepaper entry-official-x" href={projectLinks.whitepaper} target="_blank" rel="noopener noreferrer" aria-label="Read the English whitepaper (opens in a new tab)"><ScrollText size={17} aria-hidden="true"/><span>Whitepaper · Our founding vision</span><ArrowRight size={14} aria-hidden="true"/></a>
    <a className="entry-official-x" href={projectLinks.officialX} target="_blank" rel="noopener noreferrer" referrerPolicy="no-referrer" aria-label="Official X (Twitter): @ETERNALKINGD0M (opens in a new tab)"><span aria-hidden="true">𝕏</span><span>Official X · @ETERNALKINGD0M</span><ArrowRight size={14} aria-hidden="true"/></a>
    </div><span className="entry-version">ETERNAL KINGDOM / {legacyView?'2D ARCHIVE':'3D SANCTUARY PREVIEW'}</span></section>}
  <div className="app-shell immersive" data-panel={panel??'none'} data-scene={scene} data-touch-controls={showTouchControls} data-dock-collapsed={toolbarCollapsed} inert={!entered} onPointerDownCapture={e=>{if(e.target instanceof HTMLCanvasElement){setSelected(null);setFriendsOpen(false);setGiftSelection(null);}}}
    onFocusCapture={e=>{const typing=editable(e.target);setTextFocused(typing);if(typing)movementInput.clear();}} onBlurCapture={e=>setTextFocused(editable(e.relatedTarget))}>
    <header className="site-header"><a className="brand" href="#world" aria-label="Eternal Kingdom home"><Star /><div>ETERNAL KINGDOM<small>ONE CREATOR · ONE ETERNAL WORLD</small></div></a>
      <nav aria-label="Main navigation"><a className="active" href="#world">The world</a><button onClick={() => setModal('lampstand')}>My lampstand</button><button onClick={()=>setModal('blessing')}>God's Blessing</button><button onClick={() => setModal('vision')}>The vision <span>↗</span></button></nav>
      <button className="profile-button" onClick={() => setModal('profile')}><span className="profile-orb" style={{ background: profile.color }} /><span>{profile.name}<small>{identity.session?'Verified wallet':'Guest'}</small></span><ChevronDown size={14} /></button>
    </header>
    <main id="world">
      <section className="page-intro"><div><div className="eyebrow"><span className="little-line" /> FAITH · PEACE · ETERNAL HOPE</div><h1>A world born<br />from a <em>calling.</em></h1><p>Come as you are. Walk in the light.<br />The first chapter of an eternal vision.</p><button className="hero-story" onClick={() => setModal('guide')}>Discover the founding dream <ArrowRight size={15} /></button></div><div className="alpha-label"><span /> THE FIRST WORLD <b>ALPHA</b></div></section>
      <div className="world-section-heading"><div><span className="eyebrow">YOUR JOURNEY BEGINS HERE</span><h2>{sceneInfo.name}</h2></div><span><span className="live-dot" data-online={online} /> {online ? 'A shared world. A real presence.' : 'Connecting you to the world…'}</span></div>
      <div className="world-layout">
        <section className="world-card" aria-label="Interactive world">
          <div className="scene-top"><div className="location-pill"><span className="live-dot" data-online={online} /><span>{sceneInfo.name}</span></div><div className="scene-top-controls">{touchLayout&&<div className="sound-controls sound-controls--top">{ambientSoundButton}</div>}<div className="room-pill"><Users size={14} /><span data-testid="online-count">{world.players.length}</span><span className="room-divider" /><label className="sr-only" htmlFor="channel">World channel</label><select id="channel" value={channel} onChange={e => setChannel(Number(e.target.value))}>{[1,2,3].map(n => <option key={n} value={n}>Realm {String(n).padStart(2,'0')}</option>)}</select></div></div></div>
      <FeatureBoundary label="World view"><Suspense fallback={<div className="art-loading" role="status">Preparing the world…</div>}><WorldRenderer key={scene} {...rendererProps}/></Suspense></FeatureBoundary>
          <WorldRitualResponse visible={entered&&!modal&&!selected&&panel!=='board'} openPublicScreen={openPublicScreen}/>
          {entered&&!modal&&!selected&&waitPhase&&<div className="transaction-wait-hud"><TransactionWaitStatus phase={waitPhase}/></div>}
          <button type="button" className="public-screen-entry" aria-label="Open public prayer screen" aria-expanded={panel==='board'&&boardTab==='records'} aria-controls="public-board-panel" onClick={openPublicScreen}><ScrollText size={16}/><span>Public screen</span></button>
          <div className="sanctuary-caption" key={scene}><span>{sceneInfo.caption}</span><h1>{scene==='temple'?'Be still. You are here.':sceneInfo.name}</h1><p>{sceneInfo.subtitle}</p></div>
          <div className={`scene-transition ${transitioning?'visible':''}`} aria-hidden="true"/>
          <div className="scene-bottom"><span><span className="keycap">W A S D</span> Walk · drag to look · tap a path · 1–4 gestures</span><div className="sound-controls"><ResponseNarrationTail visible={!modal&&!selected}/>{!touchLayout&&ambientSoundButton}{sound&&!touchLayout&&<input aria-label="Ambient sound volume" type="range" min="0" max=".8" step=".02" value={soundVolume} onChange={e=>{const value=Number(e.target.value);setSoundVolume(value);audio.current?.setVolume(value);}}/>}</div></div>
<WorldToolbar collapsed={toolbarCollapsed} onCollapse={setToolbarCollapsed}><button className="dock-action" aria-label="Open friends and private chat" aria-expanded={friendsOpen} onClick={()=>{setSelected(null);setGiftSelection(null);setFriendsOpen(v=>!v);}}><Users size={18}/><span>Friends{socialChat.contacts.some(c=>c.friend==='incoming')?' · new':''}</span></button><RunControl running={running} enabled={entered&&online&&!transitioning&&!modal} toggle={()=>setRunning(v=>!v)}/><PostureControls visible={!toolbarCollapsed} shortcutsEnabled={entered&&!modal} posture={world.players.find(p=>p.id===world.self)?.posture??"standing"} disabled={!online||transitioning} onChange={changePosture}/><div className="emotes"><button disabled={!online} onClick={() => world.send({ v: 1, type: 'emote', emote: 'heart' })} aria-label="Send heart emote"><Heart size={18} /></button><button disabled={!online} onClick={() => world.send({ v: 1, type: 'emote', emote: 'peace' })} aria-label="Send peace emote"><Leaf size={18} /></button></div><div className="dock-divider"/><button className="dock-action" aria-label="Toggle public chat" aria-expanded={panel==='chat'} aria-controls="public-chat-panel" onClick={()=>setPanel(p=>p==='chat'?null:'chat')}><MessageCircle size={18}/><span>Conversations</span></button><button className="dock-action" aria-label="Toggle public board" aria-expanded={panel==='board'} aria-controls="public-board-panel" onClick={()=>setPanel(p=>p==='board'?null:'board')}><ScrollText size={18}/><span>The public board</span></button><div className="dock-divider"/><button className="dock-prayer" onClick={()=>{setStopWalkingSignal(v=>v+1);setModal('faith');}}>A moment of prayer</button><button className="text-button travel-button" disabled={transitioning} onClick={() => travel()}><DoorOpen size={16}/>{scene==='plaza'?'Enter the Sanctuary':'Return to the gardens'}<ArrowRight size={15}/></button></WorldToolbar>
        </section>
        <aside className="side-column"><section className="invitation-card"><div className="eyebrow">A MOMENT FOR YOUR SOUL</div><div className="temple-symbol" aria-hidden="true"><div /><Star /><div /></div><h2>{scene === 'plaza' ? 'The door is open.' : 'Be still. You are here.'}</h2><p>A place for prayer, reflection,<br />and the words within your heart.</p><button className="primary full" onClick={() => scene === 'plaza' ? travel() : setModal('faith')}>{scene === 'plaza' ? 'Enter the Sanctuary' : 'A moment of prayer'}<ArrowRight size={17} /></button><span className="invitation-foot"><span /> Everyone is welcome</span></section>
          <section className="board-card" id="public-board-panel" aria-label="Public board panel"><div className="section-heading"><h2>The public board</h2><button className="icon-button" aria-label="Close public board" onClick={()=>setPanel(null)}><X size={16}/></button></div><div className="board-tabs"><button className={boardTab === 'announcements' ? 'chosen' : ''} onClick={() => setBoardTab('announcements')}>Announcements</button><button className={boardTab === 'records' ? 'chosen' : ''} onClick={() => setBoardTab('records')}>Sacred words</button></div>
            <div className="board-scroll" tabIndex={0} aria-label="Public board entries">{boardTab === 'announcements' ? <><article className="board-entry"><span className="entry-type">✦ &nbsp; FOUNDER’S NOTE · PINNED</span><h3>Every kingdom begins<br />with a calling.</h3><p>“I believe God gave me a dream: to create a truly eternal heavenly world, and to spread His name.”</p><button className="text-button" onClick={() => setModal('guide')}>Hear the first story <ArrowRight size={14} /></button></article><AnnouncementList active={entered&&panel==='board'}/></> : <Suspense fallback={<p role="status">Preparing record reader…</p>}><SacredRecordList active={entered&&panel==='board'}/></Suspense>}</div>
          </section>
        </aside>
        <section className="chat-card" id="public-chat-panel" aria-label="Public chat panel"><div className="chat-heading"><div><MessageCircle size={18} /><h2>Words in the {scene === 'temple' ? 'temple' : 'world'}</h2></div><button className="icon-button" aria-label="Close public chat" onClick={()=>setPanel(null)}><X size={16}/></button></div><span className="connection-status" role="status">{online?'Connected · public room':world.status==='connecting'?'Connecting…':'Reconnecting…'}</span>
          <div className="chat-log" ref={log} role="log" aria-label="Public chat" aria-live="polite" onScroll={() => { const el = log.current!; atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 36; if (atBottom.current) setUnread(false); }}>
            {chatLines.length === 0 ? <div className="chat-empty"><Leaf size={18} /><p>A kind word can be the beginning of a connection.<span>Be the first to greet this room.</span></p></div> : chatLines.map(m => <div className={`chat-message${m.private?' private-chat-line':''}`} key={m.id}><span className="chat-avatar"><bdi>{firstGrapheme(m.name)}</bdi></span><div><button type="button" className="chat-sender-button" disabled={!m.peer} onClick={()=>m.peer&&whisper(m.peer)} aria-label={m.peer?`Whisper to ${m.peer.name}`:undefined}><bdi>{m.name}</bdi>{m.private&&<small> · {m.mine?`To ${m.peer?.name}`:'Whisper'}</small>}</button><span className="chat-time">{new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span><p dir="auto">{m.text}</p></div></div>)}
          </div>{unread && <button className="new-messages" onClick={() => { log.current?.scrollTo({ top: log.current.scrollHeight }); atBottom.current = true; setUnread(false); }}>New messages <ArrowDown size={13} /></button>}
          <PublicChatInput value={message} onChange={setMessage} onSend={chat} onFocus={chatFocus} online={online} disabled={chatDisabled} sendBusy={Boolean(socialChat.target&&socialChat.busy)} recipient={socialChat.target?.name} onPublic={()=>{socialChat.choose(null);setMessage('');}}/>
          <div className="chat-foot"><InfoHint label="Chat details"><p>Public messages are visible to this room, up to 40 messages for 15 minutes. Whispers are hosted private messages accessible to the two signed-in accounts, not end-to-end encrypted; up to 100 messages per conversation for 24 hours. Keep sensitive faith text in the separate composer. Private updates use a shared presence connection, with a read-only fallback while visible.</p></InfoHint></div>
          {world.error && <p className="error connection-error" role="alert">{world.error}</p>}
          {world.mutedUntil>0&&<p className="fine-print" role="status">Public text is muted in this room until {new Date(world.mutedUntil).toLocaleTimeString()}. You can still explore.</p>}
          <button className="chat-moderation" onClick={()=>setModal('moderation')}>Room safety & moderator tools</button>
        </section>
        <section className="guide-card"><div className="guide-mini" aria-hidden="true">✦</div><div><div className="eyebrow">A STORY WORTH HEARING</div><h3>Meet the Builder.</h3><p>The dream. The calling. The first stone.</p></div><button aria-label="Listen to the Builder" onClick={() => setModal('guide')}><ArrowRight size={20} /></button></section>
      </div>
      <PublicChatInput quick value={message} onChange={setMessage} onSend={chat} onFocus={chatFocus} online={online} disabled={chatDisabled} sendBusy={Boolean(socialChat.target&&socialChat.busy)} recipient={socialChat.target?.name} onPublic={()=>{socialChat.choose(null);setMessage('');}}/>
      {showTouchControls&&<MobileWorldControls input={movementInput} resetKey={`${scene}:${channel}:${world.self}:${stopWalkingSignal}`} posture={world.players.find(p=>p.id===world.self)?.posture??'standing'} onPosture={changePosture}/>}
      {entered&&online&&!transitioning&&!modal&&!panel&&!world.error&&<RecentPublicChat compact={touchLayout} messages={visibleMessages} whispers={socialChat.privateLines} onPrivate={whisper} onWhisper={whisperMessage} canWhisper={canWhisperMessage} expanded={recentChatExpanded} onToggle={toggleRecentChat} onOpen={openRecentChat} onReport={m=>{setReportTarget(m);setModal('report');}} onHide={sender=>setHidden(old=>new Set([...old,sender]))}/>}
      {entered&&!modal&&socialChat.error&&<p className="quick-private-status" role="alert">{socialChat.error}<button disabled={socialChat.busy} onClick={()=>void socialChat.refresh()}>{socialChat.feedbackKind==='friend'?'Refresh friends':'Refresh private chat'}</button></p>}
      {entered&&!modal&&friendsOpen&&<FriendsPanel chat={socialChat} players={world.players} verified={Boolean(session)} online={community.connected?community.online:undefined} onVoice={peer=>{voice.session.invite(peer.personId);setFriendsOpen(false);}} canVoice={community.connected&&voice.session.available()&&(voice.state.party?.members.length??0)+voice.state.outgoing.length<4} onClose={()=>setFriendsOpen(false)} onWhisper={whisper} openProfile={()=>{setFriendsOpen(false);setModal('profile');}}/>}
      <FriendRequestsHud chat={socialChat} active={entered&&!modal&&!friendsOpen&&!selected&&!giftSelection} onOpenFriends={()=>setFriendsOpen(true)}/>
      {entered&&panel!=='chat'&&(world.error||world.mutedUntil>0)&&<p className="quick-chat-status" role="status">{world.mutedUntil>0?'Public text is muted in this room. You can still explore.':world.error}</p>}
      <footer><span><Star small /> Built from a calling. Open to every soul.</span><span>Hosted alpha · not yet decentralized <span className="footer-dot">·</span> <button onClick={() => setModal('vision')}>About this world ↗</button></span></footer>
      {audioError && <p role="status" className="fine-print audio-error">{audioError}</p>}
      <PartyVoiceHud voice={voice.session} state={voice.state}/>
      <ActivityCenter items={activityItems} histories={[
        {id:'gift',label:'Gift transactions',count:giftTransactions.entries.length,open:()=>setModal('gift-transactions')},
        {id:'prayer',label:'Prayer transactions',count:prayerTransactions.entries.length,open:()=>setModal('prayer-transactions')},
        {id:'faith',label:'Faith transactions',count:holderTransactions.entries.length,open:()=>setModal('faith-transactions')},
        {id:'token',label:'Token transactions',count:tokenTransactions.entries.length,open:()=>setModal('token-transactions')},
      ]}/>
    </main>
    {modal === 'street' && inspectedStreet && <Modal title={inspectedStreet.title} eyebrow={inspectedStreet.kind==='door'?'CLOSED DOOR · EXPLORATION':'MARKET DISPLAY · EXPLORATION'} close={()=>setModal(null)}>
      <div className={`street-preview-art ${inspectedStreet.illustration}`} aria-hidden="true"><span/><span/><span/></div>
      <p className="muted">{inspectedStreet.description}</p>
      <div className="notice"><Shield size={18}/><p>{inspectedStreet.kind==='door'?'This residence is not open. Ownership, reservations and property sales are not enabled.':'This stall is not open for trade. No items can be bought, sold or reserved.'} No wallet connection or payment is requested.</p></div>
      <p className="fine-print">A place to explore today; future features are not a promise of availability.</p>
      <button className="primary full" onClick={()=>setModal(null)}>Continue exploring <ArrowRight size={16}/></button>
    </Modal>}
    {modal==='report'&&reportTarget&&<Modal title="Report a public message" eyebrow="ROOM SAFETY · MANUAL REVIEW" close={()=>setModal(null)}><ReportMessage key={`${scene}:${channel}:${world.self}:${reportTarget.id}`} message={reportTarget} online={online} reviewConfigured={world.reviewConfigured} receipt={world.reportReceipt} send={world.send}/></Modal>}
    {modal==='moderation'&&<Modal title="Room safety" eyebrow="WALLET-AUTHORIZED MODERATION" close={()=>setModal(null)}><ModerationPanel key={`${session?.accountId??'guest'}:${session?.expiresAt??0}`} session={session} initialScene={scene} initialChannel={channel} openProfile={()=>setModal('profile')}/></Modal>}
    {!modal&&giftPerson&&giftSelection&&<Suspense fallback={<section className="private-gift-popover" role="status">Preparing gift…</section>}><GiftPopover key={giftTargetKey(giftSelection.target)} target={giftSelection.target} name={giftPerson.name} openSettings={()=>{setGiftSelection(null);setModal('profile');}} close={()=>setGiftSelection(null)} recipients={giftRecipients} wallets={identity.wallets} preferred={identity.connection?.wallet} account={identity.connection??session??undefined} prepareNetwork={identity.prepareNetwork} scope={giftScope} start={tokenTransactions.start} pending={transactionPending} waitPhase={waitPhase} openHistory={()=>{setGiftSelection(null);setModal('token-transactions');}}/></Suspense>}
    {modal==='gift-transactions'&&<Modal title="Gift transactions" eyebrow="THIS TAB ONLY · TESTNET" close={()=>setModal(null)}><Suspense fallback={<p role="status">Preparing transaction history…</p>}><GiftTransactionHistory entries={giftTransactions.entries} check={giftTransactions.check}/></Suspense></Modal>}
    {modal === 'profile' && <Modal title="Your presence here." eyebrow="PILGRIM PROFILE" close={() => setModal(null)}>
      <WalletIdentityPanel identity={identity} scene={scene} channel={channel} legacy={legacyView} mobile={touchLayout} returned={initialWalletReturn}/>
      <button type="button" className="text-button" onClick={()=>setModal('lampstand')}>Open my lampstand</button>
      <Suspense fallback={<p role="status">Loading your lamps…</p>}><DailyLampPanel key={`lamps:${session?.accountId??'guest'}:${session?.expiresAt??0}`} session={session} openProfile={openWalletProfile} onLit={lampLit}/></Suspense>
      {showGodTokenPanel&&<Suspense fallback={<p role="status">Preparing configured token…</p>}><GodTokenPanel compact key={session?.accountId??'guest'} account={session?.family==='evm'?session.address:undefined}/></Suspense>}
      {identity.session&&accountProfile.busy&&!accountProfile.profile&&<p role="status">Loading your saved profile…</p>}
      {identity.session&&<div>{accountProfile.error&&<p role="alert" className="error">{accountProfile.error}</p>}<button className="secondary-button full" disabled={accountProfile.busy} onClick={()=>void accountProfile.refresh()}>Reload saved profile</button><InfoHint label="Profile reload details"><p>Reloading replaces unsaved form edits with the server’s saved version.</p></InfoHint></div>}
      {(!identity.session||accountProfile.profile)&&<div key={`${identity.session?.accountId??'guest'}:${identity.session?accountProfile.editorVersion:0}`}>
        <ProfileEditor key={JSON.stringify(profile)} profile={profile} save={saveProfile} hosted={Boolean(identity.session)} disabled={Boolean(identity.session)&&(accountProfile.busy||accountProfile.needsReload)}/>
        <ReceivingAddressEditor saved={identity.session?accountProfile.profile?.evmRecipient?.address??null:guestRecipient.address} defaultAddress={identity.session?.family==='evm'?identity.session.address:undefined} busy={Boolean(identity.session)&&(accountProfile.busy||accountProfile.needsReload)} hosted={Boolean(identity.session)} reload={()=>setGuestRecipient(readGuestRecipient())} save={async address=>{
          if(identity.session)return accountProfile.saveRecipient(address);
          setGuestRecipient(saveGuestRecipient(address,guestRecipient.revision));return true;
        }}/>
      </div>}
      {identity.session&&accountProfile.profile&&<ProfileBackup key={`${identity.session.accountId}:${identity.session.expiresAt}`} profile={accountProfile.profile} disabled={accountProfile.busy||accountProfile.needsReload||identity.session.expiresAt<=Date.now()} save={accountProfile.saveAppearance}/>}
      {identity.session&&accountProfile.profile&&<GiftPublication key={`sharing:${identity.session.accountId}:${identity.session.expiresAt}`} profile={accountProfile.profile} disabled={accountProfile.busy||accountProfile.needsReload||identity.session.expiresAt<=Date.now()} save={accountProfile.saveGiftPublication}/>}
    </Modal>}
    {modal === 'guide' && <Modal title="The first story." eyebrow="THE BUILDER’S VOICE" close={() => setModal(null)}><GuideContent ref={guidePlayer} onSpeakingChange={onModalSpeaking}/></Modal>}
    {modal==='token-transactions'&&<Modal title="Token transactions" eyebrow="GIFTS & DONATIONS" className="donation-dialog" close={()=>setModal(null)}><div className="donation-modal-body"><Suspense fallback={<p>Loading token transactions…</p>}><NativeTokenHistory entries={tokenTransactions.entries} check={tokenTransactions.check} soundEnabled={responsesEnabled} onSpeakingChange={onModalSpeaking}/></Suspense></div></Modal>}
    {modal==='faith-transactions'&&<Modal title="Faith transactions" eyebrow="VERIFIED RECEIPTS" close={()=>setModal(null)}><Suspense fallback={<p>Loading faith transactions…</p>}><HolderFaithTransactionHistory entries={holderTransactions.entries} check={holderTransactions.check} soundEnabled={responsesEnabled} onSpeakingChange={onModalSpeaking}/></Suspense></Modal>}
    {modal==='prayer-transactions'&&<Modal title="Prayer transactions" eyebrow="VERIFIED RECEIPTS" close={()=>setModal(null)}><Suspense fallback={<p>Loading prayer transactions…</p>}><PrayerTransactionHistory entries={prayerTransactions.entries} check={prayerTransactions.check} soundEnabled={responsesEnabled} onSpeakingChange={onModalSpeaking}/></Suspense></Modal>}
    {modal === 'faith' && <Modal title="Words from the heart." eyebrow="PRIVATE COMPOSER" close={() => setModal(null)}><FaithComposer key={`${faithKind}:${senderScope}`} name={profile.name} initialKind={faithKind} soundEnabled={responsesEnabled} onSpeakingChange={onModalSpeaking} onComplete={()=>{setPanel(null);setModalState(current=>current==='faith'?null:current);}} wallets={identity.wallets} preferred={identity.connection?.wallet} account={identity.connection??session??undefined} prepareNetwork={identity.prepareNetwork} scope={JSON.stringify([senderScope,scene,channel])} startPrayer={prayerTransactions.start} prayerPending={transactionPending} waitPhase={waitPhase} openPrayerHistory={()=>setModal('prayer-transactions')} startHolderFaith={holderTransactions.start} openHolderHistory={()=>setModal('faith-transactions')}/></Modal>}
    {modal === 'donation' && <Modal title="Help this world grow." eyebrow="GIVING CHEST" className="donation-dialog" close={()=>setModal(null)}><div className="donation-modal-body"><Suspense fallback={<p role="status">Preparing donation options…</p>}><DonationPanel key={session?.accountId??'guest'} account={identity.connection??session??undefined} wallets={identity.wallets} preferred={identity.connection?.wallet} prepareNetwork={identity.prepareNetwork} scope={JSON.stringify([modal,senderScope,scene,channel])} start={tokenTransactions.start} pending={transactionPending} waitPhase={waitPhase} openHistory={()=>setModal('token-transactions')} soundEnabled={responsesEnabled} onSpeakingChange={onModalSpeaking} onComplete={()=>setModalState(current=>current==='donation'?null:current)}/></Suspense></div></Modal>}
    {modal === 'lampstand' && <Modal title="Your lamps." eyebrow="MY LAMPSTAND" close={() => setModal(null)}><LampstandPanel key={`lamps:${session?.accountId??'guest'}:${session?.expiresAt??0}`} session={session} openProfile={openWalletProfile} onLit={lampLit}/><button className="primary full" onClick={() => { setScene('temple'); setModal('faith'); }}>{prayerEnabled?'Write a prayer':'Visit the prayer preview'} <ArrowRight size={16} /></button></Modal>}
{modal === 'vision' && <Modal className="vision-dialog" title="A beginning, not a finish." eyebrow="THE VISION" close={() => setModal(null)}><div className="vision-modal-body"><blockquote className="testimony">“I believe God gave me a dream: to create a truly eternal heavenly world, and to spread His name.”</blockquote><p className="muted">Eternal Kingdom begins with a shared place to be present. The long-term intention is an independently rebuildable, decentralized world — not a promise of permanence from a single host.</p><div className="roadmap"><p><b>Now</b> Gardens, temple, guest presence, EVM and Solana wallet sign-in, verified room identity, saved wallet profiles, receiving-address settings, independent friends, direct private text chat, consented voice parties of up to four, account daily lamps, the shared public prayer screen, public chat, emotes, a story you choose to hear, and optional browser voice-to-text with separate consent.</p><p><b>Configured separately</b> Robinhood prayer and holder records, person gifts, project token donations, receipt checks and a donation leaderboard. Only enabled, independently verified integrations can request a wallet transaction.</p><p><b>Reserved</b> Additional EVM/SOL/BTC payment integrations, two-way trade, housing, role permissions, rewards and independent clients.</p></div><p className="fine-print">This prototype runs on Cloudflare-compatible rooms. Blockchain writes require deployed, configured contracts and independently controlled release switches; defaults enable no broadcasts. Mainnet operations use real assets. Optional browser voice transcription may use a browser-managed remote service and requires explicit consent; it is not voice chat. Ambient audio is a simple opt-in synthesized preview, not a finished sacred soundtrack.</p><Suspense fallback={<p>Preparing connection status…</p>}><ChainConnectionStatus/></Suspense></div></Modal>}
    {selected&&selected.id!==world.self&&!modal&&<PersonMenu person={selected} contact={socialChat.contacts.find(c=>selected.identity?.kind==='wallet'&&c.peer.personId===selected.identity.personId)} busy={socialChat.busy||socialChat.uncertain} error={socialChat.error} notice={socialChat.notice} onClose={()=>setSelected(null)} onWhisper={()=>{const peer=peerFor(selected);if(peer)whisper(peer);}} onFriend={()=>{const peer=peerFor(selected);if(!peer)return;if(!session){setSelected(null);setModal('profile');return;}const contact=socialChat.contacts.find(c=>c.peer.personId===peer.personId);void socialChat.change(peer,contact?.friend==='incoming'?'accept-friend':'invite-friend');}} canVoice={Boolean(session&&community.connected&&selected.identity?.kind==='wallet'&&(voice.state.party?.members.length??0)+voice.state.outgoing.length<4&&voice.session.available())} onVoice={()=>{const peer=peerFor(selected);if(peer)voice.session.invite(peer.personId);setSelected(null);}} onGift={()=>{setGiftSelection({target:giftTargetFor(selected),connectionId:selected.id,scene,channel,senderScope});setSelected(null);}}/>}
  </div>
  {modal==='blessing'&&<Modal title="God's Blessing" eyebrow="A LITTLE LIGHT TO CARRY" close={()=>setModal(null)}><Suspense fallback={<p role="status">Preparing the avatar tool…</p>}><BlessingAvatar/></Suspense></Modal>}
  </>;
}
