import {getAddress,keccak256,toHex} from 'viem';
import approved from './approvedFaithRuntime.json' with {type:'json'};
// Frozen compiler output from the reviewed append-only contract. CA/precision
// are the only variable words. An arbitrary owner-supplied pin is not accepted.
export const approvedPrayerCodeHash=approved.prayerCodeHash;
export function approvedHolderCodeHash(token:string,decimals:number){
  const address=getAddress(token);
  if(/^0x0{40}$/i.test(address)||!Number.isInteger(decimals)||decimals<0||decimals>36)throw Error('Invalid holder binding');
  const values={godToken:toHex(BigInt(address),{size:32}),tokenDecimals:toHex(decimals,{size:32}),minimumHolding:toHex(10n**BigInt(decimals),{size:32})};
  let runtime=approved.holderRuntimeTemplate;
  for(const name of Object.keys(values) as (keyof typeof values)[])for(const {start,length} of approved.immutableReferences[name]){
    const at=2+start*2;runtime=runtime.slice(0,at)+values[name].slice(2)+runtime.slice(at+length*2);
  }
  return keccak256(runtime as `0x${string}`);
}
