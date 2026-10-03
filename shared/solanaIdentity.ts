import { base58 } from '@scure/base';

export const SOLANA_CHAINS=['solana:mainnet','solana:devnet','solana:testnet'] as const;
export type SolanaChain=typeof SOLANA_CHAINS[number];
export function solanaPublicKey(address:string):Uint8Array<ArrayBuffer>{
  if(!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address))throw new Error('Invalid Solana address');
  const bytes=base58.decode(address);
  if(bytes.length!==32||base58.encode(bytes)!==address)throw new Error('Invalid Solana address');
  return Uint8Array.from(bytes);
}
export function isSolanaAddress(address:string){try{solanaPublicKey(address);return true;}catch{return false;}}
export type SolanaLoginFields={origin:string;address:string;chainId:SolanaChain;nonce:string;issuedAt:string;expirationTime:string;statement:string};
// A strict, human-readable SIWS-format signMessage payload. No transaction bytes.
export function solanaLoginMessage(fields:SolanaLoginFields){
  return `${new URL(fields.origin).host} wants you to sign in with your Solana account:\n${fields.address}\n\n${fields.statement}\n\nURI: ${fields.origin}\nVersion: 1\nChain ID: ${fields.chainId}\nNonce: ${fields.nonce}\nIssued At: ${fields.issuedAt}\nExpiration Time: ${fields.expirationTime}`;
}
