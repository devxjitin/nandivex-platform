import { useEffect, useId, useRef } from 'react';
import { createPortal } from 'react-dom';

/** Small modal: closes on Esc or backdrop click, locks page scroll, returns focus to what opened it. */
export default function Dialog({ title, description, onClose, children, wide = false, portal = false }) {
  const titleId = useId();
  const panel = useRef(null);

  useEffect(() => {
    const opener = document.activeElement;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.querySelector('input, select, button')?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, [onClose]);

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-night/60 p-0 sm:items-center sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} role="dialog" aria-modal="true" aria-labelledby={titleId}
        className={`page-in max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-surface p-6 shadow-lift sm:rounded-3xl sm:p-8 ${wide === '2xl' ? 'sm:max-w-5xl' : wide === 'xl' ? 'sm:max-w-2xl' : wide ? 'sm:max-w-xl' : 'sm:max-w-md'}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id={titleId} className="break-words text-2xl">{title}</h2>
            {description && <p className="mt-1.5 text-sm text-muted">{description}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition hover:bg-tint hover:text-accent">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
  return portal ? createPortal(dialog, document.body) : dialog;
}
