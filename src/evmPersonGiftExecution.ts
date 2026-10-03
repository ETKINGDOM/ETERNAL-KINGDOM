import { formatUnits,type Address,type Hash } from 'viem';
import { configuredGodToken,type ChainSettings } from '../shared/chainConfiguration';
import { evmReceivingAddressSchema } from '../shared/profile';
import { giftRecipientResultSchema,validatedGiftRecipient,type GiftQuote,type PersonGiftExecutionAdapter,type PersonGiftRecipientAdapter,type PublishedGiftRecipient } from '../shared/gifts';
import { godTokenService,prepareGodTokenTransfer,type GodTokenTransfer } from './godTokenService';
import { verifiedGiftReceipt } from './giftReceipt';
import { evmGiftRpcPort,type EvmGiftRpcPort,type EvmGiftWalletPort,type GiftWalletAccount,type GiftNetworkFees,type GiftSendRequest } from './evmGiftPorts';

const maxUint=(1n<<256n)-1n;
const uint=(value:bigint)=>typeof value==='bigint'&&value>=0n&&value<=maxUint;
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const hash=(value:string)=>/^0x[0-9a-fA-F]{64}$/.test(value);
function cancellable<T>(work:()=>Promise<T>,signal:AbortSignal):Promise<T> {
  signal.throwIfAborted();
  return new Promise((resolve,reject)=>{
    let settled=false;
    const finish=(action:()=>void)=>{if(settled)return;settled=true;signal.removeEventListener('abort',abort);action();};
    const abort=()=>finish(()=>reject(signal.reason));
    signal.addEventListener('abort',abort,{once:true});
    Promise.resolve().then(()=>{signal.throwIfAborted();return work();}).then(value=>finish(()=>resolve(value)),error=>finish(()=>reject(error)));
  });
}
const price=(fees:GiftNetworkFees)=>fees.kind==='legacy'?fees.gasPrice:fees.maxFeePerGas;
function checkedFees(fees:GiftNetworkFees){
  if(!uint(price(fees))||fees.kind==='eip1559'&&(!uint(fees.maxPriorityFeePerGas)||fees.maxPriorityFeePerGas>fees.maxFeePerGas))throw new Error('Invalid network fee estimate.');
  return Object.freeze({...fees});
}
function recipientMatches(a:PublishedGiftRecipient,b:PublishedGiftRecipient){
  return same(a.address,b.address)&&a.revision===b.revision&&a.ownershipVerified===b.ownershipVerified&&JSON.stringify(a.target)===JSON.stringify(b.target);
}
type Internal={scope:string;settings:ChainSettings;wallet:GiftWalletAccount;transfer:GodTokenTransfer;request:GiftSendRequest;used:boolean};
export type PreparedPersonGift=GiftQuote & {payer:Address;gasLimit:bigint;feeCeiling:bigint;fees:GiftNetworkFees;nativeSymbol:string};
export function createEvmPersonGiftExecution(options:{
  settings:()=>ChainSettings;scope:()=>string|null;wallet:EvmGiftWalletPort;recipients:PersonGiftRecipientAdapter;
  rpc?:(rpcUrl:string,signal:AbortSignal)=>EvmGiftRpcPort;now?:()=>number;
  // Default OFF. Explicit test-release approval must supply true. Mainnet stays rejected.
  allowTestnetBroadcast?:boolean;
}):Omit<PersonGiftExecutionAdapter,'prepare'> & {
  prepare(input:Parameters<PersonGiftExecutionAdapter['prepare']>[0],signal:AbortSignal):Promise<PreparedPersonGift>;
  dispose():void;
} {
  const quotes=new Map<GiftQuote,Internal>(),transactions=new Map<string,Internal>();
  const lifetime=new AbortController(),rpcFactory=options.rpc??evmGiftRpcPort,now=options.now??Date.now;
  const signal=(caller?:AbortSignal)=>AbortSignal.any([lifetime.signal,...(caller?[caller]:[]),AbortSignal.timeout(20000)]);
  function configured(){
    lifetime.signal.throwIfAborted();const settings=options.settings(),token=configuredGodToken(settings);
    if(!token||settings.status!=='valid'||!settings.config.network)throw new Error('God token/network not configured.');
    if(!settings.config.network.testnet)throw new Error('Mainnet gifts are not enabled.');
    if(settings.config.network.executionFeeModel!=='standard-evm')throw new Error('This network fee model needs a dedicated adapter.');
    return {settings,token,network:settings.config.network};
  }
  const requireScope=()=>{const scope=options.scope();if(!scope)throw new Error('The selected person/payment session is no longer active.');return scope;};
  async function readWallet(cancellation:AbortSignal):Promise<GiftWalletAccount> {
    const value=await cancellable(()=>options.wallet.current(),cancellation);cancellation.throwIfAborted();
    if(!Number.isSafeInteger(value.chainId)||value.chainId<1||!Number.isSafeInteger(value.revision)||value.revision<0)throw new Error('Invalid payment wallet state.');
    return {address:evmReceivingAddressSchema.parse(value.address) as Address,chainId:value.chainId,revision:value.revision};
  }
  async function context(internal:Internal,cancellation:AbortSignal){
    cancellation.throwIfAborted();const current=configured();
    if(current.token.configRevision!==internal.transfer.configRevision||requireScope()!==internal.scope)throw new Error('Gift context changed.');
    const wallet=await readWallet(cancellation);
    if(wallet.chainId!==internal.wallet.chainId||!same(wallet.address,internal.wallet.address)||wallet.revision!==internal.wallet.revision)throw new Error('Payment wallet changed.');
    return rpcFactory(current.token.rpcUrl,cancellation);
  }
  async function recipient(expected:PublishedGiftRecipient,cancellation:AbortSignal){
    if(expected.target.kind!=='wallet')throw new Error('Guest gift publication is not connected.');
    const actual=validatedGiftRecipient(expected.target,await options.recipients.lookup(expected.target,cancellation));cancellation.throwIfAborted();
    if(actual.status!=='available'||!recipientMatches(expected,actual))throw new Error('Recipient settings changed or are no longer published.');
  }
  async function inspect(internal:Internal,cancellation:AbortSignal){
    const rpc=await context(internal,cancellation);const {transfer,wallet}=internal;
    const observed=await godTokenService(internal.settings,()=>rpc).read(cancellation);
    if(observed.status!=='available'||observed.token.decimals!==transfer.token.decimals||observed.token.symbol!==transfer.token.symbol)throw new Error('God token changed.');
    const [balance,simulated,gas,fees,native]=await Promise.all([
      rpc.balance(transfer.to,wallet.address),rpc.simulate(transfer,wallet.address),rpc.gas(transfer,wallet.address),rpc.fees(),rpc.nativeBalance(wallet.address),
    ]);cancellation.throwIfAborted();
    if(!uint(balance)||balance<transfer.amount)throw new Error('Insufficient God token balance.');
    if(simulated!==true)throw new Error('The token transfer simulation did not succeed.');
    if(!uint(gas)||gas===0n||gas>30_000_000n)throw new Error('Unsupported Gas estimate.');
    const checked=checkedFees(fees),gasLimit=(gas*120n+99n)/100n,feeCeiling=gasLimit*price(checked);
    if(!uint(feeCeiling)||!uint(native)||native<feeCeiling)throw new Error('Insufficient native balance for the estimated fee ceiling.');
    return {gasLimit,fees:checked,feeCeiling,native};
  }
  async function validate(quote:GiftQuote,internal:Internal,cancellation:AbortSignal){
    if(now()>=quote.expiresAt)throw new Error('The quote expired.');
    await recipient(quote.recipient,cancellation);
    const fresh=await inspect(internal,cancellation),old=internal.request.fees;
    if(fresh.gasLimit>internal.request.gas||fresh.fees.kind!==old.kind||price(fresh.fees)>price(old)||fresh.native<internal.request.gas*price(old)||
      fresh.fees.kind==='eip1559'&&old.kind==='eip1559'&&fresh.fees.maxPriorityFeePerGas>old.maxPriorityFeePerGas)throw new Error('Network fees changed. Review a new quote.');
    // Recheck live publication AFTER slow RPC calls, then account/scope/expiry immediately before prompting.
    await recipient(quote.recipient,cancellation);await context(internal,cancellation);
    if(now()>=quote.expiresAt)throw new Error('The quote expired.');
  }
  return {
    dispose(){lifetime.abort();quotes.clear();transactions.clear();},
    async prepare(input,caller){
      const cancellation=signal(caller),current=configured(),scope=requireScope();
      cancellation.throwIfAborted();const amount=input.amount,requestedAsset={...input.asset};
      if(!uint(amount)||amount===0n)throw new Error('Invalid gift amount.');
      const parsed=giftRecipientResultSchema.parse(input.recipient);if(parsed.status!=='available')throw new Error('Recipient is not published.');
      await recipient(parsed,cancellation);
      const wallet=await readWallet(cancellation);
      if(wallet.chainId!==current.token.chainId)throw new Error('Select the configured test network in your EVM wallet.');
      if(same(wallet.address,parsed.address)||same(parsed.address,current.token.contract))throw new Error('Choose a different receiving address.');
      const rpc=rpcFactory(current.token.rpcUrl,cancellation),observed=await godTokenService(current.settings,()=>rpc).read(cancellation);
      if(observed.status!=='available')throw new Error('Token unavailable.');
      const asset=observed.token;
      if(requestedAsset.chainId!==asset.chainId||!same(requestedAsset.contract,asset.contract)||requestedAsset.symbol!==asset.symbol||requestedAsset.decimals!==asset.decimals||
        requestedAsset.configRevision!==asset.configRevision||requestedAsset.networkName!==asset.networkName)throw new Error('The configured token changed.');
      const transfer=prepareGodTokenTransfer(current.settings,asset,parsed.address,formatUnits(amount,asset.decimals));
      const internal:Internal={scope,settings:current.settings,wallet,transfer,used:false,request:{} as GiftSendRequest};
      const estimate=await inspect(internal,cancellation);
      internal.request={from:wallet.address,chainId:asset.chainId,walletRevision:wallet.revision,to:transfer.to,data:transfer.data,value:0n,gas:estimate.gasLimit,fees:estimate.fees};
      Object.freeze(asset);Object.freeze(transfer);Object.freeze(wallet);Object.freeze(internal.request);
      Object.freeze(parsed.target);Object.freeze(parsed);
      const quote:PreparedPersonGift=Object.freeze({id:crypto.randomUUID(),recipient:parsed,asset,amount,estimatedGas:estimate.gasLimit.toString(),expiresAt:now()+60000,
        payer:wallet.address,gasLimit:estimate.gasLimit,feeCeiling:estimate.feeCeiling,fees:estimate.fees,nativeSymbol:current.network.nativeSymbol});
      await recipient(parsed,cancellation);await context(internal,cancellation);
      if(quotes.size>=4)quotes.delete(quotes.keys().next().value!);quotes.set(quote,internal);return quote;
    },
    async revalidate(quote,caller){
      const cancellation=signal(caller),internal=quotes.get(quote);cancellation.throwIfAborted();
      if(!internal||internal.used)return 'changed';
      try {await validate(quote,internal,cancellation);return 'unchanged';}
      catch(error){if(cancellation.aborted)throw error;return 'changed';}
    },
    async submit(quote){
      if(!options.allowTestnetBroadcast)throw new Error('Testnet gift broadcasting is not enabled.');
      const internal=quotes.get(quote);if(!internal||internal.used)throw new Error('Review a new quote; this confirmation cannot be reused.');
      if(transactions.size>=64)throw new Error('Too many tracked transfers in this session.');
      // Consume BEFORE awaiting to prevent simultaneous confirmations/retries.
      internal.used=true;const cancellation=signal();await validate(quote,internal,cancellation);cancellation.throwIfAborted();
      let prompted=false,transactionHash:Hash;
      try {
        transactionHash=await options.wallet.send(internal.request,()=>{
          cancellation.throwIfAborted();const current=configured();
          if(current.token.configRevision!==internal.transfer.configRevision||requireScope()!==internal.scope||now()>=quote.expiresAt)throw new Error('Gift context changed before the wallet prompt.');
          prompted=true;
        });
      } catch(error){
        if(!prompted)throw error;
        if(typeof error==='object'&&error!==null&&'code' in error&&error.code===4001)throw new Error('You cancelled the wallet confirmation. Review again before any new attempt.');
        throw new Error('Submission is uncertain. Check your wallet; do not retry automatically.');
      }
      // After a prompt has opened, cancellation cannot recall a broadcast. Preserve its hash.
      if(!hash(transactionHash)||transactions.has(transactionHash.toLowerCase()))throw new Error('Submission is uncertain. Check your wallet; do not retry automatically.');
      if(!lifetime.signal.aborted)transactions.set(transactionHash.toLowerCase(),internal);
      return {transactionHash};
    },
    async receipt(chainId,transactionHash,caller){
      const cancellation=signal(caller);cancellation.throwIfAborted();
      const internal=transactions.get(transactionHash.toLowerCase());
      if(!hash(transactionHash)||!internal||chainId!==internal.transfer.chainId)return {status:'unknown'};
      const token=configuredGodToken(internal.settings)!;
      return verifiedGiftReceipt(rpcFactory(token.rpcUrl,cancellation),internal.transfer,internal.wallet.address,transactionHash as Hash,cancellation);
    },
  };
}
