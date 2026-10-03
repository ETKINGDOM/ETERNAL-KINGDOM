import {chainBroadcast,type ChainSettings} from '../shared/chainConfiguration';
import {isRobinhoodNitroNetwork} from '../shared/robinhoodNetwork';
export type ChainSetupRow={feature:string;state:'missing'|'disabled'|'configured'|'invalid';missing:string[]};
// Build-owned status, no RPC/wallet access and no persisted player settings.
// Configured is deliberately NOT deployed, audited or verified live.
export function chainSetup(settings:ChainSettings):ChainSetupRow[]{
  if(settings.status!=='valid')return [{feature:'Project chain settings',state:'invalid',missing:['Valid chain.json']}];
  const c=settings.config,n=c.network;
  const base=isRobinhoodNitroNetwork(n)?[]:['Supported Robinhood network'];
  function row(feature:string,checks:[boolean,string][],enabled=true,requiredNetwork=base):ChainSetupRow{
    const missing=[...requiredNetwork,...checks.filter(([ok])=>!ok).map(([,label])=>label)];
    return {feature,state:missing.length?'missing':enabled?'configured':'disabled',missing};
  }
  return [
    // Settings supplied is not a successful RPC check or a live deployment.
    row('God token balance',[[Boolean(c.godTokenContract),'God token contract']],true,n?[]:['God token network']),
    row('Prayer records',[[Boolean(c.faithRecords.contract),'Prayer record contract'],[Boolean(c.faithRecords.prayerCodeHash),'Prayer runtime code hash']],chainBroadcast(settings,'prayers')),
    row('Confession / praise · holding at least 1',[[Boolean(c.godTokenContract),'God token contract'],[Boolean(c.faithRecords.holderContract),'Token-bound holder record contract'],[Boolean(c.faithRecords.holderCodeHash),'Holder runtime code hash']],chainBroadcast(settings,'holderFaith')),
    row('Person gifts',[[Boolean(c.godTokenContract),'God token contract']],chainBroadcast(settings,'gifts')),
    row('Project donations',[[Boolean(c.godTokenContract),'God token contract'],[Boolean(c.godTokenDonation.recipient),'Public project treasury']],chainBroadcast(settings,'donations')),
    row('Donation ranking',[[Boolean(c.godTokenContract),'God token contract'],[Boolean(c.godTokenDonation.recipient),'Public project treasury'],[c.godTokenDonation.startBlock!==null,'Ranking first block']]),
  ];
}
