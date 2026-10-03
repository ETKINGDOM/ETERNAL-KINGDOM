import { z } from 'zod';
import { accountProfileSchema, evmReceivingAddressSchema, type AccountProfileAdapter, type ProfileMutation } from '../shared/profile';
import {releaseStorageKey,releaseHeaders} from './releaseScope';

export class ProfileRequestError extends Error{
  constructor(readonly status:number){super(status===409?'Your profile changed in another page. Reload the saved profile and review your changes again.':status===401||status===403?'Your wallet session changed or expired. Sign in again before saving.':status===429?'Too many saves. Wait a minute, then reload the saved profile.':'The save or connection could not be confirmed. Reload the saved profile before trying again.');}
}
async function request(path:string,body:unknown,accountId:string,signal?:AbortSignal){
  const response=await fetch(`/api/auth/${path}`,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',...releaseHeaders()},body:JSON.stringify(body),signal:signal?AbortSignal.any([signal,AbortSignal.timeout(10_000)]):AbortSignal.timeout(10_000)});
  if(!response.ok)throw new ProfileRequestError(response.status);
  const value:unknown=await response.json();
  if(typeof value!=='object'||value===null||!('profile' in value))throw new Error('Invalid profile');
  const profile=accountProfileSchema.parse(value.profile);if(profile.accountId!==accountId)throw new Error('Unexpected profile');
  return profile;
}
export const hostedProfiles:AccountProfileAdapter={
  load:(accountId,signal)=>request('profile',{accountId},accountId,signal),
  save:(change:ProfileMutation,signal)=>request('profile/save',change,change.accountId,signal),
};
const GUEST_RECIPIENT_KEY=releaseStorageKey('ek:guest:recipient:v1');
const guestRecipientSchema=z.object({address:evmReceivingAddressSchema.nullable(),revision:z.string().max(40)}).strict();
export type GuestRecipient=z.infer<typeof guestRecipientSchema>;
export function readGuestRecipient():GuestRecipient{
  try{const result=guestRecipientSchema.safeParse(JSON.parse(localStorage.getItem(GUEST_RECIPIENT_KEY)??'null'));if(result.success)return result.data;}catch{/* No saved guest address. */}
  return {address:null,revision:'0'};
}
export function saveGuestRecipient(address:string|null,expectedRevision:string):GuestRecipient{
  const current=readGuestRecipient();if(current.revision!==expectedRevision)throw new ProfileRequestError(409);
  const next={address:address===null?null:evmReceivingAddressSchema.parse(address),revision:crypto.randomUUID()};
  // Unlike the guest appearance preview, a recipient is not labelled saved if
  // storage fails. There is no network or wallet operation here.
  try{localStorage.setItem(GUEST_RECIPIENT_KEY,JSON.stringify(next));}catch{throw new Error('This browser cannot save a receiving address. Enable local storage or sign in with a wallet.');}
  return next;
}
