import { ritualResponses, type RitualKind } from './content/ritualResponses';

// Local presentation only, never proof of payment/acceptance. Future adapters
// must verify a receipt before emitting confirmed. No private text is accepted.
export type RitualFeedbackEvent={kind:RitualKind;state:'local-preview'|'pending'|'confirmed'|'failed';confirmationId?:string};
export interface RitualFeedbackPort { complete(event:RitualFeedbackEvent):void; clear():void }
export function ritualPresentation(event:RitualFeedbackEvent){
  if(!Object.hasOwn(ritualResponses.messages,event.kind))return null;
  if(event.state==='local-preview'&&event.kind!=='donation')return {
    text:ritualResponses.messages[event.kind],
    status:'Local preview only · not saved or sent onchain.',
  };
  if(event.state==='confirmed'&&event.confirmationId?.trim())return {
    text:ritualResponses.messages[event.kind],
    status:event.kind==='donation'?'Donation transaction confirmed.':'Record transaction confirmed.',
  };
  return null;
}
