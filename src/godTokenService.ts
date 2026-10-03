import { createPublicClient, http, erc20Abi, encodeFunctionData, decodeEventLog, formatUnits, getAddress, type Address, type Hash } from 'viem';
import { evmReceivingAddressSchema } from '../shared/profile';
import { configuredGodToken, assertCurrentGodToken, godTokenDonation, type ChainSettings, type GodTokenSnapshot } from '../shared/chainConfiguration';
import { giftAmountUnits } from '../shared/gifts';

export interface GodTokenReadPort {
  chainId():Promise<number>;
  bytecode(contract:Address):Promise<string|undefined>;
  symbol(contract:Address):Promise<string>;
  decimals(contract:Address):Promise<number>;
  balance(contract:Address,account:Address):Promise<bigint>;
}
export function evmGodTokenReadPort(rpcUrl:string,signal:AbortSignal):GodTokenReadPort {
  const client=createPublicClient({ccipRead:false,transport:http(rpcUrl,{retryCount:0,timeout:8000,maxResponseBodySize:65536,fetchOptions:{signal,credentials:'omit',referrerPolicy:'no-referrer'}})});
  return {
    chainId:()=>client.getChainId(),bytecode:address=>client.getBytecode({address}),
    symbol:address=>client.readContract({address,abi:erc20Abi,functionName:'symbol'}),
    decimals:address=>client.readContract({address,abi:erc20Abi,functionName:'decimals'}),
    balance:(address,account)=>client.readContract({address,abi:erc20Abi,functionName:'balanceOf',args:[account]}),
  };
}
type Factory=(rpcUrl:string,signal:AbortSignal)=>GodTokenReadPort;
const checkAbort=(signal:AbortSignal)=>signal.throwIfAborted();
async function checkNetwork(port:GodTokenReadPort,chainId:number,signal:AbortSignal) {
  checkAbort(signal);const actual=await port.chainId();checkAbort(signal);
  if(actual!==chainId)throw new Error('The RPC network does not match project settings.');
}
export function godTokenService(settings:ChainSettings,factory:Factory=evmGodTokenReadPort) {
  return {
    async read(signal:AbortSignal):Promise<{status:'unconfigured'}|{status:'available';token:GodTokenSnapshot}> {
      if(settings.status==='invalid')throw new Error('Invalid project chain settings.');
      const configured=configuredGodToken(settings);if(!configured)return {status:'unconfigured'};
      const port=factory(configured.rpcUrl,signal);await checkNetwork(port,configured.chainId,signal);
      const code=await port.bytecode(configured.contract);checkAbort(signal);
      if(!code||code==='0x')throw new Error('No contract is deployed at the configured God token address.');
      const [symbol,decimals]=await Promise.all([port.symbol(configured.contract),port.decimals(configured.contract)]);checkAbort(signal);
      if(typeof symbol!=='string'||!symbol.trim()||symbol.length>32||/[\u0000-\u001f\u007f<>]/u.test(symbol)||!Number.isInteger(decimals)||decimals<0||decimals>36)throw new Error('Unsupported God token metadata.');
      await checkNetwork(port,configured.chainId,signal);
      return {status:'available',token:{chainId:configured.chainId,networkName:configured.networkName,contract:configured.contract,symbol,decimals,configRevision:configured.configRevision,observedAt:Date.now()}};
    },
    async balance(token:GodTokenSnapshot,account:string,signal:AbortSignal) {
      assertCurrentGodToken(settings,token);checkAbort(signal);
      const configured=configuredGodToken(settings)!;const address=evmReceivingAddressSchema.parse(account) as Address;
      const port=factory(configured.rpcUrl,signal);await checkNetwork(port,configured.chainId,signal);
      const [symbol,decimals]=await Promise.all([port.symbol(configured.contract),port.decimals(configured.contract)]);checkAbort(signal);
      if(symbol!==token.symbol||decimals!==token.decimals)throw new Error('Token metadata changed. Reopen and review the token.');
      const units=await port.balance(configured.contract,address);checkAbort(signal);
      if(typeof units!=='bigint'||units<0n||units>(1n<<256n)-1n)throw new Error('Invalid balance response.');
      await checkNetwork(port,configured.chainId,signal);
      return {units,display:formatUnits(units,token.decimals),account:address};
    },
  };
}

// Transaction preparation is real ERC-20 calldata, but not a wallet prompt or broadcast.
// Quotes must be revalidated by a transaction adapter immediately before explicit confirmation.
export function prepareGodTokenTransfer(settings:ChainSettings,token:GodTokenSnapshot,recipient:string,amount:string) {
  assertCurrentGodToken(settings,token);
  const to=evmReceivingAddressSchema.parse(recipient) as Address;
  const units=giftAmountUnits(amount,token.decimals);
  return {chainId:token.chainId,to:getAddress(token.contract),value:0n,
    data:encodeFunctionData({abi:erc20Abi,functionName:'transfer',args:[to,units]}),
    recipient:to,amount:units,token,configRevision:token.configRevision};
}
export type GodTokenTransfer=ReturnType<typeof prepareGodTokenTransfer>;
export function prepareGodTokenDonation(settings:ChainSettings,token:GodTokenSnapshot,amount:string):GodTokenTransfer {
  const destination=godTokenDonation(settings,token);
  if(!destination)throw Error('Public God token donation address is not configured.');
  // Direct ERC-20 transfer to the public project address: not an approval,
  // burn, religious-access fee or payment routed through a record contract.
  return prepareGodTokenTransfer(settings,token,destination.recipient,amount);
}
export interface GodTokenTransactionAdapter {
  prepare(transfer:GodTokenTransfer,signal:AbortSignal):Promise<{transfer:GodTokenTransfer;from:Address;gas:bigint;estimatedNetworkFee:bigint;expiresAt:number}>;
  // Implementations must check current config, payer, chain, balance and recipient publication.
  submit(confirmed:Awaited<ReturnType<GodTokenTransactionAdapter['prepare']>>):Promise<{hash:Hash;state:'pending'}>;
  receipt(hash:Hash,signal:AbortSignal):Promise<{state:'pending'|'confirmed'|'failed'|'unknown'}>;
}
export function matchingGodTokenTransferLog(transfer:GodTokenTransfer,from:Address,logs:readonly {address:string;data:`0x${string}`;topics:readonly `0x${string}`[]}[]):boolean {
  return logs.some(log=>{
    if(log.address.toLowerCase()!==transfer.to.toLowerCase())return false;
    try {
      const event=decodeEventLog({abi:erc20Abi,eventName:'Transfer',data:log.data,topics:[...log.topics] as [`0x${string}`,...`0x${string}`[]],strict:true});
      return event.args.from.toLowerCase()===from.toLowerCase()&&event.args.to.toLowerCase()===transfer.recipient.toLowerCase()&&event.args.value===transfer.amount;
    } catch {return false;}
  });
}
