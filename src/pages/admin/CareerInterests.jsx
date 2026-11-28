import { useCallback, useEffect, useState } from 'react';
import Dialog from '../../components/admin/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import { deleteCareerInterest, getCareerInterests } from '../../lib/careersApi.js';

const TrashIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" />
  </svg>
);

const day = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const asHref = (v) => (/^https?:\/\//i.test(v) ? v : null);

/** The "Join the list" sign-ups from the website's Careers page. */
export default function CareerInterests() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCareerInterests().then(setList).catch((err) => setError(err.message)); }, []);

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteCareerInterest(deleting.id);
      setList(list.filter((i) => i.id !== deleting.id));
      toast.success('Removed from the list');
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  const close = useCallback(() => setDeleting(null), []);

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-6 py-4 sm:px-8">
        <h2 className="text-base">Join the list{list ? <span className="ml-2 text-muted/70">{list.length}</span> : null}</h2>
        <p className="mt-0.5 text-[13px] text-muted">People who asked to hear when a role or internship opens. Write to them when you open one.</p>
      </div>
      {error && <p role="alert" className="px-6 py-4 text-[13px] text-red-600 sm:px-8">{error}</p>}
      {!list && !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>}
      {list && list.length === 0 && (
        <div className="p-10 text-center">
          <p className="font-display text-lg font-bold">No one yet</p>
          <p className="mt-1 text-sm text-muted">Sign-ups from the website will show here.</p>
        </div>
      )}
      {list && list.length > 0 && (
        <ul className="space-y-3 p-4 sm:p-6">
          {list.map((i) => (
            <li key={i.id} className="overflow-hidden rounded-xl border border-line bg-surface">
              <div className="min-w-0 px-4 py-3.5">
                <span className="block truncate font-semibold">{i.name}</span>
                <a href={`mailto:${i.email}`} className="block truncate text-[13px] text-accent hover:underline">{i.email}</a>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-soft px-2.5 py-0.5 font-semibold text-muted">{i.kind}</span>
                  <span className="rounded-full bg-tint px-2.5 py-0.5 font-semibold text-accent-dark">{i.area}</span>
                  <span className="text-muted">{day(i.createdAt)}</span>
                  {i.links && (asHref(i.links)
                    ? <a href={i.links} target="_blank" rel="noreferrer" className="truncate text-accent hover:underline">{i.links}</a>
                    : <span className="truncate text-muted">{i.links}</span>)}
                </span>
              </div>
              <div className="flex justify-end border-t border-line bg-soft/40 px-4 py-2">
                <button type="button" onClick={() => setDeleting(i)} aria-label={`Remove ${i.name}`}
                  className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/10"><TrashIcon /> Remove from list</button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {deleting && (
        <Dialog title="Remove from the list?" description={`${deleting.name} (${deleting.email}) will no longer be on the list. This cannot be undone.`} onClose={close}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-line">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Removing…' : 'Remove'}</button>
          </div>
        </Dialog>
      )}
    </section>
  );
}
