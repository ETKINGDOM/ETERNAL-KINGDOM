import { requireFaithText } from '../shared/faithReview';
import { bytesToHex } from 'viem';
import { faithScreenPreview } from '../shared/faithReview';
import { prayerPayloadSchema, type PrayerPayload } from '../shared/prayerRecords';
import {holderFaithPayloadSchema,type HolderFaithPayload,type HolderFaithKind} from '../shared/holderFaithRecords';

export async function preparePrayerPayload(input:{name:string;text:string;anonymous:boolean;encrypted:boolean}):Promise<PrayerPayload> {
  const text=requireFaithText(input.text);
  const common={version:1 as const,kind:'prayer' as const,language:'und' as const,
    nonce:bytesToHex(crypto.getRandomValues(new Uint8Array(32))),
    authorVisibility:input.anonymous?'initial-only' as const:'named' as const,
    authorLabel:faithScreenPreview({...input,text,encrypted:input.encrypted}).name};
  if(!input.encrypted)return prayerPayloadSchema.parse({...common,visibility:'public',payload:text});
  const key=await crypto.subtle.generateKey({name:'AES-GCM',length:256},false,['encrypt']);
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv},key,new TextEncoder().encode(text));
  // Non-exportable random key deliberately discarded. No recovery promise.
  return prayerPayloadSchema.parse({...common,visibility:'encrypted',payload:btoa(String.fromCharCode(...new Uint8Array(ciphertext))),
    encryption:{algorithm:'AES-256-GCM',encoding:'base64',iv:bytesToHex(iv)}});
}

export async function prepareHolderFaithPayload(input:{kind:HolderFaithKind;name:string;text:string;anonymous:boolean;encrypted:boolean}):Promise<HolderFaithPayload>{
  // Same fresh ephemeral-key encryption path; no server, storage, key export or audio.
  const envelope=await preparePrayerPayload(input);
  return holderFaithPayloadSchema.parse({...envelope,kind:input.kind});
}

export async function encryptedPreview(text: string) {
  const normalized=requireFaithText(text);
  const key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt']);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(normalized));
  // Ephemeral demo: no export, upload, browser storage, or recovery of this key.
  return { bytes: ciphertext.byteLength, algorithm: 'AES-256-GCM' as const };
}
