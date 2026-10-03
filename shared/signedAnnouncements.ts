import { z } from 'zod';
import { getAddress, isAddress, zeroAddress } from 'viem';
import { announcementFeedSchema, type AnnouncementPublication } from './announcements';

export const SIGNED_NOTICE_MAX_LIFETIME = 7 * 24 * 60 * 60 * 1000;
const address = z.string().refine(value => isAddress(value) && value.toLowerCase() !== zeroAddress).transform(value => getAddress(value));
const revision = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER - 1);
const instant = z.number().int().min(1).max(8640000000000000);
const audience = z.string().regex(/^[a-z0-9][a-z0-9:/_-]{0,127}$/);
const feedId = z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/);
export const announcementTrustPolicySchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('website') }).strict(),
  z.object({ mode: z.literal('signed'), audience, feedId, minimumRevision: revision,
    signers: z.array(address).min(1).max(20).refine(values => new Set(values).size === values.length),
  }).strict(),
]);
export type AnnouncementTrustPolicy = z.infer<typeof announcementTrustPolicySchema>;
export const announcementSignatureSchema = z.object({
  scheme: z.literal('eip191-eoa'), signer: address,
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/),
}).strict();
export const signedAnnouncementPayloadSchema = z.object({
  audience, feedId, revision, issuedAt: instant, expiresAt: instant,
  feed: announcementFeedSchema,
}).strict().refine(value => value.expiresAt > value.issuedAt && value.expiresAt - value.issuedAt <= SIGNED_NOTICE_MAX_LIFETIME)
  .refine(value => value.feed.entries.every(entry => [entry.title, entry.body].every(text => [...text].every(character => {
    const point = character.codePointAt(0)!; return point < 0xd800 || point > 0xdfff;
  }))));
export type SignedAnnouncementPayload = z.infer<typeof signedAnnouncementPayloadSchema>;
export const signedAnnouncementSchema = z.object({
  format: z.literal('eternal-kingdom-signed-announcements'), version: z.literal(1),
  payload: signedAnnouncementPayloadSchema, proof: announcementSignatureSchema,
}).strict();

// V1 deterministic JSON: fixed key order, preserved entry order, optional expiry
// omitted when absent. It signs the normalized, validated text actually displayed.
// Not general-purpose JSON canonicalization; changing this requires a new version.
export function announcementSigningMessage(input: SignedAnnouncementPayload): string {
  const value = signedAnnouncementPayloadSchema.parse(input);
  const payload = {
    audience: value.audience, feedId: value.feedId, revision: value.revision,
    issuedAt: value.issuedAt, expiresAt: value.expiresAt,
    feed: { version: 1, language: 'en', entries: value.feed.entries.map(entry => ({
      id: entry.id, title: entry.title, body: entry.body, category: entry.category,
      publishedAt: entry.publishedAt, ...(entry.expiresAt === undefined ? {} : { expiresAt: entry.expiresAt }), pinned: entry.pinned,
    })) },
  };
  return 'ETERNAL KINGDOM · PUBLIC ANNOUNCEMENTS V1\nPublication only. Not a payment, login, role grant or blockchain transaction.\n' + JSON.stringify(payload);
}
export function signedPublicationCurrent(publication: AnnouncementPublication, now: number): boolean {
  return publication.kind === 'website' || Number.isFinite(now) && now >= publication.issuedAt && now < publication.expiresAt;
}
