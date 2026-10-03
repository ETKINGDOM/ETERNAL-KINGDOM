import {sameWalletAccount,type WalletAccountIdentity} from '../shared/identity';
import type {WalletChoice} from './walletIdentity';
import type {PrayerWalletPort} from './prayerChain';
import {PrayerPreparationError} from './prayerPreparation';
import {sameWalletAddress} from './walletNetwork';

// A connected EVM identity pins the provider. Never guess its signer from a
// brand label, saved address or discovery order, including during restoration.
export function submissionWallet(wallets:WalletChoice[],preferred:WalletChoice|undefined,account:WalletAccountIdentity|undefined,choiceId:string){
  const evm=wallets.filter(wallet=>wallet.family==='evm');
  const locked=account?.family==='evm'||preferred?.family==='evm';
  return {evm,locked,wallet:locked?(preferred?.family==='evm'?preferred:undefined):evm.find(wallet=>wallet.id===choiceId)??evm[0]};
}
// Faith composers use an actual connected provider only. Discovered extensions
// and saved receiving addresses are not a connection or a signing authority.
// Explicit separate-payer selection remains available to other/future clients.
export function connectedFaithWallet(wallets:WalletChoice[],preferred:WalletChoice|undefined,account:WalletAccountIdentity|undefined){
  const selection=submissionWallet(wallets,preferred,account,'');
  return {...selection,wallet:selection.locked?selection.wallet:undefined};
}
export function faithWalletConnectionNotice(account:WalletAccountIdentity|undefined){
  return account?.family==='evm'
    ?'Reconnect your EVM wallet in your profile to submit.'
    :account?.family==='solana'
      ?'No EVM wallet connected. Connect an EVM wallet in your profile to submit on Robinhood Chain.'
      :'No wallet connected. Connect an EVM wallet in your profile to submit.';
}
export function assertSubmissionAccount(actual:WalletAccountIdentity,expected:WalletAccountIdentity|undefined){
  if(expected?.family==='evm'&&!sameWalletAccount(actual,expected))throw new PrayerPreparationError('wallet-changed');
}
// Before the explicitly requested RH switch, only the address must match the
// connected identity. The execution port below still binds address AND chain.
export function assertSubmissionAddress(actual:WalletAccountIdentity,expected:WalletAccountIdentity|undefined){
  if(expected?.family==='evm'&&!sameWalletAddress(actual,expected))throw new PrayerPreparationError('wallet-changed');
}
export function boundSubmissionWallet(port:PrayerWalletPort,account:WalletAccountIdentity|undefined):PrayerWalletPort{
  const expected=account?{...account}:undefined;
  return {async current(){const actual=await port.current();assertSubmissionAccount({family:'evm',address:actual.address,chainId:actual.chainId},expected);return actual;},
    async send(proof,payer,beforePrompt){assertSubmissionAccount({family:'evm',address:payer.address,chainId:payer.chainId},expected);return port.send(proof,payer,beforePrompt);}};
}
