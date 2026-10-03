import {MessageCircle,RefreshCw,UserCheck,UserPlus,X,Mic} from 'lucide-react';
import type {SocialChat} from './useSocialChat';
import type {SocialPeer} from '../shared/social';
import type {Player} from '../shared/protocol';
import InfoHint from './InfoHint';
export default function FriendsPanel({chat,players,verified,onClose,onWhisper,openProfile,online,onVoice,canVoice=false}:{chat:SocialChat;players:Player[];verified:boolean;onClose:()=>void;onWhisper:(peer:SocialPeer)=>void;openProfile:()=>void;online?:string[];onVoice?:(peer:SocialPeer)=>void;canVoice?:boolean}){
  const contacts=chat.contacts.filter(c=>c.available&&(c.friend!=='none'));
  function rows(friends:boolean){return contacts.filter(c=>(c.friend==='friends')===friends).map(c=>{
    const present=online?online.includes(c.peer.personId):players.some(p=>p.identity?.kind==='wallet'&&p.identity.personId===c.peer.personId);
    return <li key={c.peer.personId}><div><b><bdi>{c.peer.name}</bdi></b><small>{c.friend==='incoming'?'Friend request':c.friend==='outgoing'?'Waiting for acceptance':online?(present?'Online':'Offline'):(present?'In this room':'Not in this room')}</small></div>
      {c.friend==='incoming'&&<><button className="icon-button" aria-label={`Accept ${c.peer.name}`} disabled={chat.busy||chat.uncertain} onClick={()=>void chat.change(c.peer,'accept-friend')}><UserCheck size={18}/></button><button className="icon-button" aria-label={`Decline ${c.peer.name}`} disabled={chat.busy||chat.uncertain} onClick={()=>void chat.change(c.peer,'decline-friend')}><X size={16}/></button></>}
      {c.friend==='outgoing'&&<><button className="icon-button" aria-label={`Remind ${c.peer.name} of friend request`} disabled={chat.busy||chat.uncertain} onClick={()=>void chat.change(c.peer,'invite-friend')}><UserPlus size={18}/></button><button className="icon-button" aria-label={`Cancel request to ${c.peer.name}`} disabled={chat.busy||chat.uncertain} onClick={()=>void chat.change(c.peer,'cancel-friend')}><X size={16}/></button></>}
      <button className="icon-button" aria-label={`Whisper to ${c.peer.name}`} onClick={()=>onWhisper(c.peer)}><MessageCircle size={18}/></button>
      {friends&&<button className="icon-button" aria-label={`Remove friend ${c.peer.name}`} disabled={chat.busy||chat.uncertain} onClick={()=>void chat.change(c.peer,'remove-friend')}><X size={14}/></button>}
      {friends&&onVoice&&<button className="icon-button" aria-label={`Invite ${c.peer.name} to voice`} disabled={!present||!canVoice} onClick={()=>onVoice(c.peer)}><Mic size={16}/></button>}
    </li>;
  });}
  return <section className="friends-popover" aria-label="Friends"><header><h3>Friends</h3><button className="icon-button" aria-label="Refresh friends" disabled={chat.busy} onClick={()=>void chat.refresh()}><RefreshCw size={16}/></button><button className="icon-button" aria-label="Close friends" onClick={onClose}><X size={16}/></button></header>
    <InfoHint label="Friends details"><p>Friend requests need agreement. Private messages do not. Closing a reminder does not decline it. Asking again re-shows the same request, not another row. Declining, cancelling or removing a friend has no friend-request cooldown. Removing a friend does not erase your conversation. Connected visitors receive private update notifications; limited polling remains as a fallback. Online means a verified community connection, not that the person is in this map.</p></InfoHint>
    {!verified?<><p>Sign in to add friends or whisper.</p><button className="secondary-button" onClick={openProfile}>Connect wallet</button></>:<>
      {contacts.some(c=>c.friend!=='friends')&&<><h4>Requests</h4><ul aria-label="Friend requests">{rows(false)}</ul></>}
      {contacts.some(c=>c.friend==='friends')?<><h4>Your friends</h4><ul aria-label="Accepted friends">{rows(true)}</ul></>:<p>No friends yet. Click a person to add them.</p>}
    </>}
    {chat.error&&<p role="alert">{chat.error}</p>}{chat.notice&&<p role="status">{chat.notice}</p>}
  </section>;
}
