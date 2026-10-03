import {rpcFetchOptions,type RpcFetch} from '../shared/rpcFetch';
import {createPublicClient,http,keccak256,decodeEventLog,type Address,type Hash,type Hex,TransactionReceiptNotFoundError,TransactionNotFoundError} from 'viem';
import {chainBroadcast,type ChainSettings} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import {prayerAbi,prayerCall,prayerRecordId,prayerPayloadSchema,type PrayerPayload} from '../shared/prayerRecords';
import type {InjectedWalletProvider} from './walletIdentity';
import {injectedEvmGiftWallet,type GiftWalletAccount,type GiftReceipt,type GiftTransaction} from './evmGiftPorts';
import {PrayerPreparationError,prayerPreparationStep} from './prayerPreparation';

const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const validHash=(v:string)=>/^0x[0-9a-fA-F]{64}$/.test(v);
export type PrayerProof={chainId:number;network:string;rpcUrl:string;contract:Address;codeHash:Hash;payer:Address;payloadHash:Hash;recordId:Hash;data:Hex;bytes:Hex};
export type PrayerReceipt={status:'pending'|'confirmed'|'failed'|'unknown'};
export interface PrayerRpcPort {
  chainId():Promise<number>;code(contract:Address):Promise<Hex|undefined>;
  simulate(proof:PrayerProof):Promise<Hash>;gas(proof:PrayerProof):Promise<bigint>;
  receipt(hash:Hash):Promise<GiftReceipt|null>;transaction(hash:Hash):Promise<GiftTransaction|null>;
  head():Promise<bigint>;blockHash(number:bigint):Promise<Hash|null>;
  stored(proof:PrayerProof,blockNumber:bigint):Promise<readonly [Address,bigint,Hex]>;
}
export function prayerRpc(rpcUrl:string,signal:AbortSignal,fetchFn?:RpcFetch):PrayerRpcPort {
  const client=createPublicClient({ccipRead:false,transport:http(rpcUrl,{retryCount:0,timeout:8000,maxResponseBodySize:262144,fetchOptions:rpcFetchOptions(signal),fetchFn})});
  const args=(p:PrayerProof)=>({address:p.contract,abi:prayerAbi,functionName:'recordPrayer' as const,args:[p.bytes] as const,account:p.payer});
  return {chainId:()=>client.getChainId(),code:address=>client.getCode({address}),
    simulate:async p=>(await client.simulateContract(args(p))).result,gas:p=>client.estimateContractGas(args(p)),
    async receipt(hash){try{const r=await client.getTransactionReceipt({hash});return {hash:r.transactionHash,blockHash:r.blockHash,blockNumber:r.blockNumber,status:r.status,logs:r.logs};}catch(e){if(e instanceof TransactionReceiptNotFoundError)return null;throw e;}},
    async transaction(hash){try{const t=await client.getTransaction({hash});return {hash:t.hash,chainId:t.chainId,from:t.from,to:t.to,input:t.input,value:t.value,blockHash:t.blockHash};}catch(e){if(e instanceof TransactionNotFoundError)return null;throw e;}},
    head:()=>client.getBlockNumber({cacheTime:0}),blockHash:async blockNumber=>(await client.getBlock({blockNumber})).hash,
    stored:(p,blockNumber)=>client.readContract({address:p.contract,abi:prayerAbi,functionName:'readPrayer',args:[p.recordId],blockNumber}),
  };
}
export function prayerConfiguration(settings:ChainSettings){
  if(settings.status!=='valid'||!settings.config.network||!isRobinhoodNitroNetwork(settings.config.network)||!settings.config.faithRecords.contract||!settings.config.faithRecords.prayerCodeHash)return null;
  return {...settings.config.network,contract:settings.config.faithRecords.contract as Address,codeHash:settings.config.faithRecords.prayerCodeHash as Hash,
    revision:settings.revision,broadcast:chainBroadcast(settings,'prayers')};
}
export function proofForPrayer(settings:ChainSettings,payer:Address,payload:PrayerPayload):PrayerProof {
  const config=prayerConfiguration(settings);if(!config)throw Error('Prayer record contract is not configured.');
  const call=prayerCall(payload);
  return Object.freeze({chainId:config.chainId,network:config.name,rpcUrl:config.rpcUrl,contract:config.contract,codeHash:config.codeHash,payer,
    ...call,recordId:prayerRecordId(config.chainId,config.contract,payer,call.payloadHash)});
}

