import { useEffect, useId, useMemo, useRef, useState } from 'react';

/* A dropdown that matches the rest of the app, in place of the browser's own <select> list.
   Works with the keyboard (arrows, Home/End, Enter, Space, Escape, type to jump) and the mouse. */

function Chevron({ open }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={`flex-none text-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function Check() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-accent">
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </svg>
  );
}

/**
 * options: [{ value, label }]. `clearLabel` adds a first option with value '' (for optional fields).
 * Gives the button an id so a <label htmlFor> works. `onChange` receives the new value.
 */
export default function Select({
  id, value, onChange, options, placeholder = 'Select', clearLabel, invalid = false, disabled = false, compact = false,
  className = '', 'aria-label': ariaLabel, 'aria-describedby': describedBy,
}) {
  const auto = useId();
  const baseId = id || auto;
  const listId = `${baseId}-list`;
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const typed = useRef({ text: '', timer: null });
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const [active, setActive] = useState(0);

  const items = useMemo(() => (clearLabel ? [{ value: '', label: clearLabel }, ...options] : options), [options, clearLabel]);
  const selected = items.find((o) => o.value === value);

  function openList() {
    if (disabled) return;
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setUp(below < 280 && rect.top > below);
    }
    const i = items.findIndex((o) => o.value === value);
    setActive(i >= 0 ? i : 0);
    setOpen(true);
  }

  function choose(i) {
    const item = items[i];
    if (!item) return;
    setOpen(false);
    if (item.value !== value) onChange(item.value);
  }

  // Close on an outside click.
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  // Keep the highlighted option in view.
  useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onKeyDown(e) {
    if (disabled) return;
    const last = items.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) { e.preventDefault(); openList(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); setOpen(false); return; }
    if (e.key === 'Tab') { setOpen(false); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((i) => Math.min(last, i + 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); return; }
    if (e.key === 'Home') { e.preventDefault(); setActive(0); return; }
    if (e.key === 'End') { e.preventDefault(); setActive(last); return; }
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); choose(active); return; }
    // Typing a few letters jumps to the matching option.
    if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const t = typed.current;
      clearTimeout(t.timer);
      t.text += e.key.toLowerCase();
      t.timer = setTimeout(() => { t.text = ''; }, 600);
      const i = items.findIndex((o) => o.label.toLowerCase().startsWith(t.text));
      if (i >= 0) setActive(i);
    }
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button" id={baseId} role="combobox" aria-haspopup="listbox" aria-expanded={open} aria-controls={listId}
        aria-activedescendant={open ? `${baseId}-opt-${active}` : undefined} aria-invalid={invalid || undefined}
        aria-label={ariaLabel} aria-describedby={describedBy} disabled={disabled}
        onClick={() => (open ? setOpen(false) : openList())} onKeyDown={onKeyDown}
        className={`field flex items-center justify-between gap-3 text-left ${compact ? '!gap-1.5 !px-2.5 !py-2 !text-[14px]' : ''} ${invalid ? 'field-error' : ''} ${open ? '!border-accent !ring-4 !ring-accent/15' : ''} disabled:cursor-not-allowed disabled:opacity-60`}
      >
        <span className={`truncate ${selected && selected.value !== '' ? '' : 'text-muted/70'}`}>{selected && selected.value !== '' ? selected.label : (selected?.label || placeholder)}</span>
        <Chevron open={open} />
      </button>

      {open && (
        <ul
          ref={listRef} id={listId} role="listbox" aria-labelledby={baseId} tabIndex={-1}
          className={`absolute left-0 ${compact ? 'min-w-full w-max' : 'right-0'} z-40 max-h-64 overflow-auto rounded-xl border border-line bg-surface p-1.5 shadow-lift ${up ? 'bottom-full mb-2 origin-bottom' : 'top-full mt-2 origin-top'} select-pop`}
        >
          {items.map((o, i) => {
            const isSel = o.value === value;
            return (
              <li
                key={o.value || '__empty'} id={`${baseId}-opt-${i}`} role="option" aria-selected={isSel} data-i={i}
                onMouseEnter={() => setActive(i)} onMouseDown={(e) => e.preventDefault()} onClick={() => choose(i)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 text-[14px] ${i === active ? 'bg-tint text-accent-dark' : 'text-ink'} ${isSel ? 'font-semibold' : 'font-medium'}`}
              >
                <span className={compact ? 'whitespace-nowrap' : 'truncate'}>{o.label}</span>
                {isSel && <Check />}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
