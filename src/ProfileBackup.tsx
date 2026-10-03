import { useEffect, useMemo, useRef, useState } from 'react';
import type { AccountProfile, Appearance } from '../shared/profile';
import { createLocalProfileArchiveAdapter } from './profileArchive';
import InfoHint from './InfoHint';

type Review = { appearance: Appearance; revision: number };
export default function ProfileBackup({ profile, disabled, save }: {
  profile: AccountProfile; disabled: boolean; save: (appearance: Appearance) => Promise<boolean>;
}) {
  const adapter = useMemo(() => createLocalProfileArchiveAdapter(profile), [profile]);
  const [review, setReview] = useState<Review | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const serial = useRef(0), mounted = useRef(false), lock = useRef(false);
  const current = useRef({ profile, disabled }); current.current = { profile, disabled };
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; serial.current++; }; }, []);
  const stale = review !== null && review.revision !== profile.revision;
  const busy = disabled || reading || saving;

  function discard() {
    serial.current++; setReview(null); setConfirmed(false); setReading(false); setStatus(''); setError('');
    if (input.current) input.current.value = '';
  }
  async function download() {
    if (busy || lock.current) return;
    const version = ++serial.current;
    setError(''); setStatus('');
    try {
      const blob = await adapter.exportProfile(profile.accountId);
      if (!mounted.current || serial.current !== version || current.current.disabled || current.current.profile !== profile) return;
      const url = URL.createObjectURL(blob);
      try {
        const link = document.createElement('a');
        link.href = url; link.download = 'eternal-kingdom-appearance-v1.json';
        document.body.append(link); link.click(); link.remove();
        setStatus('Backup download requested. Check your browser’s downloads.');
      } finally { setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch { if (mounted.current && serial.current === version) setError('The backup could not be prepared. Reload your saved profile and try again.'); }
  }
  async function read(file: File) {
    if (disabled || saving || lock.current) return;
    const version = ++serial.current, revision = profile.revision;
    setReview(null); setConfirmed(false); setStatus(''); setError(''); setReading(true);
    try {
      const imported = await adapter.previewImport(file);
      if (!mounted.current || serial.current !== version) return;
      setReview({ appearance: imported.appearance, revision });
    } catch {
      if (mounted.current && serial.current === version) setError('Choose a valid Eternal Kingdom appearance backup (JSON, at most 16 KiB). Nothing was saved.');
    } finally { if (mounted.current && serial.current === version) setReading(false); }
  }
  async function apply() {
    if (!review || !confirmed || stale || busy || lock.current) return;
    lock.current = true; setSaving(true); setStatus(''); setError('');
    const version = ++serial.current;
    try {
      const saved = await save(review.appearance);
      if (!mounted.current || serial.current !== version) return;
      if (saved) {
        setReview(null); setConfirmed(false); if (input.current) input.current.value = '';
        setStatus('Appearance restored to your current wallet profile. Receiving address unchanged.');
      } else {
        setConfirmed(false);
        setError('Restore was not confirmed. Reload the saved profile and review the backup again; no automatic retry was made.');
      }
    } catch {
      if (mounted.current && serial.current === version) {
        setConfirmed(false); setError('Restore was not confirmed. Reload the saved profile before trying again.');
      }
    } finally { lock.current = false; if (mounted.current && serial.current === version) setSaving(false); }
  }
  return <details className="profile-backup">
    <summary>Profile backup & restore</summary>
    <InfoHint label="Appearance backup details"><p>Keep a portable copy of your saved name and robe color. Unsaved edits, wallets, receiving addresses, friends, private messages, lamps and faith text are not included.</p><p>Preview is local and does not upload the file. A backup does not prove identity or restore funds, property, roles or a public person ID.</p></InfoHint>
    <button className="secondary-button full" type="button" disabled={busy} onClick={() => void download()}>Download appearance backup</button>
    <label className="field-label" htmlFor="appearance-backup">Choose an appearance backup</label>
    <input id="appearance-backup" ref={input} type="file" accept=".json,application/json" disabled={disabled || saving}
      onChange={event => { const file = event.target.files?.[0]; if (file) void read(file); }} />
    {reading && <p role="status">Reading backup locally…</p>}
    {review && <div className="backup-review">
      <h3>Review appearance restore</h3>
      <dl><dt>Name</dt><dd><bdi>{review.appearance.name}</bdi></dd><dt>Robe color</dt><dd><span className="backup-color" style={{ background: review.appearance.color }} aria-hidden="true"/>{review.appearance.color}</dd></dl>
      <p className="fine-print">Target: your currently verified wallet account</p><code>{profile.accountId}</code>
      <p className="muted">Confirming replaces the saved name and color and resets unsaved appearance edits. Your receiving address stays unchanged. This saves to hosted storage, not a blockchain.</p>
      {stale && <p role="alert">Your saved profile changed. Choose the backup again to review the latest target before restoring.</p>}
      <label className="backup-confirm"><input type="checkbox" checked={confirmed} disabled={busy || stale} onChange={event => setConfirmed(event.target.checked)}/><span>I checked this appearance and the current wallet. Replace my saved name and robe color.</span></label>
      <button className="primary full" disabled={!confirmed || busy || stale} onClick={() => void apply()}>{saving ? 'Saving appearance…' : 'Confirm appearance restore'}</button>
    </div>}
    {(review || error || reading) && <button className="text-button" disabled={saving} onClick={discard}>Discard backup preview</button>}
    {error && <p role="alert" className="error">{error}</p>}
    {status && <p role="status">{status}</p>}
  </details>;
}
