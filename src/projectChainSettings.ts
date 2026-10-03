import raw from '#ek-chain-settings' with {type:'json'};
import { resolveChainSettings } from '../shared/chainConfiguration';

// Project-owned configuration, not player-controlled localStorage or URL input.
// No private keys/API secrets: this entire file is bundled into the public client.
export const projectChainSettings=resolveChainSettings(raw);
