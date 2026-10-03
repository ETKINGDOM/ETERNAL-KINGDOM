import type { Wallet, WalletAccount } from '@wallet-standard/base';
import type { StandardConnectFeature, StandardEventsFeature } from '@wallet-standard/features';
import type { SolanaSignMessageFeature } from '@solana/wallet-standard-features';
import { bytesToHex } from 'viem';
import { AUTH_CHALLENGE_TTL, AUTH_STATEMENT, type WalletAccountIdentity } from '../shared/identity';
import { SOLANA_CHAINS, solanaLoginMessage, solanaPublicKey } from '../shared/solanaIdentity';
import type { WalletChoice } from './walletIdentity';

type SolanaWallet=Wallet & {features:StandardConnectFeature & StandardEventsFeature & SolanaSignMessageFeature};
function method(value:unknown,name:string){return typeof value==='object'&&value!==null&&name in value&&typeof Reflect.get(value,name)==='function';}
export function isSolanaWallet(wallet:Wallet):wallet is SolanaWallet{
  return wallet.version==='1.0.0'&&typeof wallet.name==='string'&&wallet.name.length>0&&wallet.name.length<=100&&
    wallet.chains.some(chain=>SOLANA_CHAINS.some(supported=>supported===chain))&&
    method(wallet.features['standard:connect'],'connect')&&method(wallet.features['standard:events'],'on')&&method(wallet.features['solana:signMessage'],'signMessage')&&
    Reflect.get(wallet.features['standard:connect'] as object,'version')==='1.0.0'&&Reflect.get(wallet.features['standard:events'] as object,'version')==='1.0.0'&&
    ['1.0.0','1.1.0'].includes(Reflect.get(wallet.features['solana:signMessage'] as object,'version'));
}
function accountIdentity(account:WalletAccount,chains:readonly string[]):WalletAccountIdentity{
  const publicKey=solanaPublicKey(account.address);
  if(account.publicKey.length!==32||!publicKey.every((value,i)=>value===account.publicKey[i])||!account.features.includes('solana:signMessage'))throw new Error('Invalid Solana account');
  const chainId=SOLANA_CHAINS.find(chain=>account.chains.includes(chain)&&chains.includes(chain));
  if(!chainId)throw new Error('Unsupported Solana chain');
  return {family:'solana',address:account.address,chainId};
}
export function solanaLoginBytes(message:string,account:WalletAccountIdentity,origin:string){
  if(account.family!=='solana')throw new Error('Wrong wallet family');
  // Reconstruct the entire canonical text; appended instructions and altered
  // domain/address/statement/chain cannot enter the wallet's signing prompt.
  const nonce=message.match(/\nNonce: ([a-zA-Z0-9]{8,64})\n/)?.[1];
  const issuedAt=message.match(/\nIssued At: ([^\n]+)\n/)?.[1];
  const expirationTime=message.match(/\nExpiration Time: ([^\n]+)$/)?.[1];
  const issued=Date.parse(issuedAt??''),expires=Date.parse(expirationTime??''),now=Date.now();
  if(!nonce||!issuedAt||!expirationTime||!Number.isFinite(issued)||!Number.isFinite(expires)||issued>now+30_000||expires<=now||expires-issued>AUTH_CHALLENGE_TTL||expires<=issued||
    message!==solanaLoginMessage({...account,origin,nonce,issuedAt,expirationTime,statement:AUTH_STATEMENT}))throw new Error('Unexpected login message');
  return new TextEncoder().encode(message);
}
export function solanaWallet(wallet:SolanaWallet):WalletChoice{
  const currentAccount=()=>{const account=wallet.accounts.find(a=>a.features.includes('solana:signMessage')&&a.chains.some(c=>wallet.chains.includes(c)&&SOLANA_CHAINS.some(s=>s===c)));if(!account)throw new Error('No Solana account');accountIdentity(account,wallet.chains);return account;};
  return {id:`solana:${wallet.name}`,name:wallet.name.slice(0,50),family:'solana',provider:wallet,
    async connect(){await wallet.features['standard:connect'].connect();return accountIdentity(currentAccount(),wallet.chains);},
    async current(){return accountIdentity(currentAccount(),wallet.chains);},
    async sign(message,account,origin){
      const selected=currentAccount();if(account.family!=='solana'||selected.address!==account.address)throw new Error('Wallet changed');
      const bytes=solanaLoginBytes(message,account,origin);
      const results=await wallet.features['solana:signMessage'].signMessage({account:selected,message:bytes});
      const result=results[0];
      if(results.length!==1||!result||!(result.signature instanceof Uint8Array)||result.signature.length!==64||
        !(result.signedMessage instanceof Uint8Array)||result.signedMessage.length!==bytes.length||!bytes.every((v,i)=>v===result.signedMessage[i])||
        (result.signatureType!==undefined&&result.signatureType!=='ed25519'))throw new Error('Unexpected signed message');
      return bytesToHex(result.signature);
    },
    subscribe(changed){return wallet.features['standard:events'].on('change',properties=>{if(properties.accounts||properties.chains||properties.features)changed();});},
  };
}
