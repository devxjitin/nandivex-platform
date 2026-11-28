import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import { StatusBadge } from '../components/tasks/TaskParts.jsx';
import { useToast } from '../components/Toast.jsx';
import { isManager, useSession } from '../lib/session.jsx';
import { fmtDate, isOverdue } from '../lib/taskRules.js';
import { listTasks } from '../lib/tasksApi.js';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

const TABS = [['all', 'All'], ['pending', 'To do'], ['submitted', 'Under review'], ['rejected', 'Needs rework'], ['approved', 'Approved']];

/** Tasks: everyone's for a Founder, Co-Founder or Admin, otherwise the ones given to the signed-in person. */
export default function Tasks() {
  const { user } = useSession();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const manager = isManager(user);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { listTasks().then(setTasks).catch((err) => setError(err.message)); }, []);

  // A message passed in through navigation (after deleting a task) is shown once as a toast.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!location.state?.toast || shownFor.current === location.key) return;
    shownFor.current = location.key;
    toast.success(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);

  const all = tasks || [];
  const counts = { all: all.length, pending: 0, submitted: 0, rejected: 0, approved: 0 };
  for (const t of all) counts[t.status] += 1;
  const shown = filter === 'all' ? all : all.filter((t) => t.status === filter);

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl">Tasks</h1>
            <p className="mt-1 text-sm text-muted">
              {manager ? 'Give tasks to anyone, then approve the proof they hand in, or send it back.' : 'Tasks given to you. Open one, do it, and add proof when it is done.'}
            </p>
          </div>
          {manager && <Link to="/tasks/new" className="btn-solid flex-none !py-2.5 text-[13px]"><PlusIcon /> Assign task</Link>}
        </div>

        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}
        {!tasks && !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>}

        {tasks && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-wrap gap-1.5 border-b border-line px-6 py-4 sm:px-8" role="tablist" aria-label="Filter tasks">
              {TABS.map(([key, label]) => (
                <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                  className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>
                  {label} <span className={filter === key ? 'text-white/80' : 'text-muted/70'}>{counts[key]}</span>
                </button>
              ))}
            </div>

            {shown.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-lg font-bold">{all.length === 0 ? 'No tasks yet' : 'Nothing here'}</p>
                <p className="mt-1 text-sm text-muted">
                  {all.length === 0 ? (manager ? 'Assign the first task to get started.' : 'When someone gives you a task, it will show here.') : 'Pick another tab.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-3 p-4 sm:p-6">
                {shown.map((t) => {
                  const late = isOverdue(t);
                  return (
                    <li key={t.id}>
                      <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/60 hover:bg-tint/30">
                        {manager && <Avatar user={{ name: t.assignee.name }} className="grid h-10 w-10 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-sm font-bold text-white" />}
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{t.title}</span>
                          <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                            {manager ? <span>For {t.assignee.name}</span> : t.createdBy && <span>From {t.createdBy.name}</span>}
                            {t.dueDate && <span className={late ? 'font-semibold text-red-600' : ''}>{late ? 'Overdue, was due' : 'Due'} {fmtDate(t.dueDate)}</span>}
                          </span>
                        </span>
                        <StatusBadge status={t.status} className="flex-none" />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        )}
      </div>
    </AdminLayout>
  );
}
