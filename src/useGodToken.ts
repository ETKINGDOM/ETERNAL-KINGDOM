import { useSyncExternalStore } from 'react';
import { projectChainSettings } from './projectChainSettings';
import {createGodTokenMetadataStore} from './godTokenMetadataStore';

const metadata=createGodTokenMetadataStore(projectChainSettings);

export function useGodToken() {
  return useSyncExternalStore(metadata.subscribe,metadata.getSnapshot);
}
