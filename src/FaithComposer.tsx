import { lazy, Suspense, useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import InfoHint from './InfoHint';
import FeatureBoundary from './FeatureBoundary';
import type { RecordKind } from '../shared/adapters';
import { analyzeFaithText, faithScreenPreview, faithVisibilityDefaults, requireFaithText, FAITH_TEXT_LIMITS, FAITH_ENCRYPTION_SIZES } from '../shared/faithReview';
import { encryptedPreview } from './crypto';
import RitualFeedback from './RitualFeedback';
import TransactionWaitStatus from './TransactionWaitStatus';
import type {TransactionWaitPhase} from './transactionLedger';
import FaithSpeechInput from './FaithSpeechInput';
import type { RitualFeedbackPort } from './ritualFeedbackState';
import './faith.css';
import {projectChainSettings} from './projectChainSettings';
import {chainBroadcast} from '../shared/chainConfiguration';
import type {WalletChoice} from './walletIdentity';
import type {WalletAccountIdentity} from '../shared/identity';
import type {PrepareWalletNetwork} from './walletNetwork';
import type {StartPrayerAttempt} from './usePrayerTransactions';
import type {PrayerSubmissionHandle} from './PrayerSubmission';
import type {StartHolderFaithAttempt} from './useHolderFaithTransactions';
import type {HolderFaithSubmissionHandle} from './HolderFaithSubmission';
const PrayerSubmission=lazy(()=>import('./PrayerSubmission'));
const HolderFaithSubmission=lazy(()=>import('./HolderFaithSubmission'));

export default function FaithComposer({name,soundEnabled,onSpeakingChange,onComplete,initialKind='prayer',wallets=[],preferred,account,prepareNetwork,scope='',startPrayer,prayerPending=false,waitPhase=null,openPrayerHistory=()=>{},startHolderFaith,openHolderHistory=()=>{}}:{name:string;soundEnabled:boolean;onSpeakingChange:(playing:boolean)=>void;onComplete?:()=>void;initialKind?:RecordKind;wallets?:WalletChoice[];preferred?:WalletChoice;account?:WalletAccountIdentity;prepareNetwork?:PrepareWalletNetwork;scope?:string;startPrayer?:StartPrayerAttempt;prayerPending?:boolean;waitPhase?:TransactionWaitPhase|null;openPrayerHistory?:()=>void;startHolderFaith?:StartHolderFaithAttempt;openHolderHistory?:()=>void}){
  const feedback=useRef<RitualFeedbackPort>(null);
  function confirmed(kind:RecordKind,id:string){if(!id.trim())return;feedback.current?.complete({kind,state:'confirmed',confirmationId:id});onComplete?.();}
  const defaults=faithVisibilityDefaults(initialKind);
  const [kind,setKind]=useState<RecordKind>(initialKind);
  const [privateText,setPrivateText]=useState(defaults.encrypted);
  const [anonymous,setAnonymous]=useState(defaults.anonymous);
  const [text,setText]=useState('');
  const [speechActive,setSpeechActive]=useState(false);
  const [preview,setPreview]=useState('');const [busy,setBusy]=useState(false);const revision=useRef(0);
  const prayer=useRef<PrayerSubmissionHandle>(null);
  const holder=useRef<HolderFaithSubmissionHandle>(null);
  const [prayerReady,setPrayerReady]=useState(false);
  const [holderReady,setHolderReady]=useState(false);
  const [prayerLoaded,setPrayerLoaded]=useState(false),[holderLoaded,setHolderLoaded]=useState(false);
  const prayerAvailability=useCallback((ready:boolean)=>{setPrayerReady(ready);setPrayerLoaded(true);},[]);
  const holderAvailability=useCallback((ready:boolean)=>{setHolderReady(ready);setHolderLoaded(true);},[]);
  const prayerFailure=useCallback(()=>{setPrayerReady(false);setPrayerLoaded(true);setBusy(false);},[]);
  const holderFailure=useCallback(()=>{setHolderReady(false);setHolderLoaded(true);setBusy(false);},[]);
  const submissionLoading=kind==='prayer'?Boolean(startPrayer)&&!prayerLoaded:Boolean(startHolderFaith)&&!holderLoaded;
  const livePrayer=kind==='prayer'&&chainBroadcast(projectChainSettings,'prayers')&&Boolean(startPrayer);
  const liveHolder=kind!=='prayer'&&chainBroadcast(projectChainSettings,'holderFaith')&&Boolean(startHolderFaith);
  const liveChain=livePrayer||liveHolder;
  const review=analyzeFaithText(text);
  const screen=faithScreenPreview({name,text:review.valid?review.text:'',anonymous,encrypted:privateText});
  const invalidate=()=>{revision.current++;setPreview('');feedback.current?.clear();};
  useEffect(()=>()=>{revision.current++;},[]);
  async function prepare(e:FormEvent){
    e.preventDefault();if(!review.valid||busy||prayerPending||speechActive)return;
    if(livePrayer){invalidate();await prayer.current?.submit();return;}
    if(liveHolder){invalidate();await holder.current?.submit();return;}
    invalidate();setBusy(true);const version=revision.current;
    try{
      const normalized=requireFaithText(text);
      const result=privateText?await encryptedPreview(normalized):null;
      if(version!==revision.current)return;
      setPreview(result?`Encrypted locally · ${result.bytes} bytes · ${result.algorithm}. This preview is not uploaded or saved. Its key is discarded; it cannot be recovered.`:
        `Public preview · ${new TextEncoder().encode(normalized).byteLength} bytes. Nothing has been uploaded or saved.`);
      feedback.current?.complete({kind,state:'local-preview'});
    }catch{if(version===revision.current)setPreview('Your browser could not prepare this preview. Nothing was sent.');}
    finally{setBusy(false);}
  }
  return <form onSubmit={prepare} className="faith-composer">
    <div className="segmented">{(['prayer','confession','praise'] as const).map(k=><button key={k} type="button" disabled={busy||prayerPending} aria-pressed={kind===k} className={kind===k?'chosen':''} onClick={()=>{
      const next=faithVisibilityDefaults(k);setKind(k);setPrivateText(next.encrypted);setAnonymous(next.anonymous);setBusy(false);invalidate();
      // A disposed child cannot clear the next ritual's local preparation flag.
      // Native confirmations remain blocked by the App-owned shared pending state.
    }}>{k}</button>)}</div>
    <p className="muted">{liveChain?`Write your ${kind}.`:'Local preview · not an onchain submission.'}</p>
    <FaithSpeechInput key={kind} disabled={busy||prayerPending} onActiveChange={active=>{setSpeechActive(active);if(active)invalidate();onSpeakingChange(active);}} append={transcript=>{
      const candidate=text.trim()?`${text.trimEnd()}\n${transcript}`:transcript;
      if(!analyzeFaithText(candidate).valid)return false;setText(candidate);invalidate();return true;
    }}/>
    <label className="field-label" htmlFor="faith-text">Your {kind}</label>
    <textarea id="faith-text" dir="auto" disabled={busy||prayerPending} placeholder="Begin with what is in your heart…" value={text} maxLength={FAITH_TEXT_LIMITS.characters*2} rows={6}
      aria-describedby={text&&review.error?'faith-size faith-limit':'faith-size'} aria-invalid={Boolean(text&&review.error)} onChange={e=>{setText(e.target.value);invalidate();}}/>
    <div className="field-meta faith-size" id="faith-size"><span>{review.characters}/2,000</span><InfoHint label="Text length details"><p>Any language · trimmed text. {review.bytes}/4,000 UTF-8 bytes. Final limits and network fees depend on the record service.</p></InfoHint></div>
    {text&&review.error&&<p id="faith-limit" className="error">{review.error}</p>}
    <label className="check-row"><input type="checkbox" checked={anonymous} disabled={submissionLoading||busy||prayerPending} onChange={e=>{setAnonymous(e.target.checked);invalidate();}}/> Hide my name <span>Initial + stars</span></label>
    <label className="check-row"><input type="checkbox" checked={privateText} disabled={submissionLoading||busy||prayerPending} onChange={e=>{setPrivateText(e.target.checked);invalidate();}}/> Encrypt my words <span>Content shown as *****</span></label>
    <section className="faith-screen-review" aria-label="Public screen preview">
      <div className="faith-review-heading"><h3>Public screen preview</h3></div>
      <dl><div><dt>Name</dt><dd><bdi data-testid="faith-preview-name">{screen.name}</bdi></dd></div>
        <div><dt>Words</dt><dd dir="auto" data-testid="faith-preview-words">{privateText?screen.words:review.valid?screen.words:'Your valid words will appear here.'}</dd></div>
      </dl>
    </section>
    <InfoHint label="Privacy and permanence details">
      <p>{liveChain?'These visibility choices will be stored with your record. Confirmed records can appear on the public board with these choices.':'Only you can see this preview. It is not posted to the world.'}</p>
      <p>Hiding your name does not encrypt your words. Encrypting your words does not hide your name. Choose both for an anonymous, encrypted record.</p>
    {privateText&&<p className="fine-print" data-testid="faith-encryption-size">Encrypted content: {review.ciphertextBytes} bytes including the {FAITH_ENCRYPTION_SIZES.tag}-byte authentication tag. A {FAITH_ENCRYPTION_SIZES.iv}-byte IV and record metadata are additional. This is not a transaction-size or Gas estimate.</p>}
      <p>{privateText?'The encryption key is discarded. These words cannot be recovered. Encryption does not hide the transaction or paying wallet.':'Public words are readable by everyone if submitted. Confirmed records cannot be removed by this app.'}</p>
    </InfoHint>
    {kind==='prayer'&&startPrayer&&<FeatureBoundary label="Prayer options" onFailure={prayerFailure} pending={prayerPending}><Suspense fallback={<div className="prayer-chain-loading"><p className="fine-print">Loading prayer submission…</p></div>}><PrayerSubmission ref={prayer} wallets={wallets} preferred={preferred} account={account} prepareNetwork={prepareNetwork} scope={scope} name={name} text={text} anonymous={anonymous} encrypted={privateText} start={startPrayer} pending={prayerPending} onBusy={setBusy} onReady={prayerAvailability} onConfirmed={id=>confirmed('prayer',id)} openHistory={openPrayerHistory}/></Suspense></FeatureBoundary>}
    {kind!=='prayer'&&startHolderFaith&&<FeatureBoundary label="Holder faith options" onFailure={holderFailure} pending={prayerPending}><Suspense fallback={<div className="prayer-chain-loading"><p className="fine-print">Loading holder faith submission…</p></div>}><HolderFaithSubmission ref={holder} kind={kind} wallets={wallets} preferred={preferred} account={account} prepareNetwork={prepareNetwork} scope={scope} name={name} text={text} anonymous={anonymous} encrypted={privateText} start={startHolderFaith} pending={prayerPending} onBusy={setBusy} onReady={holderAvailability} onConfirmed={id=>confirmed(kind,id)} openHistory={openHolderHistory}/></Suspense></FeatureBoundary>}
    <TransactionWaitStatus phase={waitPhase??(prayerPending?'blockchain':liveChain&&busy?'wallet':null)}/>
    <button className="primary full" aria-label={liveChain?`Submit ${kind} in wallet`:undefined} disabled={!review.valid||busy||prayerPending||speechActive||submissionLoading||(liveChain&&(livePrayer?!prayerReady:!holderReady))} type="submit">{waitPhase==='blockchain'?'Waiting for blockchain…':waitPhase==='uncertain'?'Check transaction history':waitPhase==='wallet'||liveChain&&busy?'Preparing / awaiting wallet…':busy?'Preparing…':liveChain?`Submit ${kind} in wallet`:privateText?'Preview local encryption':'Preview my words'}<ArrowRight size={16}/></button>
    {preview&&<p className="preview-result" role="status">{preview}</p>}
    <RitualFeedback ref={feedback} soundEnabled={soundEnabled} onSpeakingChange={onSpeakingChange}/>
    <InfoHint label="Record and voice details"><p>{liveChain?'Submission is enabled on the configured network.':'No chain transaction is enabled in this preview.'} Prayer has no holding requirement. Onchain confession and praise require at least 1 whole configured God token, without deducting or burning tokens. Network gas still applies. Unconfigured or disabled record types remain local previews. Donations are separate and voluntary. Optional browser voice transcription requires separate consent and text review; it is not voice chat.</p></InfoHint>
  </form>;
}
