import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import DatePicker from '../components/DatePicker.jsx';
import Select from '../components/Select.jsx';
import { ItemAdder, PendingList } from '../components/tasks/TaskParts.jsx';
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
  const [people, setPeople] = useState(null);
  const [v, setV] = useState({ title: '', description: '', assigneeId: '', dueDate: '' });
  const [items, setItems] = useState([]);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState('');
  const keySeq = useRef(0);

  useEffect(() => { listEmployees().then(setPeople).catch(() => setPeople([])); }, []);
  const options = useMemo(
    () => (people || []).map((p) => ({ value: p.id, label: `${p.name} · ${p.role}` })),
    [people],
  );

  const set = (k) => (val) => setV((x) => ({ ...x, [k]: val }));

  function addItem({ kind, text, url, file }) {
    const key = ++keySeq.current;
    setItems((list) => [...list, { key, kind, text, url, file }]);
  }

  async function submit(e) {
    e.preventDefault();
    const found = {};
    if (v.title.trim().length < 2) found.title = 'Give the task a title of at least 2 characters.';
    if (!v.assigneeId) found.assigneeId = 'Choose who this task is for.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    setFormError('');
    let task;
    try {
      task = await createTask({ title: v.title.trim(), description: v.description.trim(), assigneeId: v.assigneeId, dueDate: v.dueDate || null });
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
      return;
    }
    // The task exists now. If an item fails, the task is still there and can be fixed on its own page.
    let failed = 0;
    for (const i of items) {
      try {
        if (i.kind === 'text') await addTextItem(task.id, 'brief', i.text);
        else if (i.kind === 'link') await addLinkItem(task.id, 'brief', i.url);
        else await addFileItem(task.id, 'brief', i.file, fileType(i.file));
      } catch {
        failed += 1;
      }
    }
    navigate(`/tasks/${task.id}`, { state: { toast: failed ? `Task assigned, but ${failed} item${failed > 1 ? 's' : ''} could not be added. Add again below.` : 'Task assigned', error: failed > 0 } });
  }

  return (
    <AdminLayout>
      <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="space-y-5 p-6 sm:p-8">
          <Field id="t-title" label="Title" error={errors.title}>
            <input id="t-title" value={v.title} onChange={(e) => set('title')(e.target.value)} maxLength={120} autoComplete="off" placeholder="e.g. Record a demo of the login screen" className={`field ${errors.title ? 'field-error' : ''}`} />
          </Field>

          <div className="grid gap-5 sm:grid-cols-2">
            <Field id="t-who" label="Assign to" error={errors.assigneeId}>
              <Select id="t-who" value={v.assigneeId} onChange={set('assigneeId')} options={options} placeholder={people ? 'Choose a person' : 'Loading…'} invalid={!!errors.assigneeId} />
            </Field>
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
          <p className="text-[13px] text-muted">They get a notification as soon as you assign it.</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link to="/tasks" className="btn-line">Cancel</Link>
            <button type="submit" disabled={busy} className="btn-solid">{busy ? 'Assigning…' : 'Assign task'}</button>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
