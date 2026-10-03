// Public stage codes only. RPC/provider errors may contain private calldata;
// never display, retain or log their raw message/cause.
export type PrayerPreparationReason='wallet-unavailable'|'wallet-network'|'rpc-unavailable'|'rpc-network'|'contract-code'|'simulation'|'gas-estimate'|'wallet-changed';
export class PrayerPreparationError extends Error{
  constructor(readonly reason:PrayerPreparationReason,readonly walletChainId?:number){super('Prayer preparation stopped.');}
}
export async function prayerPreparationStep<T>(reason:PrayerPreparationReason,work:()=>Promise<T>):Promise<T>{
  try{return await work();}catch(error){if(error instanceof PrayerPreparationError)throw error;throw new PrayerPreparationError(reason);}
}
export function prayerPreparationMessage(error:unknown,name:string,chainId:number){
  const prefix='No transaction was requested. ';
  if(!(error instanceof PrayerPreparationError))return prefix+'Preparation stopped. Check your connected wallet and Prayer transactions. No transaction is retried automatically.';
  const messages:Record<PrayerPreparationReason,string>={
    'wallet-unavailable':'Your selected wallet is locked, disconnected or unavailable. Unlock it or reconnect in your profile; no other wallet will be used.',
    'wallet-network':`Check your EVM wallet is on ${name} (${chainId}).${error.walletChainId===undefined?'':` The selected wallet reports chain ${error.walletChainId}.`}`,
    'rpc-unavailable':'The public RPC request failed or timed out. Check this browser’s network connection; your wallet may still be connected.',
    'rpc-network':'The public RPC returned an unexpected network. Wallet connection alone cannot resolve this.',
    'contract-code':'The prayer contract code could not be verified. Do not submit to an unverified contract.',
    simulation:'The prayer contract simulation failed. Check the connection and contract; no wallet transaction prompt was opened.',
    'gas-estimate':'The public RPC could not estimate Gas. Check your RH-chain ETH balance and browser connection. This does not prove the wallet is disconnected.',
    'wallet-changed':'The submitting wallet account or network changed during preparation. Reconnect your wallet before submitting.',
  };
  return prefix+messages[error.reason];
}
