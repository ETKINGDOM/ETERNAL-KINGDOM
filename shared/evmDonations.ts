// General EVM donations are native currency only. God/ERC-20 is a separate
// reader and policy. Chain IDs, not the shared ETH symbol, identify a source.
export const EVM_DONATION_NETWORKS=[
  {chainId:1,name:'Ethereum',symbol:'ETH',explorer:'https://etherscan.io'},
  {chainId:8453,name:'Base',symbol:'ETH',explorer:'https://basescan.org'},
  {chainId:42161,name:'Arbitrum',symbol:'ETH',explorer:'https://arbiscan.io'},
  {chainId:56,name:'BNB Chain',symbol:'BNB',explorer:'https://bscscan.com'},
] as const;
export type EvmDonationNetwork=typeof EVM_DONATION_NETWORKS[number];
export type EvmDonationChainId=EvmDonationNetwork['chainId'];
