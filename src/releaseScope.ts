import {projectChainSettings} from './projectChainSettings';
import {releaseDataScope,scopedReleaseKey} from '../shared/releaseScope';
import type {ChainSettings} from '../shared/chainConfiguration';
export const projectDataScope=projectChainSettings.status==='valid'?releaseDataScope(projectChainSettings.config):'invalid-config';
export const releaseStorageKey=(key:string)=>scopedReleaseKey(projectDataScope,key);
export const releaseHeaders=(settings:ChainSettings=projectChainSettings)=>({'X-EK-Release':settings.status==='valid'?releaseDataScope(settings.config):'invalid-config'});
export function releaseSocketUrl(value:string){const url=new URL(value);url.searchParams.set('release',projectDataScope);return url.href;}
