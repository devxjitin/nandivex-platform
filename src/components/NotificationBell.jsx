import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { listNotifications, markAllRead, markRead } from '../lib/notificationsApi.js';

/* The bell in the top bar: a badge with the unread count, and a panel with the latest notifications.
   It checks for new ones every minute and when the tab comes back into view. */

const POLL_MS = 60 * 1000;
const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function BellIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      <path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" />
      <path d="M10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

const ICONS = {
  employee_added: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3-5.5 6.5-5.5M18 8v6M15 11h6" /></>,
  first_signin: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3-5.5 6.5-5.5M15 16l2 2 4-4" /></>,
  employee_removed: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.6-3.4 3-5.5 6.5-5.5M15 11h6" /></>,
  password_reset: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" /></>,
  password_changed: <><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" /></>,
};

function ago(iso) {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'Just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 7 * 86400) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function NotificationBell() {
  const navigate = useNavigate();
  const wrapRef = useRef(null);
  const [items, setItems] = useState(null);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const { notifications, unread: n } = await listNotifications();
      setItems(notifications);
      setUnread(n);
    } catch { /* the bell just keeps what it had */ }
  }, []);

  useEffect(() => {
    load();
    const tick = setInterval(() => { if (!document.hidden) load(); }, POLL_MS);
    const onVisible = () => { if (!document.hidden) load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', onVisible); };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  function toggle() {
    if (!open) load();
    setOpen((v) => !v);
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.read) {
      setItems((list) => list.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      setUnread((c) => Math.max(0, c - 1));
      markRead(n.id).catch(() => {});
    }
    if (n.link) navigate(n.link);
  }

  async function readAll() {
    setItems((list) => list.map((x) => ({ ...x, read: true })));
    setUnread(0);
    markAllRead().catch(() => {});
  }

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button" onClick={toggle} aria-haspopup="dialog" aria-expanded={open}
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'} title="Notifications"
        className="relative grid h-9 w-9 place-items-center rounded-full border border-line bg-surface text-ink transition hover:border-accent/50 hover:bg-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <BellIcon />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full border-2 border-surface bg-accent px-1 text-[10px] font-bold leading-none text-white">{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div
          role="dialog" aria-label="Notifications"
          className="select-pop absolute right-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-2xl border border-line bg-surface shadow-lift max-sm:fixed max-sm:left-3 max-sm:right-3 max-sm:top-[68px] max-sm:w-auto"
        >
          <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3.5">
            <h2 className="text-[15px]">Notifications</h2>
            {unread > 0 && <button type="button" onClick={readAll} className="text-[13px] font-semibold text-accent hover:text-accent-dark">Mark all as read</button>}
          </div>

          {items === null ? (
            <p className="px-5 py-10 text-center text-sm text-muted">Loading…</p>
          ) : items.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint text-accent-dark"><BellIcon size={22} /></span>
              <p className="mt-3 font-display text-base font-bold">You are all caught up</p>
              <p className="mt-1 text-sm text-muted">New notifications show up here.</p>
            </div>
          ) : (
            <ul className="max-h-[min(70vh,440px)] divide-y divide-line overflow-y-auto">
              {items.map((n) => (
                <li key={n.id}>
                  <button type="button" onClick={() => openItem(n)} className={`flex w-full items-start gap-3 px-5 py-3.5 text-left transition hover:bg-soft/70 ${n.read ? '' : 'bg-tint/40'}`}>
                    <span className="mt-0.5 grid h-9 w-9 flex-none place-items-center rounded-full bg-tint text-accent-dark">
                      <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>{ICONS[n.type] || <><path d="M6 9a6 6 0 0 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9z" /></>}</svg>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={`block text-[14px] leading-snug ${n.read ? 'font-medium' : 'font-semibold'}`}>{n.title}</span>
                      {n.body && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{n.body}</span>}
                      <span className="mt-1 block text-xs text-muted/80">{ago(n.createdAt)}</span>
                    </span>
                    {!n.read && <span className="mt-2 h-2 w-2 flex-none rounded-full bg-accent" aria-label="Unread" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
