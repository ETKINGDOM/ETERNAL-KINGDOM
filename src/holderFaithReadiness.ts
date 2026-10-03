import {rpcFetchOptions,type RpcFetch} from '../shared/rpcFetch';
import {createPublicClient,http,keccak256,type Address,type Hash,type Hex} from 'viem';
import {configuredGodToken,faithRecordPolicy,chainBroadcast,type ChainSettings,type GodTokenSnapshot} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import {evmReceivingAddressSchema} from '../shared/profile';
import {holderFaithAbi,holderFaithCall,holderFaithPayloadSchema,holderFaithRecordId,type HolderFaithPayload,type HolderFaithKind} from '../shared/holderFaithRecords';
import {evmGodTokenReadPort,godTokenService,type GodTokenReadPort} from './godTokenService';

export interface HolderFaithReadPort extends GodTokenReadPort {
  parameters(contract:Address):Promise<{token:Address;decimals:number;minimum:bigint}>;
}
export function holderFaithReadPort(url:string,signal:AbortSignal,fetchFn?:RpcFetch):HolderFaithReadPort{
  const client=createPublicClient({ccipRead:false,transport:http(url,{retryCount:0,timeout:8000,maxResponseBodySize:65536,fetchOptions:rpcFetchOptions(signal),fetchFn})});
  return {...evmGodTokenReadPort(url,signal,fetchFn),async parameters(address){
    const [token,decimals,minimum]=await Promise.all([
      client.readContract({address,abi:holderFaithAbi,functionName:'godToken'}),
      client.readContract({address,abi:holderFaithAbi,functionName:'tokenDecimals'}),
      client.readContract({address,abi:holderFaithAbi,functionName:'minimumHolding'}),
    ]);return {token,decimals,minimum};
  }};
}
export function holderFaithConfiguration(settings:ChainSettings){
  const token=configuredGodToken(settings);
  if(settings.status!=='valid'||!token||!isRobinhoodNitroNetwork(settings.config.network)||!settings.config.faithRecords.holderContract||!settings.config.faithRecords.holderCodeHash)return null;
  return Object.freeze({...token,contract:settings.config.faithRecords.holderContract as Address,tokenContract:token.contract,
    codeHash:settings.config.faithRecords.holderCodeHash as Hash,broadcast:chainBroadcast(settings,'holderFaith')});
}
export type HolderFaithPreparation={
  kind:HolderFaithKind;kindCode:1|2;chainId:number;contract:Address;codeHash:Hash;payer:Address;token:GodTokenSnapshot;minimumHolding:bigint;observedUnits:bigint;
  configRevision:string;recordId:Hash;payloadHash:Hash;data:Hex;bytes:Hex;value:0n;
};
// Read-only, no estimate, wallet prompt, signing, token approvals or broadcast.
// This is not a reusable authorization/quote. An execution adapter must repeat
// context/wallet checks and simulate; the contract enforces balance at execution.
export async function prepareHolderFaithRecord(settings:ChainSettings,account:string,payload:HolderFaithPayload,signal:AbortSignal,
  factory:(url:string,signal:AbortSignal)=>HolderFaithReadPort=holderFaithReadPort):Promise<HolderFaithPreparation>{
  signal.throwIfAborted();const snapshotSettings={...settings} as ChainSettings,config=holderFaithConfiguration(snapshotSettings);
  if(!config)throw Error('Holder faith records are not configured on the approved Robinhood network.');
  const payer=evmReceivingAddressSchema.parse(account) as Address,snapshot=holderFaithPayloadSchema.parse(payload),call=holderFaithCall(snapshot);
  // All mutable draft/account/config inputs are copied before the first await.
  const bounded=AbortSignal.any([signal,AbortSignal.timeout(20000)]),rpc=factory(config.rpcUrl,bounded);
  const check=()=>bounded.throwIfAborted();check();
  if(await rpc.chainId()!==config.chainId)throw Error('RPC network mismatch.');check();
  const code=await rpc.bytecode(config.contract);check();
  if(!code||keccak256(code as Hex)!==config.codeHash)throw Error('Holder record contract code is not verified.');
  const service=godTokenService(snapshotSettings,()=>rpc),metadata=await service.read(bounded);check();
  if(metadata.status!=='available')throw Error('God token is not configured.');
  const policy=faithRecordPolicy(snapshotSettings,snapshot.kind,metadata.token);
  if(policy.status!=='holder-only')throw Error('Holding policy is not configured.');
  const parameters=await rpc.parameters(config.contract);check();
  if(parameters.token.toLowerCase()!==config.tokenContract.toLowerCase()||parameters.decimals!==metadata.token.decimals||parameters.minimum!==policy.minimumHolding)throw Error('Record contract is bound to a different token or holding threshold.');
  const balance=await service.balance(metadata.token,payer,bounded);check();
  if(balance.units<policy.minimumHolding)throw Error('At least 1 whole God token is required for confession and praise.');
  if(await rpc.chainId()!==config.chainId)throw Error('RPC network changed.');check();
  const finalCode=await rpc.bytecode(config.contract);check();
  if(!finalCode||keccak256(finalCode as Hex)!==config.codeHash)throw Error('Holder record contract code changed.');
  Object.freeze(metadata.token);
  return Object.freeze({kind:snapshot.kind,chainId:config.chainId,contract:config.contract,codeHash:config.codeHash,payer,token:metadata.token,
    minimumHolding:policy.minimumHolding,observedUnits:balance.units,configRevision:config.configRevision,
    recordId:holderFaithRecordId(config.chainId,config.contract,payer,snapshot.kind,call.payloadHash),...call,value:0n});
}
