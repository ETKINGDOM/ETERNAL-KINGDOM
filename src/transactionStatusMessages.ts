// Presentation only. Each transaction kind keeps its distinct receipt evidence
// and holding language; this module never infers an outcome or handles a draft.
const recordMessages={
  preparing:'Preparing or awaiting wallet confirmation.',
  'not-submitted':'Preparation stopped. No transaction was requested.',
  cancelled:'Wallet confirmation cancelled.',
  unconfirmed:'Submission not confirmed. Check your wallet before resending.',
  failed:'Transaction reverted. Network fees may have been consumed.',
  unknown:'Receipt could not be verified. Do not assume success or failure.',
};

export const prayerStatusMessages={
  ...recordMessages,
  pending:'Submitted · record not yet verified.',
  confirmed:'Prayer content and record evidence verified at three-block depth. This is provisional L2 inclusion, not L1 settlement.',
};

export const holderFaithStatusMessages={
  ...recordMessages,
  pending:'Submitted · record not yet verified.',
  insufficient:'Holding is below 1 whole God token. No transaction was requested.',
  confirmed:'Faith content, kind and record evidence verified at three-block depth. This is provisional L2 inclusion, not L1 settlement.',
};

export const nativeTokenStatusMessages={
  ...recordMessages,
  preparing:'Checking / awaiting wallet confirmation.',
  pending:'Submitted · transfer not yet verified.',
  confirmed:'Exact direct-transfer evidence verified at three-block depth. Provisional L2 inclusion, not L1 settlement.',
  unknown:'Could not verify the receipt. Do not assume success or failure.',
};
