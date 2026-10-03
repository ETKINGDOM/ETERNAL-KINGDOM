import { accountProfileSchema, type AccountProfile, type ProfileArchiveAdapter } from '../shared/profile';
import { decodeProfileArchive, profileArchiveSchema, PROFILE_ARCHIVE_MAX_BYTES } from '../shared/profileArchive';

export function createLocalProfileArchiveAdapter(snapshot: AccountProfile): ProfileArchiveAdapter {
  // Capture validated saved data, not an editable form or a live identity.
  const profile = accountProfileSchema.parse(snapshot);
  return {
    async exportProfile(accountId) {
      if (accountId !== profile.accountId) throw new Error('Profile changed');
      const archive = profileArchiveSchema.parse({
        format: 'eternal-kingdom-appearance', version: 1, appearance: profile.appearance,
      });
      return new Blob([JSON.stringify(archive, null, 2)], { type: 'application/json' });
    },
    async previewImport(archive) {
      if (!archive.size || archive.size > PROFILE_ARCHIVE_MAX_BYTES) throw new Error('Invalid appearance backup');
      const parsed = decodeProfileArchive(new Uint8Array(await archive.arrayBuffer()));
      return { appearance: parsed.appearance, proposedEvmAddress: null };
    },
  };
}
