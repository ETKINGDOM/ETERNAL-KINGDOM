import { z } from 'zod';
import { keccak256, stringToHex } from 'viem';
import { evmReceivingAddressSchema } from './profile';
import {nativeDonationAddressesSchema} from './donationAddresses';
import type { GiftAsset } from './gifts';
import type { RecordKind } from './adapters';
import {isRobinhoodMainnet,isRobinhoodNitroNetwork} from './robinhoodNetwork';

const label=z.string().min(1).max(80).regex(/^[^\u0000-\u001f\u007f<>]*$/u);
const rpcUrl=z.string().max(2048).refine(value=>{
  try { const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash; }
  catch { return false; }
},'Use a public HTTPS RPC URL without credentials, query parameters or fragments.');
export const chainConfigurationSchema=z.object({
  version:z.literal(1),
  network:z.object({chainId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),name:label,rpcUrl,nativeSymbol:label,testnet:z.boolean(),
    // Unknown/L2 fee models cannot silently use a plain gas * fee estimate.
    executionFeeModel:z.enum(['standard-evm','arbitrum-nitro']).nullable().default(null)}).strict().nullable(),
  godTokenContract:evmReceivingAddressSchema.nullable(),
  nativeDonationAddresses:nativeDonationAddressesSchema.default({bitcoin:null,solana:null}),
  // Build-owned release switch. Never supplied by URL or player storage.
  testnetGiftBroadcast:z.boolean().default(false),
  testnetDonationBroadcast:z.boolean().default(false),
  testnetPrayerBroadcast:z.boolean().default(false),
  testnetHolderFaithBroadcast:z.boolean().default(false),
  // Separate owner-controlled release gates. Legacy testnet flags can never
  // authorize a real-money mainnet operation, even after a network change.
  mainnetBroadcast:z.object({gifts:z.boolean().default(false),donations:z.boolean().default(false),
    prayers:z.boolean().default(false),holderFaith:z.boolean().default(false)}).strict()
    .default({gifts:false,donations:false,prayers:false,holderFaith:false}),
  faithRecords:z.object({contract:evmReceivingAddressSchema.nullable(),prayerCodeHash:z.string().regex(/^0x[0-9a-f]{64}$/).nullable().default(null),access:z.literal('holder-only').default('holder-only'),
    holderContract:evmReceivingAddressSchema.nullable().default(null),holderCodeHash:z.string().regex(/^0x[0-9a-f]{64}$/).nullable().default(null)}).strict(),
  godTokenDonation:z.object({recipient:evmReceivingAddressSchema.nullable(),
    // First block of the disclosed ranking period, not an inferred genesis scan.
    startBlock:z.string().regex(/^(0|[1-9][0-9]{0,19})$/).nullable().default(null)}).strict(),
}).strict().refine(config=>!config.testnetGiftBroadcast||Boolean(config.network?.testnet&&config.godTokenContract&&(config.network.executionFeeModel==='standard-evm'||(config.network.chainId===46630&&config.network.executionFeeModel==='arbitrum-nitro'))),
  'Testnet gift broadcasting requires a configured test network, token and supported fee model.')
  .refine(config=>!config.testnetDonationBroadcast||Boolean(config.network?.testnet&&config.network.chainId===46630&&config.network.executionFeeModel==='arbitrum-nitro'&&config.godTokenContract&&config.godTokenDonation.recipient),
    'Donation broadcasting requires the approved test network, token and public treasury.')
  .refine(config=>!config.testnetPrayerBroadcast||Boolean(config.network?.testnet&&config.network.chainId===46630&&config.network.executionFeeModel==='arbitrum-nitro'&&config.faithRecords.contract&&config.faithRecords.prayerCodeHash),
    'Testnet prayer broadcasting requires a configured test network, pinned record code and supported fee model.')
  .refine(config=>!config.testnetHolderFaithBroadcast||Boolean(config.network?.testnet&&config.network.chainId===46630&&config.network.executionFeeModel==='arbitrum-nitro'&&config.godTokenContract&&config.faithRecords.holderContract&&config.faithRecords.holderCodeHash),
    'Holder faith broadcasting requires the approved test network, token and pinned holder record contract.')
  .refine(c=>!Object.values(c.mainnetBroadcast).some(Boolean)||isRobinhoodMainnet(c.network),
    'Mainnet broadcasting requires Robinhood Chain 4663 with the Nitro fee model.')
  .refine(c=>!c.mainnetBroadcast.gifts||Boolean(c.godTokenContract),'Mainnet gifts require the configured God contract.')
  .refine(c=>!c.mainnetBroadcast.donations||Boolean(c.godTokenContract&&c.godTokenDonation.recipient),'Mainnet donations require God and the public treasury.')
  .refine(c=>!c.mainnetBroadcast.prayers||Boolean(c.faithRecords.contract&&c.faithRecords.prayerCodeHash),'Mainnet prayers require a pinned prayer record contract.')
  .refine(c=>!c.mainnetBroadcast.holderFaith||Boolean(c.godTokenContract&&c.faithRecords.holderContract&&c.faithRecords.holderCodeHash),'Mainnet holder faith requires God and a pinned holder record contract.');
