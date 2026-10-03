import type {Contact,Conversation,SocialSnapshot} from '../shared/social';
export const PRIVATE_CACHE_LIMIT=12;
export type ConversationCache=Record<string,Conversation>;
export function snapshotContacts(snapshot:SocialSnapshot):Contact[]{
  const selected=snapshot.selected?.contact;if(!selected)return snapshot.contacts;
  const directory=snapshot.contacts.find(c=>c.peer.personId===selected.peer.personId);
  // A later inbox block/removal cannot be overwritten by an earlier pair read.
  if(directory&&directory.revision>selected.revision)return snapshot.contacts;
  return [selected,...snapshot.contacts.filter(c=>c.peer.personId!==selected.peer.personId)];
}
export function retainConversations(cache:ConversationCache,contacts:Contact[],selected?:string,pending?:string):ConversationCache{
  const available=new Set(contacts.filter(c=>c.available).map(c=>c.peer.personId));
  const priority=(id:string)=>id===selected?2:id===pending?1:0;
  return Object.fromEntries(Object.entries(cache).filter(([id])=>available.has(id)).sort((a,b)=>priority(b[0])-priority(a[0])||b[1].contact.updatedAt-a[1].contact.updatedAt).slice(0,PRIVATE_CACHE_LIMIT));
}
export function changedConversations(contacts:Contact[],cache:ConversationCache,selected?:string,pending?:string):string[]{
  const changed=contacts.filter(c=>c.available).slice(0,PRIVATE_CACHE_LIMIT).filter(c=>c.peer.personId!==selected&&c.peer.personId!==pending&&cache[c.peer.personId]?.contact.revision!==c.revision).slice(0,3).map(c=>c.peer.personId);
  if(pending&&pending!==selected)changed.unshift(pending);
  return changed;
}
