import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Avatar from '../components/Avatar.jsx';
import { ItemAdder, PendingList } from '../components/tasks/TaskParts.jsx';
import { isAdminRole } from '../data/roles.js';
import { listEmployees } from '../lib/employeesApi.js';
import { fileType, today } from '../lib/taskRules.js';
import { addFileItem, addLinkItem, addTextItem, createTask } from '../lib/tasksApi.js';

function Field({ id, label, hint, error, children }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-semibold">{label}</label>
      {children}
      {error ? <p className="mt-1.5 text-[13px] text-red-500">{error}</p> : hint ? <p className="mt-1.5 text-[13px] text-muted">{hint}</p> : null}
    </div>
  );
}

/** A manager gives a task to someone: what to do (text, links, files) and an optional due date. */
export default function TaskNew() {
  const navigate = useNavigate();
  const forId = useSearchParams()[0].get('for') || '';
  const [people, setPeople] = useState(null);
  const [v, setV] = useState({ title: '', description: '', assigneeIds: forId ? [forId] : [], dueDate: '' });
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const keySeq = useRef(0);

  useEffect(() => { listEmployees().then(setPeople).catch(() => setPeople([])); }, []);
  const [query, setQuery] = useState('');
  const everyone = useMemo(() => (people || []).filter((p) => !isAdminRole(p.role)), [people]);
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return everyone.filter((p) => !q || p.name.toLowerCase().includes(q) || p.role.toLowerCase().includes(q));
  }, [everyone, query]);
  const picked = new Set(v.assigneeIds);
  const toggle = (id) => setV((x) => ({ ...x, assigneeIds: x.assigneeIds.includes(id) ? x.assigneeIds.filter((i) => i !== id) : [...x.assigneeIds, id] }));
  const allShown = visible.length > 0 && visible.every((p) => picked.has(p.id));
  const toggleShown = () => setV((x) => {
    const ids = new Set(x.assigneeIds);
    for (const p of visible) allShown ? ids.delete(p.id) : ids.add(p.id);
    return { ...x, assigneeIds: [...ids] };
  });

  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  function addItem({ kind, text, url, file }) {
    const key = ++keySeq.current;
    setItems((list) => [...list, { key, kind, text, url, file }]);
  }

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (v.title.trim().length < 2) found.title = 'Give the task a title of at least 2 characters.';
    if (!v.assigneeIds.length) found.assigneeIds = 'Choose at least one person.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError('');
    // One task per person, so each person has their own proof and their own review.
    let first = null;
    let created = 0;
    let itemFailures = 0;
    const missing = [];
    for (const id of v.assigneeIds) {
      let task;
      try {
        task = await createTask({ title: v.title.trim(), description: v.description.trim(), assigneeId: id, dueDate: v.dueDate || null });
      } catch (err) {
        missing.push(everyone.find((p) => p.id === id)?.name || 'someone');
        if (v.assigneeIds.length === 1) setFormError(err.message);
        continue;
      }
      created += 1;
      first = first || task;
      // The task exists now. If an item fails, the task is still there and can be fixed on its own page.
      for (const i of items) {
        try {
          if (i.kind === 'text') await addTextItem(task.id, 'brief', i.text);
          else if (i.kind === 'link') await addLinkItem(task.id, 'brief', i.url);
          else await addFileItem(task.id, 'brief', i.file, fileType(i.file));
        } catch {
          itemFailures += 1;
        }
      }
    }
    if (!created) {
      setFormError((e) => e || 'No task could be created. Please try again.');
      setBusy(false);
      return;
    }
    const problems = [];
    if (missing.length) problems.push(`not created for ${missing.join(', ')}`);
    if (itemFailures) problems.push(`${itemFailures} item${itemFailures > 1 ? 's' : ''} could not be added`);
    const toast = `${created === 1 ? 'Task assigned' : `Task assigned to ${created} people`}${problems.length ? `, but ${problems.join(' and ')}.` : ''}`;
    const to = created === 1 ? `/tasks/${first.id}` : forId ? `/tasks/for/${forId}` : '/tasks';
    navigate(to, { state: { toast, error: problems.length > 0 } });
  }

  return (
    <AdminLayout>
      <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="space-y-5 p-6 sm:p-8">
          <Field id="t-title" label="Title" error={errors.title}>
            <input id="t-title" value={v.title} onChange={(e) => set('title')(e.target.value)} maxLength={120} autoComplete="off" placeholder="e.g. Record a demo of the login screen" className={`field ${errors.title ? 'field-error' : ''}`} />
          </Field>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <p id="t-who-label" className="text-sm font-semibold">Assign to</p>
              <p className="text-[13px] text-muted">{v.assigneeIds.length ? `${v.assigneeIds.length} selected` : 'Pick one or more people'}</p>
            </div>
            <div className={`rounded-xl border bg-surface ${errors.assigneeIds ? 'border-red-500' : 'border-line'}`} role="group" aria-labelledby="t-who-label">
              <div className="flex items-center gap-3 border-b border-line px-3 py-2">
                <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder={people ? 'Search by name or role' : 'Loading…'} aria-label="Search people" className="min-w-0 flex-1 bg-transparent py-1 text-sm outline-none placeholder:text-muted" />
                <button type="button" onClick={toggleShown} disabled={!visible.length} className="flex-none text-[13px] font-semibold text-accent hover:text-accent-dark disabled:opacity-50">{allShown ? 'Clear' : query ? 'Select shown' : 'Select all'}</button>
              </div>
              <ul className="max-h-64 divide-y divide-line overflow-y-auto">
                {visible.map((p) => (
                  <li key={p.id}>
                    <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-tint/30">
                      <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="h-4 w-4 flex-none accent-[var(--accent,#7c3aed)]" />
                      <Avatar user={p} path={`/employees/${p.id}/photo`} className="grid h-8 w-8 flex-none place-items-center overflow-hidden rounded-full bg-accent text-xs font-bold text-white" />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                      <span className="flex-none rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-accent-dark">{p.role}</span>
                    </label>
                  </li>
                ))}
                {people && visible.length === 0 && <li className="px-3 py-4 text-center text-sm text-muted">No one matches.</li>}
              </ul>
            </div>
            {errors.assigneeIds && <p className="mt-1.5 text-[13px] text-red-500">{errors.assigneeIds}</p>}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="t-due" label="Due date" hint="Optional.">
              <DatePicker id="t-due" value={v.dueDate} onChange={set('dueDate')} min={today()} max="2100-12-31" placeholder="No due date" />
            </Field>
          </div>

          <Field id="t-desc" label="Description" hint="Optional. Explain what needs to be done.">
            <textarea id="t-desc" value={v.description} onChange={(e) => set('description')(e.target.value)} rows={4} maxLength={4000} className="field resize-y" />
          </Field>

          <div>
            <p className="mb-1.5 text-sm font-semibold">Material</p>
            <p className="mb-3 text-[13px] text-muted">Anything that helps them do it: more text, a link, a video, an audio note, a document. Optional.</p>
            <div className="space-y-3">
              <PendingList items={items} onRemove={(key) => setItems((list) => list.filter((i) => i.key !== key))} />
              <ItemAdder onAdd={addItem} hint={items.length >= 20 ? 'You can add up to 20 items.' : ''} disabled={items.length >= 20} />
            </div>
          </div>

          {formError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{formError}</p>}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-[13px] text-muted">Each person gets their own copy of the task and a notification as soon as you assign it.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link to={forId ? `/tasks/for/${forId}` : '/tasks'} className="btn-line">Cancel</Link>
            <button type="submit" disabled={busy} className="btn-solid">{busy ? 'Assigning…' : v.assigneeIds.length > 1 ? `Assign to ${v.assigneeIds.length} people` : 'Assign task'}</button>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
