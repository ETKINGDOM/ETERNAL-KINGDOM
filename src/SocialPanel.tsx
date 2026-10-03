import {useEffect} from 'react';
import type {WalletSession} from '../shared/identity';
import type {Scene} from '../shared/scenes';
import type {SocialPeer} from '../shared/social';
import {useSocialChat} from './useSocialChat';
import FriendsPanel from './FriendsPanel';

// Compatibility entry point. The world uses one shared hook instead of a
// modal-owned chat connection; old callers no longer expose text invitations.
export default function SocialPanel({session,initialPeer,scene,channel,openProfile}:{session:WalletSession|null;initialPeer:SocialPeer|null;scene:Scene;channel:number;openProfile:()=>void}){
  const chat=useSocialChat(session,true,scene,channel);
  useEffect(()=>chat.choose(initialPeer),[initialPeer?.personId]);
  return <FriendsPanel chat={chat} players={[]} verified={Boolean(session)} onClose={()=>{}} onWhisper={chat.choose} openProfile={openProfile}/>;
}
