import { bytesToHex } from 'viem';
import type { WalletAccountIdentity } from '../shared/identity';
import { solanaPublicKey } from '../shared/solanaIdentity';
import { solanaLoginBytes } from './solanaWallet';
import type { WalletChoice } from './walletIdentity';

export interface InjectedSolanaProvider {
  readonly publicKey: unknown;
  readonly isConnected: boolean;
  connect(): Promise<unknown>;
  signMessage(message: Uint8Array, display: 'utf8'): Promise<unknown>;
  on(event: string, callback: () => void): void;
  removeListener(event: string, callback: () => void): void;
}
export function isInjectedSolanaProvider(value: unknown): value is InjectedSolanaProvider {
  if (typeof value !== 'object' || value === null) return false;
  try { return ['connect', 'signMessage', 'on', 'removeListener'].every(name => typeof Reflect.get(value, name) === 'function') &&
    typeof Reflect.get(value, 'isConnected') === 'boolean'; } catch { return false; }
}
export function injectedSolanaAddress(key: unknown): string {
  let value: unknown = key;
  if (typeof key === 'object' && key !== null) {
    if ('toBase58' in key && typeof key.toBase58 === 'function') value = key.toBase58();
    else if ('toString' in key && typeof key.toString === 'function') value = key.toString();
  }
  if (typeof value !== 'string') throw new Error('Invalid Solana public key');
  const bytes = solanaPublicKey(value);
  if (typeof key === 'object' && key !== null && 'toBytes' in key && typeof key.toBytes === 'function') {
    const supplied: unknown = key.toBytes();
    if (!(supplied instanceof Uint8Array) || supplied.length !== 32 || !bytes.every((byte, index) => supplied[index] === byte)) throw new Error('Inconsistent Solana public key');
  }
  return value;
}
export function injectedSolanaWallet(id: string, name: string, provider: InjectedSolanaProvider): WalletChoice {
  const current = async (): Promise<WalletAccountIdentity> => {
    if (!provider.isConnected) throw new Error('Solana wallet not connected');
    // Scope for offchain login only, not detected RPC network or a chain switch.
    return { family: 'solana', address: injectedSolanaAddress(provider.publicKey), chainId: 'solana:mainnet' };
  };
  return {
    id, name, family: 'solana', provider, current,
    async connect() { await provider.connect(); return current(); },
    async sign(message, account, origin) {
      const before = await current();
      if (account.family !== 'solana' || account.chainId !== before.chainId || before.address !== account.address) throw new Error('Wallet changed');
      const expected = solanaLoginBytes(message, account, origin);
      const result = await provider.signMessage(expected.slice(), 'utf8');
      const signature: unknown = result instanceof Uint8Array ? result : typeof result === 'object' && result !== null && 'signature' in result ? result.signature : null;
      if (!(signature instanceof Uint8Array) || signature.length !== 64) throw new Error('Invalid Solana signature');
      if (!(result instanceof Uint8Array) && typeof result === 'object' && result !== null) {
        if ('publicKey' in result && injectedSolanaAddress(result.publicKey) !== account.address) throw new Error('Unexpected signing account');
        if ('signedMessage' in result && (!(result.signedMessage instanceof Uint8Array) || result.signedMessage.length !== expected.length || !expected.every((byte, index) => result.signedMessage instanceof Uint8Array && byte === result.signedMessage[index]))) throw new Error('Modified signing text');
      }
      if ((await current()).address !== account.address) throw new Error('Wallet changed');
      // The server always verifies the original challenge bytes, including when
      // legacy providers return only a signature and cannot echo signedMessage.
      return bytesToHex(signature);
    },
    subscribe(changed) {
      const events = ['accountChanged', 'disconnect', 'chainChanged'];
      const clear = () => { for (const event of events) try { provider.removeListener(event, changed); } catch { /* Removed provider. */ } };
      try { for (const event of events) provider.on(event, changed); } catch (error) { clear(); throw error; }
      return clear;
    },
  };
}

// Capability-checked known injection points. Brand flags/names are display-only.
export function discoverInjectedSolana(surface: object): WalletChoice[] {
  const choices: WalletChoice[] = [];
  const read = (object: object, key: string): unknown => { try { return Reflect.get(object, key); } catch { return undefined; } };
  const phantom = read(surface, 'phantom');
  const okx = read(surface, 'okxwallet'), xnft = read(surface, 'xnft');
  const candidates: Array<[string, string, unknown]> = [
    ['solana-injected:phantom', 'Phantom', typeof phantom === 'object' && phantom !== null ? read(phantom, 'solana') : undefined],
    ['solana-injected:solflare', 'Solflare', read(surface, 'solflare')],
    ['solana-injected:okx', 'OKX Wallet', typeof okx === 'object' && okx !== null ? read(okx, 'solana') : undefined],
    ['solana-injected:backpack', 'Backpack', read(surface, 'backpack')],
    ['solana-injected:backpack-xnft', 'Backpack', typeof xnft === 'object' && xnft !== null ? read(xnft, 'solana') : undefined],
    ['solana-injected:browser', 'Solana browser wallet', read(surface, 'solana')],
  ];
  for (const [id, name, value] of candidates) {
    try { if (isInjectedSolanaProvider(value) && !choices.some(choice => choice.provider === value)) choices.push(injectedSolanaWallet(id, name, value)); } catch { /* Malformed injection ignored. */ }
  }
  return choices;
}
export function mergeSolanaChoice(existing: WalletChoice[], choice: WalletChoice): WalletChoice[] {
  if (existing.some(wallet => wallet.provider === choice.provider)) return existing;
  const sameName = (wallet: WalletChoice) => wallet.family === 'solana' && wallet.name.toLowerCase() === choice.name.toLowerCase();
  if (choice.id.startsWith('solana-injected:') && existing.some(wallet => sameName(wallet) && !wallet.id.startsWith('solana-injected:'))) return existing;
  return [...existing.filter(wallet => !(sameName(wallet) && wallet.id.startsWith('solana-injected:'))), choice].slice(0, 24);
}
