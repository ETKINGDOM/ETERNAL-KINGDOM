type ReleaseIdentity={network:{chainId:number}|null;godTokenContract:string|null;release?:{id:string}|null};
// A unique release ID prevents restoring an old epoch even when reverting to
// an earlier CA. Legacy test configurations also change scope with their CA.
export function releaseDataScope(config:ReleaseIdentity){
  return `${config.release?.id??'testing'}:${config.network?.chainId??'none'}:${config.godTokenContract?.toLowerCase()??'none'}`;
}
// The existing alpha predates release manifests. A website-only update must
// keep its current storage names; only an explicit clear/fresh CA workflow
// creates a UUID and starts a new epoch. Never migrate old data into that UUID.
export function releaseObjectName(scope:string,key:string){return scope.startsWith('testing:')?key:`${scope}:${key}`;}
export function scopedReleaseKey(scope:string,key:string){return scope.startsWith('testing:')?key:`ek:${scope}:${key}`;}
// An epoch guard, not authentication. Current wallet proof is still required.
// Old testing clients remain compatible only while there is no release manifest.
export function matchesReleaseRequest(request:Request,config:ReleaseIdentity){
  if(!config.release)return true;
  const expected=releaseDataScope(config);
  return request.headers.get('X-EK-Release')===expected||request.headers.get('Upgrade')?.toLowerCase()==='websocket'&&new URL(request.url).searchParams.get('release')===expected;
}
