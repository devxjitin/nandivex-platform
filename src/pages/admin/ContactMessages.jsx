import { useCallback, useEffect, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import { deleteContactMessage, getContactMessages, setContactStatus } from '../../lib/contactApi.js';

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const TrashIcon = () => <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const CheckIcon = () => <svg {...icon} strokeWidth="2.5"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const UndoIcon = () => <svg {...icon}><path d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" /></svg>;

const when = (iso) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const iconBtn = 'grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition enabled:hover:bg-tint enabled:hover:text-accent disabled:opacity-30';

/** Messages sent through the contact form on nandivex.com. */
export default function ContactMessages() {
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('new');
  const [openId, setOpenId] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getContactMessages().then(setList).catch((err) => setError(err.message)); }, []);

  const messages = list || [];
  const counts = { new: messages.filter((m) => m.status === 'new').length, done: messages.filter((m) => m.status === 'done').length };
  counts.all = messages.length;
  const shown = filter === 'all' ? messages : messages.filter((m) => m.status === filter);
  const tabs = [['new', 'New'], ['done', 'Handled'], ['all', 'All']];

  async function toggle(m) {
    setBusy(true);
    try {
      const saved = await setContactStatus(m.id, m.status === 'new' ? 'done' : 'new');
      setList(messages.map((x) => (x.id === saved.id ? saved : x)));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteContactMessage(deleting.id);
      setList(messages.filter((m) => m.id !== deleting.id));
      toast.success('Message deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }
  const close = useCallback(() => setDeleting(null), []);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl">Contact</h1>
          <p className="mt-1 text-sm text-muted">Messages people send through the contact form on nandivex.com. Reply from your email, then mark the message as handled.</p>
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}
        {!list && !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>}

        {list && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap gap-1.5 border-b border-line px-6 py-4 sm:px-8" role="tablist" aria-label="Filter messages">
              {tabs.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>
                  {label} <span className={filter === key ? 'text-white/80' : 'text-muted/70'}>{counts[key]}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-lg font-bold">{messages.length === 0 ? 'No messages yet' : 'Nothing here'}</p>
                <p className="mt-1 text-sm text-muted">{messages.length === 0 ? 'Messages from the website contact form will show here.' : filter === 'new' ? 'Every message has been handled.' : 'Pick another tab.'}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((m) => {
                  const open = openId === m.id;
                  return (
                    <li key={m.id} className="px-4 py-3.5 sm:px-6">
                      <div className="flex items-start gap-3">
                        <button type="button" onClick={() => setOpenId(open ? null : m.id)} aria-expanded={open} className="min-w-0 flex-1 text-left">
                          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            {m.status === 'new' && <span className="h-2 w-2 flex-none rounded-full bg-accent" aria-label="New" />}
                            <span className="font-semibold">{m.name}</span>
                            <span className="text-[13px] text-muted">{m.email}</span>
                          </span>
                          <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                            {m.topic && <span className="rounded-full bg-tint px-2.5 py-0.5 font-semibold text-accent-dark">{m.topic}</span>}
                            <span className="text-muted">{when(m.createdAt)}</span>
                          </span>
                          {!open && <span className="mt-1.5 block truncate text-sm text-muted">{m.message}</span>}
                        </button>
                        <button type="button" onClick={() => toggle(m)} disabled={busy} aria-label={m.status === 'new' ? 'Mark as handled' : 'Mark as new'} title={m.status === 'new' ? 'Mark as handled' : 'Mark as new'} className={iconBtn}>
                          {m.status === 'new' ? <CheckIcon /> : <UndoIcon />}
                        </button>
                        <button type="button" onClick={() => setDeleting(m)} aria-label={`Delete message from ${m.name}`} className={`${iconBtn} enabled:hover:!bg-red-500/10 enabled:hover:!text-red-600`}><TrashIcon /></button>
                      </div>
                      {open && (
                        <div className="mt-3 space-y-3 rounded-xl bg-soft/60 p-4 text-sm">
                          <p className="whitespace-pre-wrap break-words leading-relaxed">{m.message}</p>
                          <dl className="grid gap-x-6 gap-y-1.5 text-[13px] sm:grid-cols-2">
                            <div><dt className="inline font-semibold">Email: </dt><dd className="inline"><a href={`mailto:${m.email}`} className="text-accent hover:underline">{m.email}</a></dd></div>
                            {m.phone && <div><dt className="inline font-semibold">Phone: </dt><dd className="inline"><a href={`tel:${m.phone}`} className="text-accent hover:underline">{m.phone}</a></dd></div>}
                            {m.company && <div><dt className="inline font-semibold">Company: </dt><dd className="inline">{m.company}</dd></div>}
                            {m.budget && <div><dt className="inline font-semibold">Budget: </dt><dd className="inline">{m.budget}</dd></div>}
                          </dl>
                          <a href={`mailto:${m.email}?subject=${encodeURIComponent('Re: your message to NandiVex Technologies')}`} className="btn-line !py-2 text-[13px]">Reply by email</a>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>

      {deleting && (
        <Dialog title="Delete this message?" description={`The message from ${deleting.name} will be deleted. This cannot be undone.`} onClose={close}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={close} className="btn-line">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  );
}
