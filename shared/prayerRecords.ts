import { z } from 'zod';
import { encodeAbiParameters, encodeFunctionData, keccak256, stringToHex, type Address, type Hex } from 'viem';
import { analyzeFaithText } from './faithReview';

export const PRAYER_PAYLOAD_LIMIT=16384;
const label=z.string().min(1).max(96).regex(/^[^\u0000-\u001f\u007f<>\u202a-\u202e\u2066-\u2069]*$/u);
const common={version:z.literal(1),kind:z.literal('prayer'),language:z.literal('und'),nonce:z.string().regex(/^0x[0-9a-f]{64}$/),authorVisibility:z.enum(['named','initial-only']),authorLabel:label};
const ciphertext=z.string().min(24).max(5356).regex(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/).refine(value=>{
  try{const decoded=atob(value);return decoded.length>=17&&decoded.length<=4016&&btoa(decoded)===value;}catch{return false;}
});
export const prayerPayloadSchema=z.discriminatedUnion('visibility',[
  z.object({...common,visibility:z.literal('public'),payload:z.string().refine(t=>analyzeFaithText(t).valid&&t===t.trim())}).strict(),
  z.object({...common,visibility:z.literal('encrypted'),payload:ciphertext,
    encryption:z.object({algorithm:z.literal('AES-256-GCM'),encoding:z.literal('base64'),iv:z.string().regex(/^0x[0-9a-f]{24}$/)}).strict()}).strict(),
]);
export type PrayerPayload=z.infer<typeof prayerPayloadSchema>;
export const prayerAbi=[
  {type:'function',name:'recordPrayer',stateMutability:'nonpayable',inputs:[{name:'payload',type:'bytes'}],outputs:[{name:'recordId',type:'bytes32'}]},
  {type:'function',name:'readPrayer',stateMutability:'view',inputs:[{name:'recordId',type:'bytes32'}],outputs:[{name:'author',type:'address'},{name:'createdAt',type:'uint256'},{name:'payload',type:'bytes'}]},
  {type:'event',name:'PrayerRecorded',inputs:[{name:'recordId',type:'bytes32',indexed:true},{name:'author',type:'address',indexed:true},{name:'payloadHash',type:'bytes32',indexed:false}]},
] as const;
// Stable property order, strict envelope, no account ID, source text, key or audio.
export function serializePrayer(input:PrayerPayload):Hex {
  const p=prayerPayloadSchema.parse(input);
  const text=JSON.stringify({version:p.version,kind:p.kind,language:p.language,nonce:p.nonce,authorVisibility:p.authorVisibility,authorLabel:p.authorLabel,
    visibility:p.visibility,payload:p.payload,...(p.visibility==='encrypted'?{encryption:{algorithm:p.encryption.algorithm,encoding:p.encryption.encoding,iv:p.encryption.iv}}:{})});
  if(new TextEncoder().encode(text).byteLength>PRAYER_PAYLOAD_LIMIT)throw Error('Prayer envelope exceeds the contract limit.');
  return stringToHex(text);
}
export function prayerCall(payload:PrayerPayload){const bytes=serializePrayer(payload);return {bytes,payloadHash:keccak256(bytes),data:encodeFunctionData({abi:prayerAbi,functionName:'recordPrayer',args:[bytes]})};}
export function prayerRecordId(chainId:number,contract:Address,payer:Address,payloadHash:Hex){
  return keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'},{type:'address'},{type:'bytes32'}],[BigInt(chainId),contract,payer,payloadHash]));
}
