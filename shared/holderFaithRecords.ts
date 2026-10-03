import {z} from 'zod';
import {encodeAbiParameters,encodeFunctionData,keccak256,stringToHex,type Address,type Hex} from 'viem';
import {prayerPayloadSchema,PRAYER_PAYLOAD_LIMIT} from './prayerRecords';
import type {RecordKind} from './adapters';

export type HolderFaithKind=Exclude<RecordKind,'prayer'>;
// Reuse the strict, size/encoding-checked prayer envelope without changing its
// wire format. Explicitly validate kind first; never silently accept prayer.
export const holderFaithPayloadSchema=z.object({kind:z.enum(['confession','praise'])}).passthrough().transform((input,ctx)=>{
  const result=prayerPayloadSchema.safeParse({...input,kind:'prayer'});
  if(!result.success){ctx.addIssue({code:'custom',message:'Invalid faith record envelope.'});return z.NEVER;}
  return {...result.data,kind:input.kind};
});
export type HolderFaithPayload=z.infer<typeof holderFaithPayloadSchema>;
export const holderFaithAbi=[
  {type:'function',name:'godToken',stateMutability:'view',inputs:[],outputs:[{type:'address'}]},
  {type:'function',name:'tokenDecimals',stateMutability:'view',inputs:[],outputs:[{type:'uint8'}]},
  {type:'function',name:'minimumHolding',stateMutability:'view',inputs:[],outputs:[{type:'uint256'}]},
  {type:'function',name:'recordFaith',stateMutability:'nonpayable',inputs:[{name:'kind',type:'uint8'},{name:'payload',type:'bytes'}],outputs:[{name:'recordId',type:'bytes32'}]},
  {type:'function',name:'readFaith',stateMutability:'view',inputs:[{name:'recordId',type:'bytes32'}],outputs:[{name:'author',type:'address'},{name:'createdAt',type:'uint256'},{name:'kind',type:'uint8'},{name:'payload',type:'bytes'}]},
  {type:'event',name:'FaithRecorded',inputs:[{name:'recordId',type:'bytes32',indexed:true},{name:'author',type:'address',indexed:true},{name:'kind',type:'uint8',indexed:false},{name:'payloadHash',type:'bytes32',indexed:false}]},
] as const;
export const holderFaithKindCode=(kind:HolderFaithKind)=>kind==='confession'?1 as const:2 as const;
export function serializeHolderFaith(input:HolderFaithPayload):Hex{
  const p=holderFaithPayloadSchema.parse(input);
  const text=JSON.stringify({version:p.version,kind:p.kind,language:p.language,nonce:p.nonce,authorVisibility:p.authorVisibility,authorLabel:p.authorLabel,
    visibility:p.visibility,payload:p.payload,...(p.visibility==='encrypted'?{encryption:{algorithm:p.encryption.algorithm,encoding:p.encryption.encoding,iv:p.encryption.iv}}:{})});
  if(new TextEncoder().encode(text).byteLength>PRAYER_PAYLOAD_LIMIT)throw Error('Faith envelope exceeds the contract limit.');
  return stringToHex(text);
}
export function holderFaithCall(payload:HolderFaithPayload){
  const validated=holderFaithPayloadSchema.parse(payload),bytes=serializeHolderFaith(validated),kind=holderFaithKindCode(validated.kind);
  return {kindCode:kind,bytes,payloadHash:keccak256(bytes),data:encodeFunctionData({abi:holderFaithAbi,functionName:'recordFaith',args:[kind,bytes]})};
}
export function holderFaithRecordId(chainId:number,contract:Address,payer:Address,kind:HolderFaithKind,payloadHash:Hex){
  return keccak256(encodeAbiParameters([{type:'uint256'},{type:'address'},{type:'address'},{type:'uint8'},{type:'bytes32'}],[BigInt(chainId),contract,payer,holderFaithKindCode(kind),payloadHash]));
}
