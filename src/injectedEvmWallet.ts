import { evmWallet, isWalletProvider, type WalletChoice } from './walletIdentity';

function read(value: unknown, key: string): unknown {
  if (typeof value !== 'object' || value === null) return undefined;
  try { return Reflect.get(value, key); } catch { return undefined; }
}
function displayName(provider: unknown): string {
  // Labels are hints only, never authentication or authorization evidence.
  if (read(provider, 'isBackpack') === true) return 'Backpack';
  if (read(provider, 'isOkxWallet') === true || read(provider, 'isOKExWallet') === true) return 'OKX Wallet';
  if (read(provider, 'isPhantom') === true) return 'Phantom';
  if (read(provider, 'isMetaMask') === true) return 'MetaMask';
  return 'Browser wallet';
}
export function discoverInjectedEvm(surface: object): WalletChoice[] {
  const ethereum = read(surface, 'ethereum');
  const candidates: Array<[string, string, unknown]> = [
    ['okx-evm', 'OKX Wallet', read(surface, 'okxwallet')],
    ['phantom-evm', 'Phantom', read(read(surface, 'phantom'), 'ethereum')],
    ['injected', displayName(ethereum), ethereum],
  ];
  const providers = read(ethereum, 'providers');
  try {
    if (Array.isArray(providers)) for (let index = 0; index < Math.min(providers.length, 24); index++) {
      const provider = read(providers, String(index));
      candidates.push([`injected:${index}`, displayName(provider), provider]);
    }
  } catch { /* A malformed router must not break separate wallets. */ }
  const choices: WalletChoice[] = [];
  for (const [id, name, provider] of candidates) {
    try {
      if (isWalletProvider(provider) && !choices.some(choice => choice.provider === provider)) choices.push(evmWallet(id, name, provider));
    } catch { /* Extension getters are untrusted. Discovery never connects. */ }
  }
  return choices.reduce(mergeEvmChoice, [] as WalletChoice[]);
}
const fallback = (wallet: WalletChoice) => /^(injected(?::|$)|okx-evm$|phantom-evm$)/.test(wallet.id);
export function mergeEvmChoice(existing: WalletChoice[], choice: WalletChoice): WalletChoice[] {
  if (existing.some(wallet => wallet.family === 'evm' && wallet.provider === choice.provider)) return existing;
  // Routers can expose a proxy of the announced provider. Prefer EIP-6963 over
  // fallback aliases for these known display labels, without merging families.
  const index = existing.findIndex(wallet => wallet.family === 'evm' &&
    ['MetaMask', 'OKX Wallet', 'Backpack', 'Phantom'].includes(choice.name) && wallet.name === choice.name && (fallback(wallet) || fallback(choice)));
  if (index >= 0) return fallback(existing[index]) && !fallback(choice) ? existing.map((wallet, position) => position === index ? choice : wallet) : existing;
  return [...existing, choice].slice(0, 24);
}
