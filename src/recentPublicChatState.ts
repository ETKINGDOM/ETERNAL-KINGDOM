import type { ChatMessage } from '../shared/protocol';
import { CHAT_TTL } from '../shared/world';

export const RECENT_PUBLIC_CHAT_LIMIT=3;
export const RECENT_PUBLIC_CHAT_PREFERENCE='ek:recent-public-chat:v1';

// A bounded projection of the existing public room history, not another inbox
// or storage/transport. Callers supply the same locally filtered public list.
export function recentPublicMessages(messages:readonly ChatMessage[],now:number){
  return messages.filter(m=>m.time>now-CHAT_TTL).slice(-RECENT_PUBLIC_CHAT_LIMIT);
}

export function readRecentChatPreference(storage:Pick<Storage,'getItem'>){
  try{return storage.getItem(RECENT_PUBLIC_CHAT_PREFERENCE)!=='false';}catch{return true;}
}

export function saveRecentChatPreference(storage:Pick<Storage,'setItem'>,expanded:boolean){
  try{storage.setItem(RECENT_PUBLIC_CHAT_PREFERENCE,String(expanded));}catch{/* Session-only choice remains usable. */}
}
