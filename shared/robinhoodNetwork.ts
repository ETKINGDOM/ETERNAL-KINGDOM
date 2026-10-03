export type RobinhoodNetworkInput={chainId:number;testnet:boolean;executionFeeModel?:string|null};
// Execution support is explicit; changing a label/RPC cannot turn an arbitrary
// EVM chain into the reviewed Robinhood Nitro path.
export function isRobinhoodNitroNetwork(network:RobinhoodNetworkInput|null|undefined):boolean{
  return Boolean(network?.executionFeeModel==='arbitrum-nitro'&&
    ((network.chainId===4663&&network.testnet===false)||(network.chainId===46630&&network.testnet===true)));
}
export function isRobinhoodMainnet(network:RobinhoodNetworkInput|null|undefined):boolean{
  return isRobinhoodNitroNetwork(network)&&network?.chainId===4663;
}
