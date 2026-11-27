import { useEffect, useMemo, useRef, useState } from 'react';
import Select from './Select.jsx';

/* A calendar dropdown in place of the browser's date field. Values are 'YYYY-MM-DD' strings (or ''). */

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];

const pad = (n) => String(n).padStart(2, '0');
const toYmd = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
const parse = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || '');
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
};
const fmt = (v) => {
  const p = parse(v);
  return p ? `${p.d} ${MONTHS[p.m].slice(0, 3)} ${p.y}` : '';
};
const todayYmd = () => { const t = new Date(); return toYmd(t.getFullYear(), t.getMonth(), t.getDate()); };

function Arrow({ dir }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={dir === 'left' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'} /></svg>
  );
}

export default function DatePicker({ id, value, onChange, max, min = '1940-01-01', placeholder = 'Select date', invalid = false, className = '', 'aria-describedby': describedBy }) {
  const wrapRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [up, setUp] = useState(false);
  const sel = parse(value);
  const now = parse(todayYmd());
  const maxP = parse(max || '') || null;
  const minP = parse(min);
  const start = sel || (maxP && (maxP.y < now.y || (maxP.y === now.y && maxP.m < now.m)) ? maxP : now);
  const [view, setView] = useState({ y: start.y, m: start.m });

  function openCal() {
    const s = parse(value) || start;
    setView({ y: s.y, m: s.m });
    const rect = wrapRef.current?.getBoundingClientRect();
    if (rect) {
      const below = window.innerHeight - rect.bottom;
      setUp(below < 380 && rect.top > below);
    }
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (!wrapRef.current?.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('mousedown', onDown); document.removeEventListener('keydown', onKey); };
  }, [open]);

  const years = useMemo(() => {
    const top = maxP ? maxP.y : now.y + 1;
    const out = [];
    for (let y = top; y >= minP.y; y--) out.push({ value: String(y), label: String(y) });
    return out;
  }, [maxP?.y, minP.y, now.y]); // eslint-disable-line react-hooks/exhaustive-deps

  const cells = useMemo(() => {
    const first = new Date(view.y, view.m, 1);
    const lead = (first.getDay() + 6) % 7; // Monday first
    const days = new Date(view.y, view.m + 1, 0).getDate();
    const out = Array(lead).fill(null);
    for (let d = 1; d <= days; d++) out.push(d);
    return out;
  }, [view]);

  const disabled = (d) => {
    const v = toYmd(view.y, view.m, d);
    return (max && v > max) || (min && v < min);
  };

  function step(delta) {
    setView((v) => {
      const t = new Date(v.y, v.m + delta, 1);
      return { y: t.getFullYear(), m: t.getMonth() };
    });
  }
  const prevDisabled = view.y < minP.y || (view.y === minP.y && view.m <= minP.m);
  const nextDisabled = maxP && (view.y > maxP.y || (view.y === maxP.y && view.m >= maxP.m));

  function pick(d) {
    onChange(toYmd(view.y, view.m, d));
    setOpen(false);
  }

  return (
    <div ref={wrapRef} className={`relative ${className}`}>
      <button
        type="button" id={id} aria-haspopup="dialog" aria-expanded={open} aria-invalid={invalid || undefined} aria-describedby={describedBy}
        onClick={() => (open ? setOpen(false) : openCal())}
        className={`field flex items-center justify-between gap-3 text-left ${invalid ? 'field-error' : ''} ${open ? '!border-accent !ring-4 !ring-accent/15' : ''}`}
      >
        <span className={value ? '' : 'text-muted/70'}>{value ? fmt(value) : placeholder}</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="flex-none text-muted">
          <rect x="3.5" y="5" width="17" height="15.5" rx="3" /><path d="M3.5 10h17M8 3v4M16 3v4" />
        </svg>
      </button>

      {open && (
        <div role="dialog" aria-label="Choose a date" className={`select-pop absolute left-0 z-40 w-[324px] max-w-[calc(100vw-2.5rem)] rounded-2xl border border-line bg-surface p-4 shadow-lift ${up ? 'bottom-full mb-2' : 'top-full mt-2'}`}>
          <div className="mb-3 flex items-center gap-1.5">
            <button type="button" onClick={() => step(-1)} disabled={prevDisabled} aria-label="Previous month" className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line text-muted transition enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-40"><Arrow dir="left" /></button>
            <Select aria-label="Month" compact value={String(view.m)} onChange={(v) => setView((x) => ({ ...x, m: +v }))} options={MONTHS.map((m, i) => ({ value: String(i), label: m }))} className="min-w-0 flex-1" />
            <Select aria-label="Year" compact value={String(view.y)} onChange={(v) => setView((x) => ({ ...x, y: +v }))} options={years} className="w-[78px] flex-none" />
            <button type="button" onClick={() => step(1)} disabled={nextDisabled} aria-label="Next month" className="grid h-8 w-8 flex-none place-items-center rounded-full border border-line text-muted transition enabled:hover:border-accent enabled:hover:text-accent disabled:opacity-40"><Arrow dir="right" /></button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center">
            {DAYS.map((d) => <span key={d} className="pb-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{d}</span>)}
            {cells.map((d, i) => {
              if (d === null) return <span key={`e${i}`} />;
              const off = disabled(d);
              const isSel = sel && sel.y === view.y && sel.m === view.m && sel.d === d;
              const isToday = now.y === view.y && now.m === view.m && now.d === d;
              return (
                <button
                  key={d} type="button" disabled={off} onClick={() => pick(d)} aria-label={`${d} ${MONTHS[view.m]} ${view.y}`} aria-pressed={isSel || undefined}
                  className={`mx-auto grid h-9 w-9 place-items-center rounded-full text-[14px] transition ${isSel ? 'bg-accent font-semibold text-white' : off ? 'cursor-not-allowed text-muted/40' : `hover:bg-tint hover:text-accent-dark ${isToday ? 'font-bold text-accent' : 'text-ink'}`} ${isToday && !isSel ? 'ring-1 ring-accent/40' : ''}`}
                >
                  {d}
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px] font-semibold">
            <button type="button" onClick={() => { onChange(''); setOpen(false); }} className="text-muted hover:text-accent">Clear</button>
            {(!max || todayYmd() <= max) && <button type="button" onClick={() => { onChange(todayYmd()); setOpen(false); }} className="text-accent hover:text-accent-dark">Today</button>}
          </div>
        </div>
      )}
    </div>
  );
}
