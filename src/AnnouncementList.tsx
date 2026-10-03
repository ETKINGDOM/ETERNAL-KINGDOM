import { useCallback, useEffect, useRef, useState } from 'react';
import { nextAnnouncementChange, visibleAnnouncements, type AnnouncementAdapter, type AnnouncementReadResult } from '../shared/announcements';
import { signedPublicationCurrent } from '../shared/signedAnnouncements';
import { hostedAnnouncements } from './announcementStorage';

const categories = { world: 'WORLD UPDATE', visit: 'EXPLORE', safety: 'TESTING & SAFETY' };
const dateFormat = new Intl.DateTimeFormat('en', { year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });

export default function AnnouncementList({ active, adapter = hostedAnnouncements }: {
  active: boolean; adapter?: AnnouncementAdapter;
}) {
  const [result, setResult] = useState<AnnouncementReadResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [now, setNow] = useState(Date.now);
  const request = useRef<AbortController | null>(null);
  const refresh = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setLoading(true); setError(''); setResult(null);
    try {
      const next = await adapter.read(controller.signal);
      if (controller.signal.aborted || request.current !== controller) return;
      setResult(next); setNow(Date.now());
    } catch {
      if (!controller.signal.aborted && request.current === controller) {
        setError('Announcements are unavailable. Please try refreshing.');
      }
    } finally {
      if (!controller.signal.aborted && request.current === controller) setLoading(false);
    }
  }, [adapter]);

  useEffect(() => {
    if (!active) return;
    void refresh();
    return () => { request.current?.abort(); };
  }, [active, refresh]);

  useEffect(() => {
    if (!active || !result) return;
    const update = () => setNow(Date.now());
    // Only a local visibility timer, not a network poll. Waking the tab also
    // removes expired notices before the visitor continues reading.
    const boundaries = [nextAnnouncementChange(result.feed, now),
      ...(result.publication.kind === 'signed' ? [result.publication.issuedAt, result.publication.expiresAt] : []),
    ].filter((time): time is number => time !== undefined && time > now);
    const next = boundaries.length ? Math.min(...boundaries) : undefined;
    const timer = next === undefined ? undefined : setTimeout(update, Math.min(2147483647, Math.max(1, next - Date.now())));
    document.addEventListener('visibilitychange', update);
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', update); };
  }, [active, result, now]);

  const renderTime = Date.now();
  const publication = result?.publication;
  const current = publication ? signedPublicationCurrent(publication, renderTime) : false;
  const entries = result && current ? visibleAnnouncements(result.feed, renderTime) : [];
  return <div className="announcements">
    <div className="announcement-controls">
      <span>World notices</span>
      <button type="button" className="text-button" onClick={() => void refresh()} disabled={loading || !active}
        aria-label="Refresh announcements">{loading ? 'Loading…' : 'Refresh'}</button>
    </div>
    {publication?.kind === 'website' && <p className="announcement-source">Published with this website. Not wallet-signed or recorded onchain.</p>}
    {publication?.kind === 'signed' && current && <div className="announcement-proof" aria-label="Verified announcement publisher">
      <span>Publisher signature verified</span><code>{publication.signer}</code>
      <small>{publication.feedId} · Revision {publication.revision} · Valid until {new Date(publication.expiresAt).toISOString()}</small>
      <p>Verified locally against this client’s trusted publisher list. Not an onchain record, religious endorsement or proof of the claims in the text.</p>
    </div>}
    {publication?.kind === 'signed' && !current && <p role="status" className="announcement-status">This signed publication is outside its validity window. Refresh to request a current publication.</p>}
    {loading && <p role="status" className="announcement-status">Loading announcements…</p>}
    {error && <p role="alert" className="announcement-status">{error}</p>}
    {!loading && !error && result && current && !entries.length && <p className="announcement-status">No current announcements. You can still explore the world.</p>}
    {entries.map(item => <article key={item.id} className="board-entry secondary" data-announcement-id={item.id}>
      <span className="entry-type">{item.pinned ? '✦ PINNED · ' : ''}{categories[item.category]}</span>
      <h3>{item.title}</h3>
      <time dateTime={item.publishedAt}>{dateFormat.format(new Date(item.publishedAt))} · UTC</time>
      <p className="announcement-body">{item.body}</p>
    </article>)}
  </div>;
}
