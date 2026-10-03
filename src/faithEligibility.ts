import {configuredGodToken,faithHoldingEligibility,type ChainSettings} from '../shared/chainConfiguration';
import type {FaithEligibilityAdapter} from '../shared/adapters';
import {godTokenService,type GodTokenReadPort} from './godTokenService';

// Replaceable read-only preflight. A future confession/praise contract must
// also check balanceOf(msg.sender)>=10**verifiedDecimals atomically;
// UI reads are not enforcement and fractions below one whole token do not qualify.
export function faithEligibility(settings:ChainSettings,factory?:(url:string,signal:AbortSignal)=>GodTokenReadPort):FaithEligibilityAdapter {
  return {async inspect(kind,account,signal){
    signal.throwIfAborted();
    if(kind==='prayer')return {status:'eligible'};
    if(!configuredGodToken(settings))return {status:'unconfigured'};
    if(!account)return {status:'wallet-required'};
    const service=godTokenService(settings,factory),result=await service.read(signal);signal.throwIfAborted();
    if(result.status!=='available')return {status:'unconfigured'};
    const balance=await service.balance(result.token,account,signal);signal.throwIfAborted();
    const eligibility=faithHoldingEligibility(settings,kind,{token:result.token,units:balance.units});
    if(eligibility.status==='unconfigured')return {status:'unconfigured'};
    return {status:eligibility.status,account:balance.account,observedUnits:balance.units};
  }};
}
