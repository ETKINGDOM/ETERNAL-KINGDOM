import { recoverMessageAddress } from 'viem';
import type { AnnouncementProofVerifier } from '../shared/announcements';
import { announcementSignatureSchema, announcementTrustPolicySchema } from '../shared/signedAnnouncements';

export function createEvmAnnouncementProofVerifier(signers: string[]): AnnouncementProofVerifier {
  const policy = announcementTrustPolicySchema.safeParse({ mode: 'signed', audience: 'verifier', feedId: 'notices', minimumRevision: 1, signers });
  const trusted = new Set(policy.success && policy.data.mode === 'signed' ? policy.data.signers : []);
  return {
    async verify(payload, input) {
      const proof = announcementSignatureSchema.safeParse(input);
      if (!proof.success || !trusted.has(proof.data.signer)) return { verified: false };
      try {
        const recovered = await recoverMessageAddress({ message: { raw: payload }, signature: proof.data.signature as `0x${string}` });
        return recovered === proof.data.signer ? { verified: true, signer: recovered } : { verified: false };
      } catch { return { verified: false }; }
    },
  };
}
