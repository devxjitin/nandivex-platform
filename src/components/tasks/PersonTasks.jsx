import { useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useToast } from '../Toast.jsx';
import { StatusBadge } from './TaskParts.jsx';
import { fmtDate, statusOf } from '../../lib/taskRules.js';

/* Shared pieces for looking at one person's tasks: the numbers, the list of tasks, and a card for profile pages. */

/** A message passed in through navigation (after deleting a task) is shown once as a toast. */
export function useNavToast() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const shownFor = useRef(null);
  useEffect(() => {
    if (!location.state?.toast || shownFor.current === location.key) return;
    shownFor.current = location.key;
    (location.state.error ? toast.error : toast.success)(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);
}

/** Counts for a list of tasks. `rate` is the share of all tasks that are approved, as a whole percent. */
export function taskStats(tasks) {
  const s = { total: tasks.length, pending: 0, submitted: 0, rejected: 0, approved: 0, missed: 0, rate: 0 };
  for (const t of tasks) s[statusOf(t)] += 1;
  s.rate = s.total ? Math.round((s.approved / s.total) * 100) : 0;
  return s;
}

/** How much of the work is approved: a bar with the percentage, the count, and a red pill when something is overdue. */
export function ApprovalMeter({ stats }) {
  const { approved, total, rate, missed } = stats;
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] text-muted">
          <span className="font-display text-lg font-extrabold text-ink">{total === 0 ? '0%' : `${rate}%`}</span>
          <span className="ml-1.5">{total === 0 ? 'No tasks yet' : `approved · ${approved} of ${total}`}</span>
        </p>
        {missed > 0 && (
          <span className="inline-flex flex-none items-center gap-1.5 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-semibold text-red-600">
            <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{missed} missed
          </span>
        )}
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-soft" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={rate} aria-label="Approved tasks">
        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${rate}%` }} />
      </div>
    </div>
  );
}

const TILES = [
  ['total', 'All tasks', 'text-ink'],
  ['pending', 'To do', 'text-muted'],
  ['submitted', 'Under review', 'text-amber-700'],
  ['rejected', 'Needs rework', 'text-orange-600'],
  ['missed', 'Missed', 'text-red-600'],
  ['approved', 'Approved', 'text-emerald-700'],
];

/** The numbers as a row of tiles, with the approval rate and overdue count underneath. */
export function StatsTiles({ stats }) {
  return (
    <div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {TILES.map(([key, label, tone]) => (
          <div key={key} className="rounded-xl border border-line bg-soft/50 px-4 py-3">
            <p className="text-xs text-muted">{label}</p>
            <p className={`mt-0.5 font-display text-2xl font-extrabold ${tone}`}>{stats[key]}</p>
          </div>
        ))}
      </div>
      <div className="mt-4"><ApprovalMeter stats={stats} /></div>
    </div>
  );
}

/** One task per row, each a link to the task. `showWho` adds who it is for (when the list mixes people). */
export function TaskRows({ tasks, showWho = false }) {
  return (
    <ul className="space-y-3">
      {tasks.map((t) => {
        const status = statusOf(t);
        const late = status === 'missed';
        return (
          <li key={t.id}>
            <Link to={`/tasks/${t.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 transition hover:border-accent/60 hover:bg-tint/30">
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{t.title}</span>
                <span className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
                  {showWho ? <span>For {t.assignee.name}</span> : t.createdBy && <span>From {t.createdBy.name}</span>}
                  {t.dueDate && <span className={late ? 'font-semibold text-red-600' : ''}>{late ? 'Was due' : 'Due'} {fmtDate(t.dueDate)}</span>}
                  {t.completedAt && t.status === 'approved' && <span>Approved {fmtDate(t.completedAt)}</span>}
                </span>
              </span>
              <StatusBadge status={status} className="flex-none" />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

/** The Tasks card on a profile page: the numbers, the latest tasks, and links to all of them. */
export function TasksCard({ tasks, personId, canAssign, own = false }) {
  const stats = taskStats(tasks);
  const recent = tasks.slice(0, 5);
  const allLink = own ? '/tasks' : `/tasks/for/${personId}`;
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <h2 className="border-b border-line px-6 py-4 text-base sm:px-8">Tasks</h2>
      <div className="space-y-6 p-6 sm:p-8">
        <StatsTiles stats={stats} />
        {recent.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold">Latest</p>
            <TaskRows tasks={recent} />
          </div>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <Link to={allLink} className="btn-line !py-2.5 text-[13px]">{own ? 'Open my tasks' : 'See all tasks'}</Link>
          {canAssign && <Link to={`/tasks/new?for=${personId}`} className="btn-solid !py-2.5 text-[13px]">Assign task</Link>}
        </div>
      </div>
    </section>
  );
}
