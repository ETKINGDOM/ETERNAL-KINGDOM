import {z} from 'zod';
import {createBase58check} from '@scure/base';
import {sha256} from 'viem';
import {isSolanaAddress} from './solanaIdentity';
import type {ChainSettings} from './chainConfiguration';
import {GOD_TOKEN_NAME} from './godTokenPresentation';

const bitcoinBase58=createBase58check((bytes:Uint8Array)=>sha256(bytes,'bytes'));
// Bitcoin mainnet legacy addresses only; other address families need their own codec.
export const bitcoinDonationAddressSchema=z.string().max(35).refine(address=>{
  try{const payload=bitcoinBase58.decode(address);return payload.length===21&&(payload[0]===0||payload[0]===5)&&bitcoinBase58.encode(payload)===address;}
  catch{return false;}
},'Invalid Bitcoin mainnet Base58Check address.');
export const nativeDonationAddressesSchema=z.object({
  bitcoin:bitcoinDonationAddressSchema.nullable(),
  solana:z.string().max(44).refine(isSolanaAddress,'Invalid Solana address.').nullable(),
}).strict();
export type PublicDonationAddress={kind:'evm'|'btc'|'sol'|'god-token';label:string;address:string|null};
// One EVM treasury source, two explicit labels. Never infer a token contract or network.
export function publicDonationAddresses(settings:ChainSettings):PublicDonationAddress[]{
  const c=settings.status==='valid'?settings.config:null;
  const evm=c?.godTokenDonation.recipient??null;
  return [
    {kind:'evm',label:'EVM donation address',address:evm},
    {kind:'btc',label:'BTC donation address',address:c?.nativeDonationAddresses.bitcoin??null},
    {kind:'sol',label:'SOL donation address',address:c?.nativeDonationAddresses.solana??null},
    {kind:'god-token',label:`${GOD_TOKEN_NAME} donation address · EVM`,address:evm},
  ];
}
