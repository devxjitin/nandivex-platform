import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import Select from '../../components/Select.jsx';
import { addCareerRole, deleteCareerRole, getCareers, saveCareerRole } from '../../lib/careersApi.js';
import { KINDS, KIND_LABEL, STATUSES, cleanRole, emptyRole, validateRole } from '../../lib/careerRules.js';

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const PlusIcon = () => <svg {...icon} strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
const TrashIcon = () => <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;


function Field({ id, label, hint, error, children, className = '' }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-[13px] text-red-500">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

const cls = (error) => `field ${error ? 'field-error' : ''}`;

/** Type a skill and press Enter or comma to add it; click a chip's cross to remove it. */
function ChipInput({ id, value, onChange, max = 12, invalid }) {
  const [draft, setDraft] = useState('');
  const has = (list, t) => list.some((v) => v.toLowerCase() === t.toLowerCase());
  function add() {
    const t = draft.trim();
    if (t && !has(value, t) && value.length < max) onChange([...value, t]);
    setDraft('');
  }
  // Typing or pasting "Python, React, Node" turns every part before the last comma into a chip.
  function commit(raw) {
    const parts = raw.split(',');
    const rest = parts.pop();
    const next = [...value];
    for (const part of parts) {
      const t = part.trim();
      if (t && next.length < max && !has(next, t)) next.push(t);
    }
    if (next.length !== value.length) onChange(next);
    setDraft(rest.trimStart());
  }
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-xl border bg-surface px-3 py-2.5 transition focus-within:border-accent focus-within:ring-4 focus-within:ring-accent/15 ${invalid ? 'border-red-500/70' : 'border-line'}`}>
      {value.map((s) => (
        <span key={s} className="inline-flex items-center gap-1.5 rounded-full bg-tint py-1 pl-3 pr-1.5 text-[13px] font-semibold text-accent-dark">
          {s}
          <button type="button" onClick={() => onChange(value.filter((v) => v !== s))} aria-label={`Remove ${s}`} className="grid h-5 w-5 place-items-center rounded-full hover:bg-accent/15">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </span>
      ))}
      <input
        id={id} value={draft} maxLength={40} placeholder={value.length ? 'Add another' : 'Type a skill, press Enter'}
        onChange={(e) => (e.target.value.includes(',') ? commit(e.target.value) : setDraft(e.target.value))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') { e.preventDefault(); add(); }
          else if (e.key === 'Backspace' && !draft && value.length) onChange(value.slice(0, -1));
        }}
        onBlur={add}
        className="min-w-[10rem] flex-1 bg-transparent py-1 text-[15px] outline-none placeholder:text-muted/70"
      />
    </div>
  );
}

/** A list of short lines (responsibilities, requirements): one input each, with Add and Remove. */
function ListEditor({ id, value, onChange, placeholder, invalid, max = 15 }) {
  const set = (i, v) => onChange(value.map((x, j) => (j === i ? v : x)));
  return (
    <div className="space-y-2">
      {value.map((line, i) => (
        <div key={i} className="flex items-center gap-2">
          <input id={i === 0 ? id : undefined} value={line} onChange={(e) => set(i, e.target.value)} maxLength={300} placeholder={placeholder} aria-label={`${placeholder} ${i + 1}`} className={cls(invalid && !line.trim())} />
          <button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label={`Remove item ${i + 1}`} className="grid h-10 w-10 flex-none place-items-center rounded-full text-muted transition hover:bg-red-500/10 hover:text-red-600"><TrashIcon /></button>
        </div>
      ))}
      {value.length < max && (
        <button type="button" onClick={() => onChange([...value, ''])} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-accent hover:text-accent-dark">
          <PlusIcon /> Add {value.length ? 'another' : 'one'}
        </button>
      )}
    </div>
  );
}

function RoleForm({ initial, isNew, onSave, onDelete }) {
  const [r, setR] = useState(() => ({ ...emptyRole(), ...initial }));
  const [confirmDelete, setConfirmDelete] = useState(false);
  const blockLeave = useRef(true);
  const [errors, setErrors] = useState({});
  const [attempted, setAttempted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const start = useMemo(() => JSON.stringify({ ...emptyRole(), ...initial }), [initial]);
  const dirty = JSON.stringify(r) !== start;
  const set = (k) => (v) => setR((x) => ({ ...x, [k]: v }));
  const text = (k) => (e) => set(k)(e.target.value);

  // After the first Save click, mistakes are re-checked as they are fixed.
  useEffect(() => { if (attempted) setErrors(validateRole(r)); }, [attempted, r]);

  // Leaving with unsaved changes asks first.
  const blocker = useBlocker(({ currentLocation, nextLocation }) => blockLeave.current && dirty && currentLocation.pathname !== nextLocation.pathname);
  useEffect(() => {
    if (blocker.state !== 'blocked') return;
    if (window.confirm('Discard your changes to this role?')) blocker.proceed(); else blocker.reset();
  }, [blocker]);

  async function submit(e) {
    e.preventDefault();
    const found = validateRole(r);
    setErrors(found);
    setAttempted(true);
    if (Object.keys(found).length) {
      setTimeout(() => document.querySelector('[role="dialog"] [aria-invalid="true"], [role="dialog"] .border-red-500\\/70')?.scrollIntoView({ block: 'center', behavior: 'smooth' }), 0);
      return;
    }
    setBusy(true);
    setFormError('');
    try {
      blockLeave.current = false;
      await onSave(cleanRole(r));
    } catch (err) {
      blockLeave.current = true;
      setFormError(err.message);
      setBusy(false);
    }
  }

  const closeDelete = useCallback(() => setConfirmDelete(false), []);
  async function remove() {
    setBusy(true);
    setFormError('');
    try {
      blockLeave.current = false;
      await onDelete();
    } catch (err) {
      blockLeave.current = true;
      setConfirmDelete(false);
      setFormError(err.message);
      setBusy(false);
    }
  }

  const open = r.status === 'open';
  return (
    <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="space-y-5 p-6 sm:p-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="cr-kind" label="Type">
            <Select id="cr-kind" value={r.kind} onChange={set('kind')} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
          </Field>
          <Field id="cr-status" label="Status" hint={open ? 'Shown as hiring now, with the full details below.' : r.status === 'hidden' ? 'Kept here, but not shown on the website.' : 'Shown as "Opening soon".'}>
            <Select id="cr-status" value={r.status} onChange={set('status')} options={STATUSES} />
          </Field>
        </div>

        <Field id="cr-title" label="Title" error={errors.title}>
          <input id="cr-title" value={r.title} onChange={text('title')} maxLength={80} autoComplete="off" aria-invalid={!!errors.title} placeholder="e.g. Android Developer" className={cls(errors.title)} />
        </Field>

        <Field id="cr-blurb" label="Short description" error={errors.blurb} hint={`${r.blurb.trim().length}/300. Shown on the role card.`}>
          <textarea id="cr-blurb" value={r.blurb} onChange={text('blurb')} maxLength={300} rows={3} aria-invalid={!!errors.blurb} className={`${cls(errors.blurb)} resize-y`} />
        </Field>

        <Field id="cr-skills" label="Skills" error={errors.skills} hint="Press Enter or comma after each one. Up to 12.">
          <ChipInput id="cr-skills" value={r.skills} onChange={set('skills')} invalid={!!errors.skills} />
        </Field>

        {open && (
          <fieldset className="space-y-5 rounded-2xl border border-line bg-soft/40 p-5">
            <legend className="px-2 text-sm font-bold">Details for the open role</legend>
            <div className="grid gap-5 sm:grid-cols-2">
              <Field id="cr-dept" label="Department" error={errors.department}>
                <input id="cr-dept" value={r.department} onChange={text('department')} maxLength={60} aria-invalid={!!errors.department} placeholder="e.g. Engineering" className={cls(errors.department)} />
              </Field>
              <Field id="cr-loc" label="Location" error={errors.location}>
                <input id="cr-loc" value={r.location} onChange={text('location')} maxLength={60} aria-invalid={!!errors.location} placeholder="e.g. Remote, India" className={cls(errors.location)} />
              </Field>
              <Field id="cr-type" label="Type" error={errors.type}>
                <input id="cr-type" value={r.type} onChange={text('type')} maxLength={40} aria-invalid={!!errors.type} placeholder="e.g. Full-time" className={cls(errors.type)} />
              </Field>
              <Field id="cr-exp" label="Experience" error={errors.experience}>
                <input id="cr-exp" value={r.experience} onChange={text('experience')} maxLength={40} aria-invalid={!!errors.experience} placeholder="e.g. 1 to 3 years" className={cls(errors.experience)} />
              </Field>
            </div>
            <Field id="cr-overview" label="Overview" error={errors.overview} hint={`${r.overview.trim().length}/2000`}>
              <textarea id="cr-overview" value={r.overview} onChange={text('overview')} maxLength={2000} rows={4} aria-invalid={!!errors.overview} className={`${cls(errors.overview)} resize-y`} />
            </Field>
            <Field id="cr-resp" label="You will (responsibilities)" error={errors.responsibilities}>
              <ListEditor id="cr-resp" value={r.responsibilities} onChange={set('responsibilities')} placeholder="Responsibility" invalid={!!errors.responsibilities} />
            </Field>
            <Field id="cr-req" label="You bring (requirements)" error={errors.requirements}>
              <ListEditor id="cr-req" value={r.requirements} onChange={set('requirements')} placeholder="Requirement" invalid={!!errors.requirements} />
            </Field>
          </fieldset>
        )}

        {formError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{formError}</p>}
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex flex-col gap-1 sm:items-start xl:flex-row xl:items-center xl:gap-3">
          {!isNew && (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-40">
              <TrashIcon /> Delete role
            </button>
          )}
          <p className="text-[13px] text-muted">Changes show on the website as soon as you save.</p>
        </div>
        <div className="flex flex-col-reverse gap-3 sm:flex-row">
          <Link to="/admin/careers" className="btn-line">Cancel</Link>
          <button type="submit" disabled={busy || (!dirty && !isNew)} className="btn-solid">{busy ? 'Saving…' : isNew ? 'Add role' : 'Save role'}</button>
        </div>
      </div>

      {confirmDelete && (
        <Dialog title="Delete this role?" description={`"${r.title || 'This role'}" will disappear from the website at once. This cannot be undone. If you may want it again, set it to Hidden instead.`} onClose={closeDelete}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDelete} className="btn-line">Cancel</button>
            <button type="button" onClick={remove} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Dialog>
      )}
    </form>
  );
}

export default function CareerRole() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const [initial, setInitial] = useState(() => (isNew
    ? { ...emptyRole(), kind: searchParams.get('kind') === 'Internship' ? 'Internship' : 'Career' }
    : null));
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    if (isNew) return;
    getCareers()
      .then((d) => {
        const found = d.roles.find((r) => r.id === id);
        if (found) setInitial(found); else setLoadError('That role was not found. It may have been deleted.');
      })
      .catch((err) => setLoadError(err.message));
  }, [id, isNew]);

  async function onSave(values) {
    if (isNew) await addCareerRole(values); else await saveCareerRole(id, values);
    navigate('/admin/careers', { state: { toast: 'Role saved' } });
  }

  async function onDelete() {
    await deleteCareerRole(id);
    navigate('/admin/careers', { state: { toast: 'Role deleted' } });
  }

  return (
    <AdminLayout>
      {loadError && (
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <p role="alert" className="text-sm text-red-600">{loadError}</p>
          <Link to="/admin/careers" className="btn-line mt-5 inline-flex">Back to Careers</Link>
        </div>
      )}
      {!initial && !loadError && <p className="p-8 text-center text-sm text-muted">Loading…</p>}
      {initial && <RoleForm key={id || 'new'} initial={initial} isNew={isNew} onSave={onSave} onDelete={onDelete} />}
    </AdminLayout>
  );
}
