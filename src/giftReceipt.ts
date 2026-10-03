import type { Address,Hash } from 'viem';
import type { EvmGiftRpcPort } from './evmGiftPorts';
import { matchingGodTokenTransferLog,type GodTokenTransfer } from './godTokenService';

export type GiftReceiptStatus='pending'|'confirmed'|'failed'|'unknown';
const same=(a:string,b:string)=>a.toLowerCase()===b.toLowerCase();
const hash=(value:string)=>/^0x[0-9a-fA-F]{64}$/.test(value);
const uint=(value:bigint)=>typeof value==='bigint'&&value>=0n&&value<(1n<<256n);

// Independent of the live selection/payment wallet: a submitted hash remains
// checkable after closing the composer. Three-block depth is NOT finality.
export async function verifiedGiftReceipt(rpc:EvmGiftRpcPort,transfer:GodTokenTransfer,payer:Address,transactionHash:Hash,cancellation:AbortSignal):Promise<{status:GiftReceiptStatus}> {
  cancellation.throwIfAborted();
  if(!hash(transactionHash))return {status:'unknown'};
  try {
    if(await rpc.chainId()!==transfer.chainId)return {status:'unknown'};
    const receipt=await rpc.receipt(transactionHash);cancellation.throwIfAborted();if(!receipt)return {status:'pending'};
    const tx=await rpc.transaction(transactionHash);cancellation.throwIfAborted();
    if(!tx||!same(receipt.hash,transactionHash)||!same(tx.hash,transactionHash)||tx.chainId!==transfer.chainId||!same(tx.from,payer)||
      !tx.to||!same(tx.to,transfer.to)||tx.input.toLowerCase()!==transfer.data.toLowerCase()||tx.value!==0n||
      !tx.blockHash||!same(tx.blockHash,receipt.blockHash)||!hash(receipt.blockHash)||!uint(receipt.blockNumber))return {status:'unknown'};
    const [block,head]=await Promise.all([rpc.blockHash(receipt.blockNumber),rpc.head()]);cancellation.throwIfAborted();
    if(!uint(head))return {status:'unknown'};
    if(!block||!same(block,receipt.blockHash)||head<receipt.blockNumber||head-receipt.blockNumber+1n<3n)return {status:'pending'};
    if(await rpc.chainId()!==transfer.chainId)return {status:'unknown'};
    const finalBlock=await rpc.blockHash(receipt.blockNumber);cancellation.throwIfAborted();
    if(!finalBlock||!same(finalBlock,receipt.blockHash))return {status:'pending'};
    if(receipt.status==='reverted')return {status:'failed'};
    if(receipt.status!=='success'||!matchingGodTokenTransferLog(transfer,payer,receipt.logs))return {status:'unknown'};
    return {status:'confirmed'};
  } catch(error){if(cancellation.aborted)throw error;return {status:'unknown'};}
}
