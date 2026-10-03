// Browser privacy controls are harmless optional fields on Worker fetch. Share
// one bounded RPC policy without importing browser DOM globals into the Worker.
export const rpcFetchOptions=(signal:AbortSignal)=>({signal,credentials:'omit' as const,referrerPolicy:'no-referrer' as const});
export type RpcFetch=typeof fetch;
