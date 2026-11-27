import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

/* Short messages that slide up at the bottom of the screen, fill a thin timer bar and fade away.
   Hovering pauses the timer; the cross closes one at once. Use it from any page:
     const toast = useToast();  toast.success('Profile saved');  toast.error('Could not save');  */

const Ctx = createContext(null);
export const useToast = () => useContext(Ctx);

const LEAVE_MS = 220;
const MAX_VISIBLE = 3;

function Icon({ kind }) {
  if (kind === 'error') {
    return (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7.5v5.5M12 16.5v.01" /></svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12.5l4.5 4.5L19 7.5" className="toast-check" />
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
      className={`pointer-events-auto relative w-full max-w-[420px] overflow-hidden rounded-2xl border bg-surface shadow-lift ${toast.leaving ? 'toast-out' : 'toast-in'} ${error ? 'border-red-500/30' : 'border-emerald-500/25'}`}
    >
      <div className="flex items-start gap-3 py-3.5 pl-4 pr-3">
        <span className={`toast-pop mt-px grid h-8 w-8 flex-none place-items-center rounded-full ${error ? 'bg-red-500/10 text-red-600' : 'bg-emerald-500/10 text-emerald-600'}`}>
          <Icon kind={toast.kind} />
        </span>
        <p className="min-w-0 flex-1 self-center text-[14px] font-medium leading-snug text-ink">{toast.text}</p>
        <button type="button" onClick={() => onClose(toast.id)} aria-label="Dismiss" className="grid h-7 w-7 flex-none place-items-center rounded-full text-muted transition hover:bg-soft hover:text-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      </div>
      <div className="h-[3px] w-full bg-transparent" aria-hidden="true">
        <div className={`toast-bar h-full ${error ? 'bg-red-500' : 'bg-emerald-500'}`} style={{ animationDuration: `${toast.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }} />
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
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6 z-[70] flex flex-col items-center gap-3 px-4">
        {items.map((t) => <ToastItem key={t.id} toast={t} onClose={close} />)}
      </div>
    </Ctx.Provider>
  );
}
