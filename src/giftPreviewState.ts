import type { Player } from '../shared/protocol';
import type { Scene } from '../shared/world';
import { giftTargetFor,giftTargetKey,type GiftTarget,type PersonGiftRecipientAdapter } from '../shared/gifts';

export const unconfiguredGiftRecipients:PersonGiftRecipientAdapter={lookup:async()=>({status:'unconfigured'})};
export type GiftPreviewSelection={target:GiftTarget;connectionId:string;scene:Scene;channel:number;senderScope:string};
export function currentGiftPerson(selection:GiftPreviewSelection|null,players:readonly Player[],context:{scene:Scene;channel:number;senderScope:string;online:boolean;self:string}){
  if(!selection||!context.online||selection.scene!==context.scene||selection.channel!==context.channel||selection.senderScope!==context.senderScope)return null;
  return players.find(p=>p.id===selection.connectionId&&p.id!==context.self&&giftTargetKey(giftTargetFor(p))===giftTargetKey(selection.target))??null;
}
