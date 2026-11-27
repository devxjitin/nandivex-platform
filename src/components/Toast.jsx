import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* Short messages that fade in at the bottom of the screen and fade away.
   Hovering pauses the timer; the cross closes one at once. Use it from any page:
     const toast = useToast();  toast.success('Profile saved');  toast.error('Could not save');  */

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

const LEAVE_MS = 160;
const MAX_VISIBLE = 3;

function Icon({ kind }) {
  if (kind === 'error') {
    return (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
    );
  }
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

function ToastItem({ toast, onClose }) {
  const [paused, setPaused] = useState(false);
  const timer = useRef(null);
  const left = useRef(toast.duration);
  const startedAt = useRef(0);

  useEffect(() => {
    if (paused || toast.leaving) return undefined;
    startedAt.current = Date.now();
    timer.current = setTimeout(() => onClose(toast.id), left.current);
    return () => {
      clearTimeout(timer.current);
      left.current -= Date.now() - startedAt.current;
    };
  }, [paused, toast.leaving, toast.id, onClose]);

  const error = toast.kind === 'error';
  return (
    <div
      role={error ? 'alert' : 'status'}
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      className={`pointer-events-auto w-full max-w-[380px] rounded-xl border border-line bg-surface shadow-lift ${toast.leaving ? 'toast-out' : 'toast-in'}`}
    >
      <div className="flex items-start gap-2.5 py-3 pl-3.5 pr-2.5">
        <span className={`mt-[1px] flex-none ${error ? 'text-red-600' : 'text-emerald-600'}`}>
          <Icon kind={toast.kind} />
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-snug text-ink">{toast.text}</p>
        <button type="button" onClick={() => onClose(toast.id)} aria-label="Dismiss" className="-mt-0.5 grid h-6 w-6 flex-none place-items-center rounded-md text-muted transition hover:bg-soft hover:text-ink">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const seq = useRef(0);

  const close = useCallback((id) => {
    setItems((list) => list.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
    setTimeout(() => setItems((list) => list.filter((t) => t.id !== id)), LEAVE_MS);
  }, []);

  const push = useCallback((kind, text, duration) => {
    seq.current += 1;
    const id = seq.current;
    setItems((list) => [...list.filter((t) => !t.leaving).slice(-(MAX_VISIBLE - 1)), { id, kind, text, duration, leaving: false }]);
    return id;
  }, []);

  const api = useMemo(() => ({
    success: (text, duration = 4000) => push('success', text, duration),
    error: (text, duration = 6500) => push('error', text, duration),
    dismiss: close,
  }), [push, close]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-5 z-[70] flex flex-col items-center gap-2 px-4">
        {items.map((t) => <ToastItem key={t.id} toast={t} onClose={close} />)}
      </div>
    </Ctx.Provider>
  );
}
