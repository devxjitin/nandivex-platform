import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Dialog from '../components/admin/Dialog.jsx';
import DatePicker from '../components/DatePicker.jsx';
import { ItemAdder, ItemList, StatusBadge, TrashIcon } from '../components/tasks/TaskParts.jsx';
import { useToast } from '../components/Toast.jsx';
import { isManager, useSession } from '../lib/session.jsx';
import { fileType, fmtDate, fmtDateTime, isOverdue, today } from '../lib/taskRules.js';
import { addFileItem, addLinkItem, addTextItem, deleteTask, getTask, removeItem, reviewTask, submitProof, updateTask } from '../lib/tasksApi.js';

const Card = ({ title, hint, children, footer }) => (
  <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
    <div className="space-y-4 p-6 sm:p-8">
      {title && (
        <div>
          <h2 className="text-lg">{title}</h2>
          {hint && <p className="mt-1 text-[13px] text-muted">{hint}</p>}
        </div>
      )}
      {children}
    </div>
    {footer && <div className="flex flex-wrap items-center gap-3 border-t border-line bg-soft/30 px-6 py-4 sm:px-8">{footer}</div>}
  </section>
);

const Meta = ({ label, children }) => (
  <div>
    <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{label}</dt>
    <dd className="mt-0.5 text-[15px]">{children}</dd>
  </div>
);

