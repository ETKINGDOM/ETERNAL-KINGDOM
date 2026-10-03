import { z } from 'zod';
import { isAddress } from 'viem';
import { isSolanaAddress, SOLANA_CHAINS } from './solanaIdentity';

export const AUTH_CHALLENGE_TTL=5*60_000;
export const AUTH_SESSION_TTL=60*60_000;
export const AUTH_STATEMENT='Sign in to Eternal Kingdom. This is not a transaction and does not authorize any payment or asset access.';
const evmFields={family:z.literal('evm'),address:z.string().refine(isAddress),chainId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER)};
const solanaFields={family:z.literal('solana'),address:z.string().refine(isSolanaAddress),chainId:z.enum(SOLANA_CHAINS)};
export const walletAccountSchema=z.discriminatedUnion('family',[z.object(evmFields).strict(),z.object(solanaFields).strict()]);
export type WalletAccountIdentity=z.infer<typeof walletAccountSchema>;
export function walletAccountId(account:WalletAccountIdentity){return `${account.family}:${account.family==='evm'?account.address.toLowerCase():account.address}`;}
export function sameWalletAccount(a:WalletAccountIdentity,b:WalletAccountIdentity){return walletAccountId(a)===walletAccountId(b)&&a.chainId===b.chainId;}
const sessionFields={accountId:z.string(),expiresAt:z.number().int().positive()};
export const walletSessionSchema=z.discriminatedUnion('family',[
  z.object({...evmFields,...sessionFields}),z.object({...solanaFields,...sessionFields}),
]).refine(value=>value.accountId===walletAccountId(value));
export type WalletSession=z.infer<typeof walletSessionSchema>;
export interface IdentitySessionAdapter {
  session():Promise<WalletSession|null>;
  challenge(account:WalletAccountIdentity):Promise<{message:string;expiresAt:number}>;
  verify(signature:string):Promise<WalletSession>;
  logout():Promise<void>;
}
