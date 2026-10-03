import { createPublicClient,http,erc20Abi,TransactionReceiptNotFoundError,TransactionNotFoundError,toHex,type Address,type Hash,type Hex } from 'viem';
import { evmGodTokenReadPort,type GodTokenReadPort,type GodTokenTransfer } from './godTokenService';
import { evmReceivingAddressSchema } from '../shared/profile';
import { parseWalletChain,type InjectedWalletProvider } from './walletIdentity';

export type GiftNetworkFees={kind:'legacy';gasPrice:bigint}|{kind:'eip1559';maxFeePerGas:bigint;maxPriorityFeePerGas:bigint};
export type GiftWalletAccount={address:Address;chainId:number;revision:number};
export type GiftSendRequest={from:Address;chainId:number;walletRevision:number;to:Address;data:Hex;value:0n;gas:bigint;fees:GiftNetworkFees};
export interface EvmGiftWalletPort {
  current():Promise<GiftWalletAccount>;
  send(request:GiftSendRequest,beforePrompt:()=>void):Promise<Hash>;
}
export type GiftReceipt={hash:Hash;blockHash:Hash;blockNumber:bigint;status:'success'|'reverted';logs:readonly {address:string;data:Hex;topics:readonly Hex[]}[]};
export type GiftTransaction={hash:Hash;chainId:number|undefined;from:Address;to:Address|null;input:Hex;value:bigint;blockHash:Hash|null};
export interface EvmGiftRpcPort extends GodTokenReadPort {
  simulate(transfer:GodTokenTransfer,from:Address):Promise<boolean>;
  gas(transfer:GodTokenTransfer,from:Address):Promise<bigint>;
  fees():Promise<GiftNetworkFees>;
  nativeBalance(account:Address):Promise<bigint>;
  receipt(hash:Hash):Promise<GiftReceipt|null>;
  transaction(hash:Hash):Promise<GiftTransaction|null>;
  head():Promise<bigint>;
  blockHash(number:bigint):Promise<Hash|null>;
}
export function evmGiftRpcPort(rpcUrl:string,signal:AbortSignal):EvmGiftRpcPort {
  const client=createPublicClient({ccipRead:false,transport:http(rpcUrl,{retryCount:0,timeout:8000,maxResponseBodySize:262144,fetchOptions:{signal,credentials:'omit',referrerPolicy:'no-referrer'}})});
  const args=(t:GodTokenTransfer,account:Address)=>({address:t.to,abi:erc20Abi,functionName:'transfer' as const,args:[t.recipient,t.amount] as const,account});
  return {...evmGodTokenReadPort(rpcUrl,signal),
    simulate:async(t,account)=>(await client.simulateContract(args(t,account))).result,
    gas:(t,account)=>client.estimateContractGas(args(t,account)),
    async fees(){
      const block=await client.getBlock();
      if(block.baseFeePerGas==null){const fee=await client.estimateFeesPerGas({type:'legacy',chain:null});return {kind:'legacy',gasPrice:fee.gasPrice};}
      const fee=await client.estimateFeesPerGas({type:'eip1559',chain:null});
      return {kind:'eip1559',maxFeePerGas:fee.maxFeePerGas,maxPriorityFeePerGas:fee.maxPriorityFeePerGas};
    },nativeBalance:address=>client.getBalance({address}),
    async receipt(hash){
      try {const receipt=await client.getTransactionReceipt({hash});return {hash:receipt.transactionHash,blockHash:receipt.blockHash,blockNumber:receipt.blockNumber,status:receipt.status,logs:receipt.logs};}
      catch(error){if(error instanceof TransactionReceiptNotFoundError)return null;throw error;}
    },
    async transaction(hash){
      try {const tx=await client.getTransaction({hash});return {hash:tx.hash,chainId:tx.chainId,from:tx.from,to:tx.to,input:tx.input,value:tx.value,blockHash:tx.blockHash};}
      catch(error){if(error instanceof TransactionNotFoundError)return null;throw error;}
    },head:()=>client.getBlockNumber({cacheTime:0}),blockHash:async blockNumber=>(await client.getBlock({blockNumber})).hash,
  };
}

// Construct only for an explicitly selected EVM provider. Never connects, switches
// chains, requests approvals, signs a login message or accepts private keys.
export function injectedEvmGiftWallet(provider:InjectedWalletProvider):EvmGiftWalletPort & {dispose():void} {
  let revision=0,disposed=false;
  const changed=()=>{revision++;};const events=['accountsChanged','chainChanged','disconnect'];
  const dispose=()=>{if(disposed)return;disposed=true;revision++;for(const event of events)try{provider.removeListener(event,changed);}catch{/* Removed provider. */}};
  try {for(const event of events)provider.on(event,changed);}catch(error){dispose();throw error;}
  async function current():Promise<GiftWalletAccount> {
    if(disposed)throw new Error('The payment wallet was released.');const before=revision;
    const accounts=await provider.request({method:'eth_accounts'}),chain=await provider.request({method:'eth_chainId'});
    if(disposed||before!==revision||!Array.isArray(accounts)||!accounts.length)throw new Error('The payment wallet changed or is disconnected.');
    return {address:evmReceivingAddressSchema.parse(accounts[0]) as Address,chainId:parseWalletChain(chain),revision};
  }
  return {current,dispose,async send(request,beforePrompt){
    const account=await current();
    if(account.address.toLowerCase()!==request.from.toLowerCase()||account.chainId!==request.chainId||account.revision!==request.walletRevision)throw new Error('The payment wallet changed. Review again.');
    const fee=request.fees.kind==='legacy'?{gasPrice:toHex(request.fees.gasPrice)}:
      {maxFeePerGas:toHex(request.fees.maxFeePerGas),maxPriorityFeePerGas:toHex(request.fees.maxPriorityFeePerGas)};
    beforePrompt();
    if(disposed||revision!==account.revision)throw new Error('The payment wallet changed before the prompt.');
    const result=await provider.request({method:'eth_sendTransaction',params:[{from:request.from,to:request.to,data:request.data,value:'0x0',gas:toHex(request.gas),chainId:toHex(request.chainId),...fee}]});
    if(typeof result!=='string'||!/^0x[0-9a-fA-F]{64}$/.test(result))throw new Error('Submission may have occurred. Check your wallet; do not retry automatically.');
    return result as Hash;
  }};
}