// Independent receipt proof survives composer disposal. Three blocks are
// provisional inclusion, NOT rollup L1 settlement or permanent finality.
export async function verifyPrayerReceipt(rpc:PrayerRpcPort,p:PrayerProof,hash:Hash,signal:AbortSignal):Promise<PrayerReceipt>{
  signal.throwIfAborted();if(!validHash(hash))return {status:'unknown'};
  try {
    if(await rpc.chainId()!==p.chainId)return {status:'unknown'};
    const receipt=await rpc.receipt(hash);signal.throwIfAborted();if(!receipt)return {status:'pending'};
    const tx=await rpc.transaction(hash);signal.throwIfAborted();
    if(!tx||!same(tx.hash,hash)||!same(receipt.hash,hash)||tx.chainId!==p.chainId||!same(tx.from,p.payer)||!tx.to||!same(tx.to,p.contract)||!same(tx.input,p.data)||tx.value!==0n||
      !tx.blockHash||!same(tx.blockHash,receipt.blockHash)||!validHash(receipt.blockHash)||receipt.blockNumber<0n)return {status:'unknown'};
    const [block,head,code]=await Promise.all([rpc.blockHash(receipt.blockNumber),rpc.head(),rpc.code(p.contract)]);signal.throwIfAborted();
    if(!code||keccak256(code)!==p.codeHash)return {status:'unknown'};
    if(!block||!same(block,receipt.blockHash)||head<receipt.blockNumber||head-receipt.blockNumber+1n<3n)return {status:'pending'};
    if(receipt.status==='reverted')return {status:'failed'};
    const matches=receipt.logs.filter(log=>{
      if(!same(log.address,p.contract))return false;
      try{const e=decodeEventLog({abi:prayerAbi,data:log.data,topics:log.topics as [Hex,...Hex[]],strict:true});return e.eventName==='PrayerRecorded'&&same(e.args.recordId,p.recordId)&&same(e.args.author,p.payer)&&same(e.args.payloadHash,p.payloadHash);}catch{return false;}
    });
    if(receipt.status!=='success'||matches.length!==1)return {status:'unknown'};
    const stored=await rpc.stored(p,receipt.blockNumber);signal.throwIfAborted();
    if(!same(stored[0],p.payer)||stored[1]<=0n||!same(stored[2],p.bytes)||keccak256(stored[2])!==p.payloadHash)return {status:'unknown'};
    if(await rpc.chainId()!==p.chainId)return {status:'unknown'};
    const last=await rpc.blockHash(receipt.blockNumber);signal.throwIfAborted();
    return {status:last&&same(last,receipt.blockHash)?'confirmed':'pending'};
  }catch(e){if(signal.aborted)throw e;return {status:'unknown'};}
}
export type NativeTransactionRequest=Pick<PrayerProof,'chainId'|'contract'|'data'>;
export type PrayerWalletPort={current():Promise<GiftWalletAccount>;send(p:NativeTransactionRequest,account:GiftWalletAccount,beforePrompt:()=>void):Promise<Hash>};
// Omit gas/price/priority overrides entirely: the user's wallet estimates this
// Nitro transaction (including L1 posting), displays fees and obtains consent.
export function prayerWallet(provider:InjectedWalletProvider):PrayerWalletPort&{dispose():void}{
  const owned=injectedEvmGiftWallet(provider);
  return {current:owned.current,dispose:owned.dispose,async send(p,expected,beforePrompt){
    const actual=await owned.current();
    if(actual.chainId!==expected.chainId||actual.chainId!==p.chainId||actual.revision!==expected.revision||!same(actual.address,expected.address))throw Error('Wallet changed.');
    beforePrompt();
    const result=await provider.request({method:'eth_sendTransaction',params:[{from:actual.address,to:p.contract,data:p.data,value:'0x0',chainId:`0x${p.chainId.toString(16)}`}]});
    if(typeof result!=='string'||!validHash(result))throw Error('Uncertain submission');
    return result as Hash;
  }};
}
export function createPrayerSubmission(options:{settings:()=>ChainSettings;scope:()=>string|null;wallet:PrayerWalletPort;rpc?:(url:string,signal:AbortSignal)=>PrayerRpcPort}){
  const lifetime=new AbortController();let used=false;
  return {dispose(){lifetime.abort();},async submit(payload:PrayerPayload,onPrepared:(proof:PrayerProof)=>void):Promise<{hash:Hash;proof:PrayerProof}>{
    if(used)throw Error('Review before another attempt.');used=true;
    const config=prayerConfiguration(options.settings()),scope=options.scope();
    if(!config?.broadcast||!scope)throw Error('Prayer broadcasting is disabled.');
    const snapshot=prayerPayloadSchema.parse(payload);
    // Snapshot before the first await, not a caller-owned mutable draft.
    Object.freeze(snapshot);if(snapshot.visibility==='encrypted')Object.freeze(snapshot.encryption);
    const signal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(20000)]);
    const check=()=>{signal.throwIfAborted();const c=prayerConfiguration(options.settings());if(!c?.broadcast||c.revision!==config.revision||options.scope()!==scope)throw Error('Prayer context changed.');};
    const account=await prayerPreparationStep('wallet-unavailable',()=>options.wallet.current());check();if(account.chainId!==config.chainId)throw new PrayerPreparationError('wallet-network',account.chainId);
    const proof=proofForPrayer(options.settings(),account.address,snapshot),rpc=(options.rpc??prayerRpc)(config.rpcUrl,signal);
    if(await prayerPreparationStep('rpc-unavailable',()=>rpc.chainId())!==config.chainId)throw new PrayerPreparationError('rpc-network');
    const code=await prayerPreparationStep('rpc-unavailable',()=>rpc.code(config.contract));if(!code||keccak256(code)!==config.codeHash)throw new PrayerPreparationError('contract-code');
    const [simulated,gas]=await Promise.all([prayerPreparationStep('simulation',()=>rpc.simulate(proof)),prayerPreparationStep('gas-estimate',()=>rpc.gas(proof))]);check();
    if(simulated!==proof.recordId)throw new PrayerPreparationError('simulation');
    if(gas<=0n||gas>30_000_000n)throw new PrayerPreparationError('gas-estimate');
    if(await prayerPreparationStep('rpc-unavailable',()=>rpc.chainId())!==config.chainId)throw new PrayerPreparationError('rpc-network');
    const current=await prayerPreparationStep('wallet-unavailable',()=>options.wallet.current());check();
    if(current.revision!==account.revision||current.chainId!==account.chainId||!same(current.address,account.address))throw new PrayerPreparationError('wallet-changed');
    onPrepared(proof);check();let prompted=false;
    try{
      const hash=await options.wallet.send(proof,account,()=>{check();prompted=true;});
      // A prompt may broadcast even if the UI closes. Always preserve its hash.
      return {hash,proof};
    }catch(e){
      if(!prompted)throw Error('Preparation changed. Nothing was requested.');
      if(typeof e==='object'&&e!==null&&'code' in e&&e.code===4001)throw Error('You cancelled the wallet confirmation.');
      throw Error('Submission is uncertain. Check your wallet before resending.');
    }
  }};
}
