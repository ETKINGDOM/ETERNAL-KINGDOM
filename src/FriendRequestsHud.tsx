import {useState} from 'react';
import {X} from 'lucide-react';
import type {SocialChat} from './useSocialChat';
import {dismissFriendRequest,incomingFriendRequests,friendRequestVersion,type DismissedFriendRequests} from './friendRequests';

export default function FriendRequestsHud({chat,active,onOpenFriends}:{chat:SocialChat;active:boolean;onOpenFriends:()=>void}){
  // Closing is local to this login/tab, not a decline or a server permission.
  // A new reminder version reappears; chat updates and ordinary polls do not.
  const [hidden,setHidden]=useState<{scope:string;versions:DismissedFriendRequests}>({scope:chat.scope,versions:{}});
  const versions=hidden.scope===chat.scope?hidden.versions:{};
  const requests=incomingFriendRequests(chat.contacts,versions),request=requests[0];
  if(!active||!request)return null;
  return <section className="friend-request-hud" aria-label={`Friend request from ${request.peer.name}`} aria-live="polite" data-request-version={friendRequestVersion(request)} onPointerDown={e=>e.stopPropagation()}>
    <header><span>Friend request</span><button className="icon-button" aria-label={`Close friend request from ${request.peer.name}`} onClick={()=>setHidden(old=>({scope:chat.scope,versions:dismissFriendRequest(chat.contacts,old.scope===chat.scope?old.versions:{},request)}))}><X size={15}/></button></header>
    <bdi className="friend-request-name" title={request.peer.name}>{request.peer.name}</bdi>
    <div className="friend-request-actions"><button disabled={chat.busy||chat.uncertain} aria-label={`Accept friend request from ${request.peer.name}`} onClick={()=>void chat.change(request.peer,'accept-friend')}>Accept</button><button disabled={chat.busy||chat.uncertain} aria-label={`Decline friend request from ${request.peer.name}`} onClick={()=>void chat.change(request.peer,'decline-friend')}>Decline</button>{requests.length>1&&<button onClick={onOpenFriends}>{requests.length-1} more</button>}</div>
  </section>;
}
