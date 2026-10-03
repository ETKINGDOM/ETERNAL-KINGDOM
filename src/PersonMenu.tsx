import {Gift,MessageCircle,Mic,UserRound,UserPlus,X} from 'lucide-react';
import {useEffect,useState} from 'react';
import type {Player} from '../shared/protocol';
import type {Contact} from '../shared/social';
import InfoHint from './InfoHint';
import {firstGrapheme} from './textPresentation';
import './personMenu.css';

export default function PersonMenu({person,contact,onClose,onWhisper,onFriend,onVoice,onGift,canVoice,busy,error,notice}:{person:Player;contact?:Contact;onClose:()=>void;onWhisper:()=>void;onFriend:()=>void;onVoice:()=>void;onGift:()=>void;canVoice:boolean;busy:boolean;error:string;notice:string}){
  const [profile,setProfile]=useState(false);useEffect(()=>setProfile(false),[person.id]);
  const wallet=person.identity?.kind==='wallet';
  return <section className="person-menu" aria-label={`Actions for ${person.name}`} onPointerDown={e=>e.stopPropagation()}>
    <header><b><bdi>{person.name}</bdi></b><button className="icon-button" aria-label="Close person menu" onClick={onClose}><X size={16}/></button></header>
    <nav aria-label="Person actions">
      <button onClick={()=>setProfile(v=>!v)} aria-expanded={profile}><UserRound size={18}/>Profile</button>
      <button onClick={onWhisper} disabled={!wallet||contact?.available===false}><MessageCircle size={18}/>Whisper</button>
      <button onClick={onVoice} disabled={!canVoice}><Mic size={18}/>Invite to voice</button>
      <button onClick={onFriend} disabled={!wallet||busy||contact?.available===false}><UserPlus size={18}/>{contact?.friend==='friends'?'Friends':contact?.friend==='outgoing'?'Request sent':contact?.friend==='incoming'?'Accept friend':'Add friend'}</button>
      <button onClick={onGift}><Gift size={18}/>Gift</button>
    </nav>
    {profile&&<div className="person-mini-profile"><span className="person-avatar" aria-hidden="true">{firstGrapheme(person.name)}</span><b><bdi>{person.name}</bdi></b><small>{wallet?`${person.identity?.kind==='wallet'&&person.identity.family==='evm'?'EVM':'Solana'} wallet · verified`:'Guest'}</small><InfoHint label="Person profile details"><p>Names are not unique. Wallet verification proves account control, not religious status or a receiving address. Gifts use the separately published EVM receiving address.</p></InfoHint></div>}
    {!wallet&&<small>A wallet account is needed for private contact.</small>}
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}
  </section>;
}