export default function TaskDetail() {
  const { id } = useParams();
  const { user } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const manager = isManager(user);

  const [task, setTask] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [reviewNote, setReviewNote] = useState('');
  const [reviewError, setReviewError] = useState('');
  const [editing, setEditing] = useState(null);
  const [editError, setEditError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => { getTask(id).then(setTask).catch((err) => setLoadError(err.message)); }, [id]);

  // A message passed in through navigation (after assigning) is shown once as a toast.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!location.state?.toast || shownFor.current === location.key) return;
    shownFor.current = location.key;
    (location.state.error ? toast.error : toast.success)(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);

  const closeDelete = useCallback(() => setConfirmDelete(false), []);
  const closeEdit = useCallback(() => setEditing(null), []);

  if (loadError) {
    return (
      <AdminLayout>
        <div className="rounded-2xl border border-line bg-surface p-8 text-center shadow-card">
          <p role="alert" className="text-sm text-red-600">{loadError}</p>
          <Link to="/tasks" className="btn-line mt-5 inline-flex">Back to Tasks</Link>
        </div>
      </AdminLayout>
    );
  }
  if (!task) return <AdminLayout><p className="p-8 text-center text-sm text-muted">Loading…</p></AdminLayout>;

  const mine = task.assignee.id === user.id;
  const late = isOverdue(task);
  const canGiveProof = mine && (task.status === 'pending' || task.status === 'rejected');
  const canReview = manager && !mine && task.status === 'submitted';
  const lastRejected = [...task.submissions].reverse().find((s) => s.decision === 'rejected');

  /** Runs a call, shows its error as a toast, and returns whether it worked. */
  async function run(fn) {
    try { await fn(); return true; } catch (err) { toast.error(err.message); return false; }
  }

  // Adds to the task's explanation (managers) or to the proof (the assignee) straight away.
  const addTo = (role) => async ({ kind, text, url, file }) => {
    const item = kind === 'text' ? await addTextItem(task.id, role, text) : kind === 'link' ? await addLinkItem(task.id, role, url) : await addFileItem(task.id, role, file, fileType(file));
    setTask((t) => ({ ...t, ...(role === 'brief' ? { brief: [...t.brief, item] } : { draft: [...t.draft, item] }) }));
  };

  const removeFrom = (role) => async (item) => {
    setBusyId(item.id);
    await run(async () => {
      await removeItem(task.id, role, item.id);
      setTask((t) => ({ ...t, ...(role === 'brief' ? { brief: t.brief.filter((i) => i.id !== item.id) } : { draft: t.draft.filter((i) => i.id !== item.id) }) }));
    });
    setBusyId(null);
  };

  async function submit() {
    setBusy(true);
    await run(async () => {
      setTask(await submitProof(task.id, note.trim()));
      setNote('');
      toast.success('Handed in for review');
    });
    setBusy(false);
  }

  async function decide(decision) {
    setReviewError('');
    if (decision === 'reject' && !reviewNote.trim()) return setReviewError('Tell them what is missing, so they know what to add.');
    setBusy(true);
    await run(async () => {
      setTask(await reviewTask(task.id, decision, reviewNote.trim()));
      setReviewNote('');
      toast.success(decision === 'approve' ? 'Task approved' : 'Sent back for more proof');
    });
    setBusy(false);
  }

  async function saveEdit(e) {
    e.preventDefault();
    if (editing.title.trim().length < 2) return setEditError('Give the task a title of at least 2 characters.');
    setBusy(true);
    setEditError('');
    try {
      setTask(await updateTask(task.id, { title: editing.title.trim(), description: editing.description.trim(), dueDate: editing.dueDate || null }));
      setEditing(null);
      toast.success('Task updated');
    } catch (err) {
      setEditError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await deleteTask(task.id);
      navigate(manager ? `/tasks/for/${task.assignee.id}` : '/tasks', { replace: true, state: { toast: 'Task deleted' } });
    } catch (err) {
      toast.error(err.message);
      setConfirmDelete(false);
      setBusy(false);
    }
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <Card
          footer={manager ? (
            <>
              <button type="button" onClick={() => setConfirmDelete(true)} disabled={busy} className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold text-red-600 transition hover:bg-red-500/10 disabled:opacity-40"><TrashIcon /> Delete task</button>
              <button type="button" onClick={() => { setEditError(''); setEditing({ title: task.title, description: task.description, dueDate: task.dueDate || '' }); }} className="btn-line !py-2 text-[13px] sm:ml-auto">Edit details</button>
            </>
          ) : null}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <h1 className="min-w-0 break-words text-2xl">{task.title}</h1>
            <StatusBadge status={task.status} />
          </div>
          <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Meta label="For">{manager ? <Link to={`/tasks/for/${task.assignee.id}`} className="font-semibold text-accent hover:text-accent-dark">{task.assignee.name}</Link> : task.assignee.name}<span className="text-muted"> · {task.assignee.role}</span></Meta>
            {task.createdBy && <Meta label="Assigned by">{task.createdBy.name}</Meta>}
            <Meta label="Due">{task.dueDate ? <span className={late ? 'font-semibold text-red-600' : ''}>{fmtDate(task.dueDate)}{late ? ' (overdue)' : ''}</span> : <span className="text-muted">No due date</span>}</Meta>
            <Meta label="Assigned on">{fmtDate(task.createdAt)}</Meta>
            {task.completedAt && <Meta label="Approved on">{fmtDate(task.completedAt)}</Meta>}
          </dl>
          {task.description && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{task.description}</p>}
        </Card>

        {(task.brief.length > 0 || (manager && task.status !== 'approved')) && (
          <Card title="Material" hint={manager ? 'What the assignee needs to do this. Text, links, videos, audio, documents.' : undefined}>
            <ItemList taskId={task.id} items={task.brief} onRemove={manager && task.status !== 'approved' ? removeFrom('brief') : undefined} busyId={busyId} />
            {manager && task.status !== 'approved' && <ItemAdder onAdd={addTo('brief')} disabled={task.brief.length >= 20} hint={task.brief.length >= 20 ? 'You can add up to 20 items.' : ''} />}
          </Card>
        )}

        {task.submissions.map((s) => (
          <Card key={s.id} title={`Proof, attempt ${s.attempt}`} hint={`Handed in ${fmtDateTime(s.submittedAt)}`}>
            {s.note && <p className="whitespace-pre-wrap break-words text-[15px] leading-relaxed">{s.note}</p>}
            <ItemList taskId={task.id} items={s.items} />
            {s.decision && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${s.decision === 'approved' ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-800' : 'border-red-500/30 bg-red-500/5 text-red-700'}`}>
                <p className="font-semibold">{s.decision === 'approved' ? 'Approved' : 'Sent back'} by {s.reviewedBy || 'a reviewer'}{s.reviewedAt ? `, ${fmtDateTime(s.reviewedAt)}` : ''}</p>
                {s.reviewNote && <p className="mt-1 whitespace-pre-wrap break-words">{s.reviewNote}</p>}
              </div>
            )}
          </Card>
        ))}

        {canGiveProof && (
          <Card
            title={task.status === 'rejected' ? 'Add proof again' : 'Add your proof'}
            hint="Show that it is done: text, a link, a photo, a video, an audio note, a document. You can add several."
            footer={
              <>
                <p className="text-[13px] text-muted">{task.draft.length === 0 ? 'Add at least one item to hand in.' : `${task.draft.length} item${task.draft.length > 1 ? 's' : ''} ready.`}</p>
                <button type="button" onClick={submit} disabled={busy || task.draft.length === 0} className="btn-solid sm:ml-auto">{busy ? 'Handing in…' : 'Hand in for review'}</button>
              </>
            }
          >
            {task.status === 'rejected' && lastRejected && (
              <div role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-sm text-red-700">
                <p className="font-semibold">Sent back{lastRejected.reviewedBy ? ` by ${lastRejected.reviewedBy}` : ''}. Add proof again.</p>
                {lastRejected.reviewNote && <p className="mt-1 whitespace-pre-wrap break-words">{lastRejected.reviewNote}</p>}
              </div>
            )}
            <ItemList taskId={task.id} items={task.draft} onRemove={removeFrom('proof')} busyId={busyId} />
            <ItemAdder onAdd={addTo('proof')} disabled={task.draft.length >= 20} hint={task.draft.length >= 20 ? 'You can add up to 20 items.' : ''} />
            <div>
              <label htmlFor="proof-note" className="mb-1.5 block text-sm font-semibold">Note for the reviewer</label>
              <textarea id="proof-note" value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={1000} placeholder="Optional" className="field resize-y" />
            </div>
          </Card>
        )}

        {mine && task.status === 'submitted' && (
          <p className="rounded-2xl border border-line bg-surface px-6 py-4 text-sm text-muted shadow-card">Your proof is with a reviewer. You will get a notification when they decide.</p>
        )}

        {canReview && (
          <Card
            title="Review"
            hint="Check the proof above. Approve it, or send it back and say what is missing."
            footer={
              <>
                <button type="button" onClick={() => decide('reject')} disabled={busy} className="btn-line !border-red-500/50 !text-red-600 hover:!bg-red-500/10">Send back</button>
                <button type="button" onClick={() => decide('approve')} disabled={busy} className="btn-solid sm:ml-auto">Approve</button>
              </>
            }
          >
            <div>
              <label htmlFor="review-note" className="mb-1.5 block text-sm font-semibold">Note</label>
              <textarea id="review-note" value={reviewNote} onChange={(e) => setReviewNote(e.target.value)} rows={3} maxLength={1000} placeholder="Needed if you send it back" className={`field resize-y ${reviewError ? 'field-error' : ''}`} />
              {reviewError && <p role="alert" className="mt-1.5 text-[13px] text-red-500">{reviewError}</p>}
            </div>
          </Card>
        )}

        {manager && mine && task.status === 'submitted' && (
          <p className="rounded-2xl border border-line bg-surface px-6 py-4 text-sm text-muted shadow-card">This is your own task, so another Founder, Co-Founder or Admin has to review it.</p>
        )}
      </div>

      {editing && (
        <Dialog title="Edit task" onClose={closeEdit} wide>
          <form onSubmit={saveEdit} noValidate className="mt-5 space-y-4">
            <div>
              <label htmlFor="e-title" className="mb-1.5 block text-sm font-semibold">Title</label>
              <input id="e-title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} maxLength={120} className="field" />
            </div>
            <div>
              <label htmlFor="e-due" className="mb-1.5 block text-sm font-semibold">Due date</label>
              <DatePicker id="e-due" value={editing.dueDate} onChange={(val) => setEditing({ ...editing, dueDate: val })} min={today()} max="2100-12-31" placeholder="No due date" />
            </div>
            <div>
              <label htmlFor="e-desc" className="mb-1.5 block text-sm font-semibold">Description</label>
              <textarea id="e-desc" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} rows={4} maxLength={4000} className="field resize-y" />
            </div>
            {editError && <p role="alert" className="text-[13px] text-red-500">{editError}</p>}
            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <button type="button" onClick={closeEdit} className="btn-line">Cancel</button>
              <button type="submit" disabled={busy} className="btn-solid">{busy ? 'Saving…' : 'Save'}</button>
            </div>
          </form>
        </Dialog>
      )}

      {confirmDelete && (
        <Dialog title="Delete this task?" description={`"${task.title}" and all its proof will be deleted. This cannot be undone.`} onClose={closeDelete}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDelete} className="btn-line">Cancel</button>
            <button type="button" onClick={remove} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  );
}
