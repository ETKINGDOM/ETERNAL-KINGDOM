import type { ClientPacket, ServerPacket } from './protocol';
import type { Scene } from './world';
export type { GiftTarget,PersonGiftRecipientAdapter,PersonGiftExecutionAdapter,PublishedGiftRecipient,GiftAsset,GiftQuote } from './gifts';
export type { ChainConfiguration,ChainSettings,GodTokenSnapshot } from './chainConfiguration';

// Contract boundaries for subsequent milestones; no pretend implementations.
export type NetworkAddress = { network: string; address: string };
export type RecordKind = 'prayer' | 'confession' | 'praise';
export type FaithPayload = { version: 1; kind: RecordKind; language: string; authorVisibility: 'named' | 'initial-only'; visibility: 'public' | 'encrypted'; payload: string; encryption?: { algorithm: 'AES-GCM'; iv: string } };
export interface WorldTransport {
  connect(scene: Scene, channel: number, receive: (packet: ServerPacket) => void): void;
  send(packet: ClientPacket): boolean;
  close(): void;
}
export interface WalletAdapter {
  namespace: 'evm' | 'solana';
  connect(): Promise<NetworkAddress>;
  authenticate(challenge: string): Promise<string>;
  disconnect(): Promise<void>;
}
export interface FaithRecordAdapter {
  // Faith records have no token fee/burn. Non-prayer records must check the
  // configured token's balance >= one whole token in the record contract itself.
  estimate(payload: FaithPayload): Promise<{ network: string; gas: string }>;
  submit(payload: FaithPayload): Promise<{ hash: string; state: 'pending' }>;
  receipt(hash: string): Promise<{ state: 'pending' | 'confirmed' | 'failed'; recordId?: string }>;
}
export interface FaithEligibilityAdapter {
  // Read-only readiness, not a guarantee of the balance at transaction execution.
  // Never accepts private faith text or returns an invented zero on RPC errors.
  inspect(kind:RecordKind,account:string|undefined,signal:AbortSignal):Promise<
    {status:'eligible'|'insufficient';account?:string;observedUnits?:bigint}|{status:'unconfigured'|'wallet-required'}>;
}
export interface TokenAdapter {
  contract: NetworkAddress;
  balance(account: string): Promise<bigint>;
  transfer(recipient: string, amount: bigint): Promise<string>;
}
export interface SpeechAdapter { transcribe(audio: Blob, language?: string): Promise<string> }
// Live microphone boundary, separate from uploaded audio-file transcription.
// Implementations must disclose processing before start, support cancellation,
// and return text only to the private composer; never submit it automatically.
export interface LiveSpeechAdapter {
  available():boolean;
  start(options:{language:string;consent:'browser-managed-service';onText:(text:string)=>void;
    onState:(state:'requesting'|'listening'|'finishing'|'idle')=>void;onError:(code:'permission'|'unavailable'|'no-speech'|'limit'|'failed')=>void}):{stop():void;cancel():void};
}
export interface NarrationAdapter { speak(text: string, language: string): void; pause(): void; resume(): void; stop(): void }
export interface VoiceAdapter { join(acceptedInvitationId: string): Promise<void>; mute(muted: boolean): void; leave(): Promise<void> }
export interface SocialAdapter { invite(personId: string, kind: 'friend' | 'private-chat'): Promise<string>; accept(invitationId: string): Promise<void>; block(personId: string): Promise<void> }
export interface PropertyAdapter { read(id: string): Promise<{ id: string; owner?: NetworkAddress; access: 'closed' | 'private' | 'invited' | 'public' }> }
export interface DonationAdapter { quote(asset: string, network: string, amount: string, purpose: string): Promise<{ recipient: string; network: string }>; verify(transactionId: string): Promise<boolean> }
// Reserved multi-asset/full-history index boundary. The current implementation
// reads only standard God-token direct transfers on the configured Robinhood network.
// Never combine units from different assets/networks or return fake empty totals.
export interface DonationRankingIndexAdapter {
  list(input:{asset:'god-token'|'ETH'|'SOL'|'BTC';network:string;recipient:NetworkAddress;cursor?:string},signal:AbortSignal):Promise<
    {status:'unconfigured'|'unavailable'}|{status:'available';asset:string;network:string;symbol:string;decimals:number;
      snapshotId:string;scope:{from:string;through:string};coverage:'partial'|'complete';unverified:number;
      ranks:Array<{rank:number;donor:NetworkAddress;units:bigint;count:number}>;nextCursor?:string}>;
}
export interface ProfileStorageAdapter { export(): Promise<Blob>; import(archive: Blob): Promise<void> }
export type AccountIdentity = { id: string; kind: 'guest' | 'verified-wallet'; wallet?: NetworkAddress; displayName: string };
export type EvmRecipient = { accountId: string; address: string; chainId: number; revision: string; ownershipVerified: boolean };
export interface ReceivingAddressAdapter {
  get(accountId: string): Promise<EvmRecipient | null>;
  // Typed manually is not the same as a verified wallet. Show the full address.
  confirmChange(next: EvmRecipient, previousRevision?: string): Promise<void>;
}
export interface GiftAdapter {
  prepare(recipient: EvmRecipient, amount: bigint): Promise<{ recipient: EvmRecipient; token: NetworkAddress; gas: string }>;
  send(confirmedRecipient: EvmRecipient, amount: bigint): Promise<{ transactionHash: string }>;
}
export interface BurnAdapter { estimate(amount: bigint): Promise<{ gas: string; contract: NetworkAddress }>; burn(amount: bigint): Promise<string> }
export interface ModerationAdapter {
  report(target: { kind: 'message' | 'person' | 'record'; id: string }, reason: string): Promise<string>;
  mute(accountId: string, expiresAt: number, reason: string): Promise<void>;
  verifyAnnouncement(payload: string, signature: string, author: NetworkAddress): Promise<boolean>;
}
export interface RoleAdapter { permissions(accountId: string): Promise<string[]> }
export interface RecordIndexAdapter { list(cursor?: string): Promise<{ records: Array<{ id: string; transactionHash: string; payload: FaithPayload }>; nextCursor?: string }> }
export interface ContentStorageAdapter { putEncrypted(bytes: Uint8Array): Promise<{ contentId: string; checksum: string }>; get(contentId: string): Promise<Uint8Array> }
export interface WorldManifestAdapter { read(): Promise<{ version: number; protocolVersion: number; assets: Array<{ url: string; checksum: string }>; transportEndpoint: string; indexEndpoint?: string; signature?: string }> }
