import {configuredGodToken,type ChainSettings,type GodTokenSnapshot} from '../shared/chainConfiguration';
import {godTokenService} from './godTokenService';
export type GodTokenMetadataState={status:'loading'|'unconfigured'|'error'|'available';token?:GodTokenSnapshot};
// Share one on-demand metadata read between mounted God panels. Never persist,
// poll, cache personal balances, or reuse metadata after the last panel closes.
// Transaction adapters still independently revalidate before every wallet prompt.
export function createGodTokenMetadataStore(settings:ChainSettings,
  read:(signal:AbortSignal)=>Promise<{status:'unconfigured'}|{status:'available';token:GodTokenSnapshot}>=signal=>godTokenService(settings).read(signal)){
  const initial=():GodTokenMetadataState=>({status:settings.status==='invalid'?'error':configuredGodToken(settings)?'loading':'unconfigured'});
  let state=initial(),controller:AbortController|null=null,generation=0;
  const listeners=new Set<()=>void>();
  const publish=(next:GodTokenMetadataState)=>{state=next;for(const listener of listeners)listener();};
  function start(){
    if(controller||state.status!=='loading')return;
    const abort=new AbortController(),epoch=++generation;controller=abort;
    const signal=AbortSignal.any([abort.signal,AbortSignal.timeout(15000)]);
    void Promise.resolve().then(()=>{signal.throwIfAborted();return read(signal);}).then(result=>{
      signal.throwIfAborted();if(epoch!==generation||!listeners.size)return;
      if(result.status==='available')Object.freeze(result.token);
      publish(result);
    }).catch(()=>{if(epoch===generation&&listeners.size&&!abort.signal.aborted)publish({status:'error'});})
      .finally(()=>{abort.abort();if(epoch===generation)controller=null;});
  }
  return {
    getSnapshot:()=>state,
    subscribe(listener:()=>void){
      listeners.add(listener);start();let subscribed=true;
      return()=>{if(!subscribed)return;subscribed=false;listeners.delete(listener);if(!listeners.size){generation++;controller?.abort();controller=null;state=initial();}};
    },
  };
}
