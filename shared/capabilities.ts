export type CapabilityState = 'available' | 'unconfigured' | 'planned' | 'paused';
export const capabilities = {
  world: 'available', publicChat: 'available', guestProfile: 'available', narration: 'unconfigured',
  walletAuthentication: 'available', privateChat: 'available', friends: 'available', voice: 'available',
  accountProfile: 'available', receivingAddressSettings: 'available', verifiedRoomIdentity: 'available',
  publishedGiftRecipients: 'available',
  publicMessageReports: 'available', roomModeration: 'unconfigured',
  faithRecords: 'unconfigured', token: 'unconfigured', donations: 'unconfigured', gifts: 'unconfigured',
  // Hosted upload transcription is unconfigured. Optional client Web Speech
  // capability is detected in each browser, not advertised as server availability.
  housing: 'planned', speechToText: 'unconfigured',
} as const satisfies Record<string, CapabilityState>;
export type Capability = keyof typeof capabilities;
