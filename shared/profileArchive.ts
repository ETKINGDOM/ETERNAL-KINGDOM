import { z } from 'zod';
import { appearanceSchema } from './profile';

export const PROFILE_ARCHIVE_MAX_BYTES = 16 * 1024;
// Appearance only: no wallet, receiving address, role, person ID or private text.
export const profileArchiveSchema = z.object({
  format: z.literal('eternal-kingdom-appearance'),
  version: z.literal(1),
  appearance: appearanceSchema.refine(value => [...value.name].every(character => {
    const point = character.codePointAt(0)!;
    return point < 0xd800 || point > 0xdfff;
  })),
}).strict();
export type ProfileArchive = z.infer<typeof profileArchiveSchema>;

export function decodeProfileArchive(bytes: Uint8Array): ProfileArchive {
  if (!bytes.length || bytes.byteLength > PROFILE_ARCHIVE_MAX_BYTES) throw new Error('Invalid appearance backup');
  return profileArchiveSchema.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true, ignoreBOM: false }).decode(bytes)));
}
