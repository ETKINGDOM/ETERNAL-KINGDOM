import { keccak256 } from 'viem';
import { ANNOUNCEMENT_MAX_BYTES, announcementFeedSchema, type AnnouncementAdapter, type AnnouncementProofVerifier } from '../shared/announcements';
import { announcementSigningMessage, announcementTrustPolicySchema, signedAnnouncementSchema, signedPublicationCurrent } from '../shared/signedAnnouncements';
import { announcementTrust } from './announcementTrust';
import { createEvmAnnouncementProofVerifier } from './announcementProof';

export function createAnnouncementAdapter(request: typeof fetch = fetch, trust: unknown = announcementTrust,
  options: { clock?: () => number; proofVerifier?: AnnouncementProofVerifier } = {}): AnnouncementAdapter {
  const policy = announcementTrustPolicySchema.safeParse(trust);
  const clock = options.clock ?? Date.now;
  const verifier = options.proofVerifier ?? createEvmAnnouncementProofVerifier(policy.success && policy.data.mode === 'signed' ? policy.data.signers : []);
  // Session-only monotonic checkpoint. Fresh clients still need a release-configured
  // minimumRevision; this is not an eternal archive or global latest-version oracle.
  let checkpoint: { revision: number; digest: string } | null = null;
  return {
    async read(signal) {
      const controller = new AbortController();
      const cancel = () => controller.abort();
      if (signal.aborted) cancel();
      else signal.addEventListener('abort', cancel, { once: true });
      const timer = setTimeout(cancel, 10000);
      try {
        if (!policy.success || controller.signal.aborted) throw new Error('Unconfigured trust or cancelled request.');
        const response = await request('/content/announcements.json', {
          signal: controller.signal, credentials: 'omit', cache: 'no-store', redirect: 'error',
          headers: { Accept: 'application/json' },
        });
        if (!response.ok || !response.headers.get('content-type')?.toLowerCase().includes('application/json') ||
          Number(response.headers.get('content-length')) > ANNOUNCEMENT_MAX_BYTES || !response.body) {
          throw new Error('Invalid announcement response.');
        }
        const reader = response.body.getReader();
        const cancelRead = () => { void reader.cancel().catch(() => undefined); };
        controller.signal.addEventListener('abort', cancelRead, { once: true });
        if (controller.signal.aborted) cancelRead();
        const decoder = new TextDecoder('utf-8', { fatal: true });
        let size = 0, text = '';
        try {
          while (true) {
            const chunk = await reader.read();
            if (chunk.done) break;
            size += chunk.value.byteLength;
            if (size > ANNOUNCEMENT_MAX_BYTES) throw new Error('Announcement response too large.');
            text += decoder.decode(chunk.value, { stream: true });
          }
          text += decoder.decode();
        } finally {
          controller.signal.removeEventListener('abort', cancelRead);
          await reader.cancel().catch(() => undefined);
          reader.releaseLock();
        }
        if (controller.signal.aborted) throw new Error('Announcement request cancelled.');
        const document: unknown = JSON.parse(text);
        if (policy.data.mode === 'website') return { feed: announcementFeedSchema.parse(document), publication: { kind: 'website' } };
        // Signed mode has no unsigned fallback, even on a transient error.
        const envelope = signedAnnouncementSchema.parse(document), payload = envelope.payload;
        const publication = { kind: 'signed' as const, signer: envelope.proof.signer, audience: payload.audience,
          feedId: payload.feedId, revision: payload.revision, issuedAt: payload.issuedAt, expiresAt: payload.expiresAt };
        if (payload.audience !== policy.data.audience || payload.feedId !== policy.data.feedId || payload.revision < policy.data.minimumRevision ||
          !signedPublicationCurrent(publication, clock())) throw new Error('Unexpected or expired signed publication.');
        const bytes = new TextEncoder().encode(announcementSigningMessage(payload));
        const proof = await verifier.verify(bytes, envelope.proof);
        if (!proof.verified || proof.signer !== envelope.proof.signer || !policy.data.signers.includes(envelope.proof.signer) ||
          controller.signal.aborted || !signedPublicationCurrent(publication, clock())) throw new Error('Invalid or obsolete proof.');
        const digest = keccak256(bytes);
        if (checkpoint && (payload.revision < checkpoint.revision || payload.revision === checkpoint.revision && digest !== checkpoint.digest)) {
          throw new Error('Rolled back or conflicting publication.');
        }
        checkpoint = { revision: payload.revision, digest };
        return { feed: payload.feed, publication };
      } catch {
        // Do not surface arbitrary remote bodies, parser details or HTML.
        throw new Error('Announcements are unavailable. Please try refreshing.');
      } finally {
        clearTimeout(timer);
        signal.removeEventListener('abort', cancel);
      }
    },
  };
}

export const hostedAnnouncements = createAnnouncementAdapter();
