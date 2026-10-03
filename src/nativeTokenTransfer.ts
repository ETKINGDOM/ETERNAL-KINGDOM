import {erc20Abi,decodeEventLog,keccak256,type Address,type Hash,type Hex} from 'viem';
import {assertCurrentGodToken,configuredGodToken,godTokenSnapshotSchema,chainBroadcast,type ChainSettings,type GodTokenSnapshot} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import {giftRecipientResultSchema,validatedGiftRecipient,type PublishedGiftRecipient,type PersonGiftRecipientAdapter} from '../shared/gifts';
import {godTokenService,prepareGodTokenDonation,prepareGodTokenTransfer,type GodTokenTransfer} from './godTokenService';
import {evmGiftRpcPort,type EvmGiftRpcPort} from './evmGiftPorts';
import type {PrayerWalletPort} from './prayerChain';

export type TokenDestination={kind:'donation'}|{kind:'gift';recipient:PublishedGiftRecipient;recipients:PersonGiftRecipientAdapter};
export type NativeTokenProof={kind:'donation'|'gift';rpcUrl:string;network:string;payer:Address;codeHash:Hash;transfer:GodTokenTransfer};
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
export function nativeTokenConfiguration(settings:ChainSettings,kind:TokenDestination['kind']){
  if(settings.status!=='valid')return null;const n=settings.config.network,c=configuredGodToken(settings);
  if(!c||!isRobinhoodNitroNetwork(n))return null;
  return {...c,broadcast:chainBroadcast(settings,kind==='gift'?'gifts':'donations'),
    recipient:kind==='donation'?settings.config.godTokenDonation.recipient:null};
}
// Dedicated Nitro path. The wallet owns fee estimation and consent. No gas-price
// ceiling, fee override, ERC20 allowance, burn or login signature is supplied.
export function createNativeTokenSubmission(options:{settings:()=>ChainSettings;scope:()=>string|null;wallet:PrayerWalletPort;rpc?:(url:string,signal:AbortSignal)=>EvmGiftRpcPort}){
  const lifetime=new AbortController();let used=false;
  return {dispose(){lifetime.abort();},async submit(input:{token:GodTokenSnapshot;amount:string;destination:TokenDestination},prepared:(proof:NativeTokenProof)=>void){
    if(used)throw Error('Review before another attempt.');used=true;
    const settings=options.settings(),config=nativeTokenConfiguration(settings,input.destination.kind),scope=options.scope();
    if(!config?.broadcast||!scope)throw Error('Token transfers are disabled.');
    const token=Object.freeze(godTokenSnapshotSchema.parse(input.token));assertCurrentGodToken(settings,token);
    const kind=input.destination.kind;
    const recipient=kind==='gift'?giftRecipientResultSchema.parse((input.destination as Extract<TokenDestination,{kind:'gift'}>).recipient):null;
    if(recipient&&recipient.status!=='available')throw Error('Receiving settings unavailable.');
    const publication=recipient?.status==='available'?Object.freeze({...recipient,target:Object.freeze({...recipient.target})}):null;
    if(kind==='gift'&&publication?.target.kind!=='wallet')throw Error('Guest publication is not enabled.');
    const recipientAdapter=kind==='gift'?(input.destination as Extract<TokenDestination,{kind:'gift'}>).recipients:null;
    const transfer=kind==='donation'?prepareGodTokenDonation(settings,token,input.amount):prepareGodTokenTransfer(settings,token,publication!.address,input.amount);
    Object.freeze(transfer);
    const signal=AbortSignal.any([lifetime.signal,AbortSignal.timeout(20000)]);
    const check=()=>{signal.throwIfAborted();const current=nativeTokenConfiguration(options.settings(),kind);if(!current?.broadcast||current.configRevision!==config.configRevision||options.scope()!==scope)throw Error('Transfer context changed.');};
    const checkRecipient=async()=>{
      if(!publication||!recipientAdapter)return;
      const value=validatedGiftRecipient(publication.target,await recipientAdapter.lookup(publication.target,signal));check();
      if(value.status!=='available'||!same(value.address,publication.address)||value.revision!==publication.revision||value.ownershipVerified!==publication.ownershipVerified)throw Error('Receiving settings changed. Refresh before another attempt.');
    };
    const account=await options.wallet.current();check();
    if(account.chainId!==config.chainId)throw Error('Select the configured network in your wallet.');
    if(same(account.address,transfer.recipient)||same(transfer.to,transfer.recipient))throw Error('Self or token-contract transfers are not supported.');
    const rpc=(options.rpc??evmGiftRpcPort)(config.rpcUrl,signal);
    const metadata=async()=>{
      const value=await godTokenService(settings,()=>rpc).read(signal);check();
      if(value.status!=='available'||value.token.symbol!==token.symbol||value.token.decimals!==token.decimals)throw Error('Token metadata changed.');
    };
    await metadata();const code=await rpc.bytecode(transfer.to);check();
    if(!code||!/^0x(?:[0-9a-fA-F]{2})+$/.test(code))throw Error('Token code is unavailable.');const codeHash=keccak256(code as Hex);
    await checkRecipient();
    const [balance,simulation,gas]=await Promise.all([rpc.balance(transfer.to,account.address),rpc.simulate(transfer,account.address),rpc.gas(transfer,account.address)]);check();
    if(typeof balance!=='bigint'||balance<transfer.amount||balance>=(1n<<256n)||simulation!==true||gas<=0n||gas>30_000_000n)throw Error('Transfer checks failed.');
    await metadata();await checkRecipient();
    const finalCode=await rpc.bytecode(transfer.to);check();if(!finalCode||keccak256(finalCode as Hex)!==codeHash)throw Error('Token code changed.');
    if(await rpc.chainId()!==transfer.chainId)throw Error('RPC network changed.');check();
    const current=await options.wallet.current();check();if(current.chainId!==account.chainId||current.revision!==account.revision||!same(current.address,account.address))throw Error('Wallet changed.');
    const proof:NativeTokenProof=Object.freeze({kind,rpcUrl:config.rpcUrl,network:config.networkName,payer:account.address,codeHash,transfer});
    prepared(proof);check();let prompted=false;
    try{
      const hash=await options.wallet.send({chainId:transfer.chainId,contract:transfer.to,data:transfer.data},account,()=>{check();prompted=true;});
      if(!/^0x[0-9a-fA-F]{64}$/.test(hash))throw Error('Uncertain submission');
      return {hash,proof}; // Preserve late hash even after composer closure.
    }catch(e){
      if(!prompted)throw Error('Preparation changed. Nothing was requested.');
      if(typeof e==='object'&&e!==null&&'code' in e&&e.code===4001)throw Error('You cancelled the wallet confirmation.');
      throw Error('Submission is uncertain. Check your wallet before resending.');
    }
  }};
}
export async function verifyNativeTokenReceipt(rpc:EvmGiftRpcPort,p:NativeTokenProof,hash:Hash,signal:AbortSignal){
  signal.throwIfAborted();if(!/^0x[0-9a-fA-F]{64}$/.test(hash))return {status:'unknown' as const};
  try{
    if(await rpc.chainId()!==p.transfer.chainId)return {status:'unknown' as const};
    const receipt=await rpc.receipt(hash);signal.throwIfAborted();if(!receipt)return {status:'pending' as const};
    const tx=await rpc.transaction(hash);signal.throwIfAborted();
    if(!tx||!same(tx.hash,hash)||!same(receipt.hash,hash)||tx.chainId!==p.transfer.chainId||!same(tx.from,p.payer)||!tx.to||!same(tx.to,p.transfer.to)||
      !same(tx.input,p.transfer.data)||tx.value!==0n||!tx.blockHash||!same(tx.blockHash,receipt.blockHash)||!/^0x[0-9a-fA-F]{64}$/.test(receipt.blockHash)||receipt.blockNumber<0n)return {status:'unknown' as const};
    const [code,head,block]=await Promise.all([rpc.bytecode(p.transfer.to),rpc.head(),rpc.blockHash(receipt.blockNumber)]);signal.throwIfAborted();
    if(!code||keccak256(code as Hex)!==p.codeHash)return {status:'unknown' as const};
    if(!block||!same(block,receipt.blockHash)||head<receipt.blockNumber||head-receipt.blockNumber+1n<3n)return {status:'pending' as const};
    if(receipt.status==='reverted')return {status:'failed' as const};
    if(receipt.status!=='success')return {status:'unknown' as const};
    const events=receipt.logs.filter(l=>same(l.address,p.transfer.to)&&same(l.topics[0]??'', '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'));
    if(events.length!==1)return {status:'unknown' as const};
    const event=decodeEventLog({abi:erc20Abi,eventName:'Transfer',data:events[0].data,topics:[...events[0].topics] as [Hex,...Hex[]],strict:true});
    if(!same(event.args.from,p.payer)||!same(event.args.to,p.transfer.recipient)||event.args.value!==p.transfer.amount)return {status:'unknown' as const};
    const finalBlock=await rpc.blockHash(receipt.blockNumber);signal.throwIfAborted();
    if(await rpc.chainId()!==p.transfer.chainId)return {status:'unknown' as const};signal.throwIfAborted();
    return {status:finalBlock&&same(finalBlock,receipt.blockHash)?'confirmed' as const:'pending' as const};
  }catch(e){if(signal.aborted)throw e;return {status:'unknown' as const};}
}
