import {CONTACT_LIMIT,type Contact} from '../shared/social';

export type DismissedFriendRequests=Record<string,number>;
export const friendRequestVersion=(contact:Contact)=>contact.friendRequestRevision??0;
export function incomingFriendRequests(contacts:Contact[],dismissed:DismissedFriendRequests={}):Contact[]{
  const peers=new Map<string,Contact>();
  for(const contact of contacts){const previous=peers.get(contact.peer.personId);if(!previous||previous.revision<=contact.revision)peers.set(contact.peer.personId,contact);}
  return [...peers.values()].filter(c=>c.available&&c.friend==='incoming'&&dismissed[c.peer.personId]!==friendRequestVersion(c)).sort((a,b)=>b.updatedAt-a.updatedAt||a.peer.personId.localeCompare(b.peer.personId));
}
export function dismissFriendRequest(contacts:Contact[],dismissed:DismissedFriendRequests,contact:Contact):DismissedFriendRequests{
  const active=new Set(incomingFriendRequests(contacts).map(c=>c.peer.personId));
  const kept=Object.entries(dismissed).filter(([id])=>active.has(id)&&id!==contact.peer.personId).slice(-(CONTACT_LIMIT-1));
  return Object.fromEntries([...kept,[contact.peer.personId,friendRequestVersion(contact)]]);
}
