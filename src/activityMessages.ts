// Fixed client-only system messages. Never accept faith words, wallet responses,
// addresses, amounts or chat content, and never remove a transaction ledger entry.
export type ActivityKind='prayer'|'confession'|'praise'|'faith'|'gift'|'donation'|'token'|'lamp';
export type ActivityInput={id:string;kind:ActivityKind;status:string};
export type ActivityMessage=ActivityInput&{sequence:number;time:number};
export type ActivityState={seen:Map<string,string>;messages:ActivityMessage[];sequence:number};
export const ACTIVITY_NOTICE_DURATION=60_000,ACTIVITY_HISTORY_LIMIT=128;
export const activityLabels:Record<ActivityKind,string>={prayer:'Prayer',confession:'Confession',praise:'Praise',faith:'Faith record',gift:'Gift',donation:'Donation',token:'Token transfer',lamp:'Daily lamp'};
const statuses:Record<string,string>={preparing:'Preparing', 'awaiting-wallet':'Waiting for wallet',pending:'Waiting for blockchain',confirmed:'Confirmed',failed:'Failed',cancelled:'Cancelled','not-submitted':'Not submitted',unknown:'Check transaction history',unconfirmed:'Check transaction history',insufficient:'Requires at least 1 God',lit:'Lit today'};
export function activityText(message:ActivityInput){return `${activityLabels[message.kind]} · ${statuses[message.status]??'Check transaction history'}`;}
export function collectActivity(state:ActivityState,inputs:readonly ActivityInput[],now:number):ActivityState{
  if(!Number.isFinite(now))return state;
  const changes=inputs.filter(input=>Object.hasOwn(statuses,input.status)&&state.seen.get(input.id)!==input.status);
  if(!changes.length)return state;
  const seen=new Map(state.seen);let sequence=state.sequence;
  const next=changes.map(input=>{seen.set(input.id,input.status);return {id:input.id,kind:input.kind,status:input.status,time:now,sequence:++sequence};});
  const activeIds=new Set(inputs.map(input=>input.id));
  for(const id of seen.keys())if(!activeIds.has(id))seen.delete(id);
  return {seen,sequence,messages:[...next.reverse(),...state.messages].slice(0,ACTIVITY_HISTORY_LIMIT)};
}
export function currentActivityNotice(state:ActivityState,now:number){
  const latest=state.messages[0];return latest&&now>=latest.time&&now-latest.time<ACTIVITY_NOTICE_DURATION?latest:null;
}