export type ChainConfiguration=z.infer<typeof chainConfigurationSchema>;
export type ChainSettings={status:'valid';config:ChainConfiguration;revision:string}|{status:'invalid'};
// One revision binds every consumer and invalidates quotes when ANY setting changes.
export function resolveChainSettings(input:unknown):ChainSettings {
  const parsed=chainConfigurationSchema.safeParse(input);
  if(!parsed.success)return {status:'invalid'};
  const config=parsed.data;
  Object.freeze(config.network);Object.freeze(config.faithRecords);Object.freeze(config.godTokenDonation);Object.freeze(config.nativeDonationAddresses);Object.freeze(config.mainnetBroadcast);Object.freeze(config);
  return {status:'valid',config,revision:keccak256(stringToHex(JSON.stringify(config)))};
}
export const godTokenSnapshotSchema=z.object({chainId:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),networkName:label,
  contract:evmReceivingAddressSchema,symbol:z.string().min(1).max(32).regex(/^[^\u0000-\u001f\u007f<>]*$/u),
  decimals:z.number().int().min(0).max(36),configRevision:z.string().regex(/^0x[0-9a-f]{64}$/),observedAt:z.number().int().positive()}).strict();
export type GodTokenSnapshot=GiftAsset & {observedAt:number};
export function configuredGodToken(settings:ChainSettings):{chainId:number;networkName:string;rpcUrl:string;contract:`0x${string}`;configRevision:string}|null {
  if(settings.status!=='valid'||!settings.config.network||!settings.config.godTokenContract)return null;
  return {chainId:settings.config.network.chainId,networkName:settings.config.network.name,rpcUrl:settings.config.network.rpcUrl,
    contract:settings.config.godTokenContract as `0x${string}`,configRevision:settings.revision};
}
export type ChainOperation='gifts'|'donations'|'prayers'|'holderFaith';
export function chainBroadcast(settings:ChainSettings,operation:ChainOperation):boolean{
  if(settings.status!=='valid')return false;
  const c=settings.config;
  if(isRobinhoodMainnet(c.network))return c.mainnetBroadcast[operation];
  // The standard EVM estimate path remains testnet-only. All other writes
  // use the explicitly supported Robinhood network and wallet-native fees.
  if(!isRobinhoodNitroNetwork(c.network)&&!(operation==='gifts'&&c.network?.testnet&&c.network.executionFeeModel==='standard-evm'))return false;
  return operation==='gifts'?c.testnetGiftBroadcast:operation==='donations'?c.testnetDonationBroadcast:
    operation==='prayers'?c.testnetPrayerBroadcast:c.testnetHolderFaithBroadcast;
}
export function assertCurrentGodToken(settings:ChainSettings,token:GodTokenSnapshot):void {
  godTokenSnapshotSchema.parse(token);
  const expected=configuredGodToken(settings);
  if(!expected||token.configRevision!==expected.configRevision||token.chainId!==expected.chainId||token.networkName!==expected.networkName||token.contract.toLowerCase()!==expected.contract.toLowerCase())throw new Error('The God token configuration changed. Review again.');
}
export function faithRecordPolicy(settings:ChainSettings,kind:RecordKind,token?:GodTokenSnapshot):
  {status:'open';tokenFee:0n;burn:0n;minimumHolding:0n}|{status:'unconfigured';tokenFee:0n;burn:0n}|
  {status:'holder-only';token:GodTokenSnapshot;tokenFee:0n;burn:0n;minimumHolding:bigint} {
  // Prayer is open. Confession/praise require at least one whole token at
  // submission, using verified decimals and integer units, never a charge/burn.
  if(kind==='prayer')return {status:'open',tokenFee:0n,burn:0n,minimumHolding:0n};
  if(settings.status!=='valid'||!token)return {status:'unconfigured',tokenFee:0n,burn:0n};
  assertCurrentGodToken(settings,token);
  return {status:'holder-only',token,tokenFee:0n,burn:0n,minimumHolding:10n**BigInt(token.decimals)};
}
export function faithHoldingEligibility(settings:ChainSettings,kind:RecordKind,holding?:{token:GodTokenSnapshot;units:bigint}) {
  const policy=faithRecordPolicy(settings,kind,holding?.token);
  if(policy.status==='open')return {status:'eligible' as const,policy};
  if(policy.status==='unconfigured')return {status:'unconfigured' as const,policy};
  if(!holding||typeof holding.units!=='bigint'||holding.units<0n||holding.units>=(1n<<256n))throw Error('Invalid holding response.');
  return {status:holding.units>=policy.minimumHolding?'eligible' as const:'insufficient' as const,policy};
}
export function godTokenDonation(settings:ChainSettings,token:GodTokenSnapshot) {
  assertCurrentGodToken(settings,token);
  return settings.status==='valid'&&settings.config.godTokenDonation.recipient?
    {token,recipient:settings.config.godTokenDonation.recipient}:null;
}
// Owner policy: donations are voluntary transfers, not burns. No burn is enabled.
