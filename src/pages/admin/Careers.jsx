import { useCallback, useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import Select from '../../components/Select.jsx';
import { useToast } from '../../components/Toast.jsx';
import { addCareerRole, deleteCareerRole, getCareers, reorderCareerRoles, saveCareerRole, saveCareerSettings } from '../../lib/careersApi.js';
import { KINDS, STATUSES, STATUS_LABEL, cleanRole, emptyRole, validateRole } from '../../lib/careerRules.js';

const SITE_CAREERS_URL = 'https://nandivex.com/careers';

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const PlusIcon = () => <svg {...icon} strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
const UpIcon = () => <svg {...icon}><path d="M6 15l6-6 6 6" /></svg>;
const DownIcon = () => <svg {...icon}><path d="M6 9l6 6 6-6" /></svg>;
const TrashIcon = () => <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const EditIcon = () => <svg {...icon}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3" /></svg>;
const ExternalIcon = () => <svg {...icon}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;

const STATUS_STYLE = {
  open: 'bg-emerald-500/10 text-emerald-700',
  upcoming: 'bg-tint text-accent-dark',
  hidden: 'bg-soft text-muted',
};

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

function RoleEditor({ initial, onSave, onClose }) {
  const [r, setR] = useState(() => ({ ...emptyRole(), ...initial }));
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

  const close = useCallback(() => {
    if (!busy && (!dirty || window.confirm('Discard your changes to this role?'))) onClose();
  }, [busy, dirty, onClose]);

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
      await onSave(cleanRole(r));
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  const open = r.status === 'open';
  return (
    <Dialog title={initial?.id ? 'Edit role' : 'Add a role'} description="Changes show on the website as soon as you save." onClose={close} wide="xl">
      <form onSubmit={submit} noValidate className="space-y-5">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="cr-kind" label="Kind">
            <Select id="cr-kind" value={r.kind} onChange={set('kind')} options={KINDS.map((k) => ({ value: k, label: k }))} />
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

        <div className="flex flex-col-reverse gap-3 pt-1 sm:flex-row sm:justify-end">
          <button type="button" onClick={close} className="btn-line">Cancel</button>
          <button type="submit" disabled={busy || (!dirty && !!initial?.id)} className="btn-solid">{busy ? 'Saving…' : initial?.id ? 'Save role' : 'Add role'}</button>
        </div>
      </form>
    </Dialog>
  );
}

/** The message shown on the website while no role is open. */
function StatusCard({ settings, onSaved }) {
  const toast = useToast();
  const [v, setV] = useState(settings);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const dirty = v.statusTitle !== settings.statusTitle || v.statusText !== settings.statusText;

  async function save(e) {
    e.preventDefault();
    const found = {};
    const t = v.statusTitle.trim();
    const x = v.statusText.trim();
    if (t.length < 3) found.statusTitle = 'Enter a title of at least 3 characters.';
    else if (t.length > 120) found.statusTitle = `Keep the title under 120 characters. You have ${t.length}.`;
    if (x.length < 3) found.statusText = 'Enter a message of at least 3 characters.';
    else if (x.length > 500) found.statusText = `Keep the message under 500 characters. You have ${x.length}.`;
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const saved = await saveCareerSettings({ statusTitle: t, statusText: x });
      onSaved(saved);
      setV(saved);
      toast.success('Message saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <div className="border-b border-line px-6 py-4 sm:px-8">
        <h2 className="text-base">When no role is open</h2>
        <p className="mt-0.5 text-[13px] text-muted">This message is shown at the top of the Careers page while nothing is marked Open.</p>
      </div>
      <form onSubmit={save} noValidate className="grid gap-5 p-6 sm:p-8">
        <Field id="cs-title" label="Title" error={errors.statusTitle}>
          <input id="cs-title" value={v.statusTitle} onChange={(e) => { setV({ ...v, statusTitle: e.target.value }); setErrors({ ...errors, statusTitle: undefined }); }} maxLength={120} aria-invalid={!!errors.statusTitle} className={cls(errors.statusTitle)} />
        </Field>
        <Field id="cs-text" label="Message" error={errors.statusText} hint={`${v.statusText.trim().length}/500`}>
          <textarea id="cs-text" value={v.statusText} onChange={(e) => { setV({ ...v, statusText: e.target.value }); setErrors({ ...errors, statusText: undefined }); }} maxLength={500} rows={3} aria-invalid={!!errors.statusText} className={`${cls(errors.statusText)} resize-y`} />
        </Field>
        <div className="flex items-center justify-end gap-4">
          {dirty && !busy && <button type="button" onClick={() => { setV(settings); setErrors({}); }} className="text-[13px] font-semibold leading-none text-muted transition hover:text-accent">Discard</button>}
          <button type="submit" disabled={!dirty || busy} className="btn-solid !px-5 !py-2.5 text-[13px]">{busy ? 'Saving…' : 'Save message'}</button>
        </div>
      </form>
    </section>
  );
}

const iconBtn = 'grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition enabled:hover:bg-tint enabled:hover:text-accent disabled:opacity-30';

export default function Careers() {
  const toast = useToast();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [editing, setEditing] = useState(null); // null, {} for a new role, or a role
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCareers().then(setData).catch((err) => setLoadError(err.message)); }, []);

  const roles = data?.roles || [];
  const counts = { all: roles.length, open: 0, upcoming: 0, hidden: 0 };
  for (const r of roles) counts[r.status] += 1;
  const shown = filter === 'all' ? roles : roles.filter((r) => r.status === filter);

  const setRoles = (next) => setData((d) => ({ ...d, roles: next }));

  async function onSaveRole(values) {
    if (editing?.id) {
      const saved = await saveCareerRole(editing.id, values);
      setRoles(roles.map((r) => (r.id === saved.id ? saved : r)));
    } else {
      const saved = await addCareerRole(values);
      setRoles([...roles, saved]);
    }
    toast.success('Role saved');
    setEditing(null);
  }

  // Moves a role past its neighbour in the list being shown; the order is saved at once.
  async function move(role, dir) {
    const i = shown.findIndex((r) => r.id === role.id);
    const other = shown[i + dir];
    if (!other || busy) return;
    const ids = roles.map((r) => r.id);
    const a = ids.indexOf(role.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    const before = roles;
    setRoles(ids.map((id) => roles.find((r) => r.id === id)));
    setBusy(true);
    try {
      setRoles(await reorderCareerRoles(ids));
    } catch (err) {
      setRoles(before);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteCareerRole(deleting.id);
      setRoles(roles.filter((r) => r.id !== deleting.id));
      toast.success('Role deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const closeEditor = useCallback(() => setEditing(null), []);
  const closeDelete = useCallback(() => setDeleting(null), []);
  const tabs = [['all', 'All'], ['open', 'Open'], ['upcoming', 'Coming soon'], ['hidden', 'Hidden']];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl">Careers</h1>
            <p className="mt-1 text-sm text-muted">The roles and the message on the Careers page of nandivex.com. Saved changes show on the website straight away.</p>
          </div>
          <a href={SITE_CAREERS_URL} target="_blank" rel="noreferrer" className="btn-line flex-none"><ExternalIcon /> View on website</a>
        </div>

        {loadError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{loadError}</p>}

        {data && <StatusCard settings={data.settings} onSaved={(s) => setData((d) => ({ ...d, settings: s }))} />}

        {data && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter roles">
                {tabs.map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>
                    {label} <span className={filter === key ? 'text-white/80' : 'text-muted/70'}>{counts[key]}</span>
                  </button>
                ))}
              </div>
              <button type="button" onClick={() => setEditing({})} className="btn-solid !py-2.5 text-[13px]"><PlusIcon /> Add role</button>
            </div>

            {shown.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-lg font-bold">{roles.length === 0 ? 'No roles yet' : 'No roles here'}</p>
                <p className="mt-1 text-sm text-muted">{roles.length === 0 ? 'Add the first role to show it on the website.' : 'Pick another tab, or add a role.'}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                    <div className="flex flex-none flex-col">
                      <button type="button" onClick={() => move(r, -1)} disabled={i === 0 || busy} aria-label={`Move ${r.title} up`} className={`${iconBtn} !h-7 !w-9`}><UpIcon /></button>
                      <button type="button" onClick={() => move(r, 1)} disabled={i === shown.length - 1 || busy} aria-label={`Move ${r.title} down`} className={`${iconBtn} !h-7 !w-9`}><DownIcon /></button>
                    </div>
                    <button type="button" onClick={() => setEditing(r)} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold hover:text-accent">{r.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        <span className="rounded-full bg-soft px-2.5 py-0.5 font-semibold text-muted">{r.kind}</span>
                        {r.skills.length > 0 && <span className="hidden truncate text-muted sm:inline">{r.skills.slice(0, 4).join(', ')}{r.skills.length > 4 ? '…' : ''}</span>}
                      </span>
                    </button>
                    <button type="button" onClick={() => setEditing(r)} aria-label={`Edit ${r.title}`} className={iconBtn}><EditIcon /></button>
                    <button type="button" onClick={() => setDeleting(r)} aria-label={`Delete ${r.title}`} className={`${iconBtn} enabled:hover:!bg-red-500/10 enabled:hover:!text-red-600`}><TrashIcon /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {!data && !loadError && <p className="p-8 text-center text-sm text-muted">Loading…</p>}
      </div>

      {editing && <RoleEditor initial={editing.id ? editing : null} onSave={onSaveRole} onClose={closeEditor} />}

      {deleting && (
        <Dialog title="Delete this role?" description={`"${deleting.title}" will disappear from the website at once. This cannot be undone. If you may want it again, hide it instead.`} onClose={closeDelete}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDelete} className="btn-line">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  );
}
