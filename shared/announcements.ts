import { z } from 'zod';

export const ANNOUNCEMENT_MAX_BYTES = 128 * 1024;
export const announcementSchema = z.object({
  id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,63}$/),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(3000),
  category: z.enum(['world', 'visit', 'safety']),
  publishedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }).optional(),
  pinned: z.boolean(),
}).strict().refine(item => !item.expiresAt || Date.parse(item.expiresAt) > Date.parse(item.publishedAt), {
  message: 'Expiry must be after publication.',
});

export const announcementFeedSchema = z.object({
  version: z.literal(1),
  language: z.literal('en'),
  entries: z.array(announcementSchema).max(100),
}).strict().refine(feed => new Set(feed.entries.map(item => item.id)).size === feed.entries.length, {
  message: 'Announcement IDs must be unique.',
});

export type Announcement = z.infer<typeof announcementSchema>;
export type AnnouncementFeed = z.infer<typeof announcementFeedSchema>;

export type AnnouncementPublication = { kind: 'website' } | {
  kind: 'signed'; signer: string; audience: string; feedId: string; revision: number;
  issuedAt: number; expiresAt: number;
};
export type AnnouncementReadResult = { feed: AnnouncementFeed; publication: AnnouncementPublication };

// Provenance is produced by a trusted adapter, never accepted as a JSON badge.
export interface AnnouncementAdapter {
  read(signal: AbortSignal): Promise<AnnouncementReadResult>;
}
export interface AnnouncementProofVerifier {
  verify(payload: Uint8Array, proof: unknown): Promise<
    { verified: true; signer: string } | { verified: false }
  >;
}

export function visibleAnnouncements(feed: AnnouncementFeed, now: number): Announcement[] {
  return feed.entries.filter(item => Date.parse(item.publishedAt) <= now &&
    (!item.expiresAt || Date.parse(item.expiresAt) > now))
    .sort((a, b) => Number(b.pinned) - Number(a.pinned) ||
      Date.parse(b.publishedAt) - Date.parse(a.publishedAt) || a.id.localeCompare(b.id));
}

export function nextAnnouncementChange(feed: AnnouncementFeed, now: number): number | undefined {
  const times = feed.entries.flatMap(item => [Date.parse(item.publishedAt),
    ...(item.expiresAt ? [Date.parse(item.expiresAt)] : [])]).filter(time => time > now);
  return times.length ? Math.min(...times) : undefined;
}
