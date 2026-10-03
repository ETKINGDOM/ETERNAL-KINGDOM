import {keccak256,type Address,type Hex} from 'viem';
import {type ChainSettings} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
import {holderFaithReadPort,type HolderFaithReadPort} from './holderFaithReadiness';
import {prayerRpc} from './prayerChain';

export type ReadinessRow={feature:string;state:'verified'|'missing'|'failed';detail:string};
export interface ChainReadinessPort extends HolderFaithReadPort {head():Promise<bigint>}
export function chainReadinessPort(url:string,signal:AbortSignal):ChainReadinessPort {
  return {...holderFaithReadPort(url,signal),head:prayerRpc(url,signal).head};
}
// Owner diagnostics only: no account, balance, payload, simulation, wallet,
// signer, logs or writes. Success never changes a build-owned release gate.
export async function checkChainReadiness(settings:ChainSettings,signal:AbortSignal,
  factory:(url:string,signal:AbortSignal)=>ChainReadinessPort=chainReadinessPort):Promise<ReadinessRow[]>{
  signal.throwIfAborted();
  if(settings.status!=='valid'||!settings.config.network||!isRobinhoodNitroNetwork(settings.config.network))
    return [{feature:'Network',state:'failed',detail:'Valid supported Robinhood settings are required.'}];
  const c=settings.config,n=c.network!,bounded=AbortSignal.any([signal,AbortSignal.timeout(25000)]);
  const rpc=factory(n.rpcUrl,bounded),rows:ReadinessRow[]=[],codes=new Map<Address,Hex>();
  const check=()=>bounded.throwIfAborted();
  const add=(feature:string,state:ReadinessRow['state'],detail:string)=>rows.push({feature,state,detail});
  async function code(address:Address):Promise<Hex>{
    const value=await rpc.bytecode(address);check();
    if(!value||!/^0x(?:[0-9a-fA-F]{2})+$/.test(value)||value.length>49154)throw Error('Code unavailable');
    codes.set(address,value as Hex);return value as Hex;
  }
  try{
    if(await rpc.chainId()!==n.chainId)throw Error('Network mismatch');check();
    add('Network','verified',`${n.name} · Chain ID ${n.chainId}. RPC observation, not consensus proof.`);
    let metadata:{symbol:string;decimals:number}|undefined;
    if(!c.godTokenContract)add('God token','missing','God contract is not configured.');
    else try{
      const address=c.godTokenContract as Address;await code(address);
      const [symbol,decimals]=await Promise.all([rpc.symbol(address),rpc.decimals(address)]);check();
      if(typeof symbol!=='string'||!symbol.trim()||symbol.length>32||/[\u0000-\u001f\u007f<>]/u.test(symbol)||!Number.isInteger(decimals)||decimals<0||decimals>36)throw Error('Metadata unavailable');
      metadata={symbol,decimals};add('God token','verified',`Deployed ERC-20 metadata · ${decimals} decimals. Not an audit or balance check.`);
    }catch{check();add('God token','failed','Deployed token code or compatible metadata could not be verified.');}
    if(!c.faithRecords.contract||!c.faithRecords.prayerCodeHash)add('Prayer records','missing','Prayer record address and runtime pin are required.');
    else try{
      if(keccak256(await code(c.faithRecords.contract as Address))!==c.faithRecords.prayerCodeHash)throw Error('Pin mismatch');
      add('Prayer records','verified','Deployed runtime matches the configured prayer code pin.');
    }catch{check();add('Prayer records','failed','Prayer runtime could not be verified against its pin.');}
    if(!c.faithRecords.holderContract||!c.faithRecords.holderCodeHash||!c.godTokenContract)add('Confession / praise','missing','God, holder record address and bound runtime pin are required.');
    else try{
      if(!metadata)throw Error('Token unavailable');
      const address=c.faithRecords.holderContract as Address;
      if(keccak256(await code(address))!==c.faithRecords.holderCodeHash)throw Error('Pin mismatch');
      const p=await rpc.parameters(address);check();
      if(p.token.toLowerCase()!==c.godTokenContract.toLowerCase()||p.decimals!==metadata.decimals||p.minimum!==10n**BigInt(metadata.decimals))throw Error('Binding mismatch');
      add('Confession / praise','verified','Runtime pin and immutable God binding match; minimum holding is 1 whole God.');
    }catch{check();add('Confession / praise','failed','Holder runtime, God binding or whole-token threshold could not be verified.');}
    if(c.godTokenDonation.startBlock===null)add('Donation ranking','missing','A disclosed first block is required.');
    else if(!metadata||!c.godTokenDonation.recipient)add('Donation ranking','missing','Verified token metadata and a public treasury are required.');
    else try{
      const head=await rpc.head();check();
      if(typeof head!=='bigint'||head<2n||BigInt(c.godTokenDonation.startBlock)>head-2n)throw Error('Period unavailable');
      add('Donation ranking','verified','Statistics start block is within the observable three-block-depth range; no donations were scanned.');
    }catch{check();add('Donation ranking','failed','Statistics period or current block could not be verified.');}
    // Discard apparent success if the provider changes chains, code or metadata
    // while the inspection is running. No raw RPC errors escape this boundary.
    if(await rpc.chainId()!==n.chainId)throw Error('Network changed');check();
    for(const [address,original] of codes){if(await rpc.bytecode(address)!==original)throw Error('Code changed');check();}
    if(metadata&&c.godTokenContract){const [symbol,decimals]=await Promise.all([rpc.symbol(c.godTokenContract as Address),rpc.decimals(c.godTokenContract as Address)]);check();if(symbol!==metadata.symbol||decimals!==metadata.decimals)throw Error('Metadata changed');}
    return rows;
  }catch{signal.throwIfAborted();return [{feature:'Network inspection',state:'failed',detail:'Inspection unavailable, timed out or changed during reading. Nothing was enabled or sent.'}];}
}
