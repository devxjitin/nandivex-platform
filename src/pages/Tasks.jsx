import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import { ApprovalMeter, TaskRows, taskStats, useNavToast } from '../components/tasks/PersonTasks.jsx';
import { isAdminRole } from '../data/roles.js';
import { listEmployees } from '../lib/employeesApi.js';
import { isManager, useSession } from '../lib/session.jsx';
import { statusOf } from '../lib/taskRules.js';
import { listTasks } from '../lib/tasksApi.js';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;

const TABS = [['all', 'All'], ['pending', 'To do'], ['submitted', 'Under review'], ['rejected', 'Needs rework'], ['missed', 'Missed'], ['approved', 'Approved']];

const avatarClass = 'grid h-14 w-14 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-lg font-bold text-white';

/** One person: picture, name, role and where their tasks stand. Opens that person's tasks. */
function PersonCard({ person, tasks }) {
  const s = taskStats(tasks);
  const open = s.pending + s.rejected;
  return (
    <Link to={`/tasks/for/${person.id}`} className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 shadow-card transition hover:border-accent/60 hover:bg-tint/30">
      <div className="flex items-center gap-3.5">
        <Avatar user={person} path={`/employees/${person.id}/photo`} className={avatarClass} />
        <div className="min-w-0">
          <p className="truncate font-semibold">{person.name}</p>
          <p className="truncate text-xs text-muted">{person.email}</p>
          <span className="mt-1.5 inline-flex rounded-full bg-tint px-2.5 py-0.5 text-xs font-semibold text-accent-dark">{person.role}</span>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2 text-center">
        <div className="rounded-lg bg-soft/60 px-2 py-2"><p className="font-display text-lg font-extrabold">{open}</p><p className="text-[11px] text-muted">Open</p></div>
        <div className="rounded-lg bg-soft/60 px-2 py-2"><p className="font-display text-lg font-extrabold text-amber-700">{s.submitted}</p><p className="text-[11px] text-muted">To review</p></div>
        <div className="rounded-lg bg-soft/60 px-2 py-2"><p className="font-display text-lg font-extrabold text-red-600">{s.missed}</p><p className="text-[11px] text-muted">Missed</p></div>
        <div className="rounded-lg bg-soft/60 px-2 py-2"><p className="font-display text-lg font-extrabold text-emerald-700">{s.approved}</p><p className="text-[11px] text-muted">Approved</p></div>
      </div>
      <ApprovalMeter stats={s} />
    </Link>
  );
}

/** For a Founder, Co-Founder or Admin: everyone, with their numbers. A person's card opens their tasks. */
function PeopleView() {
  const [people, setPeople] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => {
    Promise.all([listEmployees(), listTasks()])
      .then(([p, t]) => { setPeople(p.filter((x) => !isAdminRole(x.role))); setTasks(t); })
      .catch((err) => setError(err.message));
  }, []);

  const byPerson = useMemo(() => {
    const map = new Map();
    for (const t of tasks || []) {
      if (!map.has(t.assignee.id)) map.set(t.assignee.id, []);
      map.get(t.assignee.id).push(t);
    }
    return map;
  }, [tasks]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people || [])
      .filter((p) => !q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q) || p.role.toLowerCase().includes(q))
      // People with proof waiting for a review come first, then by name.
      .sort((a, b) => (taskStats(byPerson.get(b.id) || []).submitted - taskStats(byPerson.get(a.id) || []).submitted) || a.name.localeCompare(b.name));
  }, [people, query, byPerson]);

  const totals = taskStats(tasks || []);
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl">Tasks</h1>
          <p className="mt-1 text-sm text-muted">
            {tasks ? `${totals.total} tasks across ${people.length} people. ${totals.submitted} waiting for review.` : 'Pick a person to see their tasks, give them new ones and review their proof.'}
          </p>
        </div>
        <Link to="/tasks/new" className="btn-solid flex-none !py-2.5 text-[13px]"><PlusIcon /> Assign task</Link>
      </div>

      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}
      {!people && !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>}

      {people && (
        <>
          <div className="relative sm:max-w-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
            <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name, email or role" aria-label="Search people" className="field !pl-11" />
          </div>
          {shown.length === 0 ? (
            <div className="rounded-2xl border border-line bg-surface p-10 text-center shadow-card">
              <p className="font-display text-lg font-bold">{people.length === 0 ? 'No people yet' : 'No one matches'}</p>
              <p className="mt-1 text-sm text-muted">{people.length === 0 ? 'Add an employee first, then give them tasks.' : 'Try a different name or role.'}</p>
            </div>
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {shown.map((p) => <li key={p.id}><PersonCard person={p} tasks={byPerson.get(p.id) || []} /></li>)}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

/** For everyone else: the tasks given to them. */
function MyTasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => { listTasks().then(setTasks).catch((err) => setError(err.message)); }, []);

  const all = tasks || [];
  const counts = { all: all.length, pending: 0, submitted: 0, rejected: 0, missed: 0, approved: 0 };
  for (const t of all) counts[statusOf(t)] += 1;
  const shown = filter === 'all' ? all : all.filter((t) => statusOf(t) === filter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl">My tasks</h1>
        <p className="mt-1 text-sm text-muted">Tasks given to you. Open one, do it, and add proof when it is done.</p>
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
              <p className="mt-1 text-sm text-muted">{all.length === 0 ? 'When someone gives you a task, it will show here.' : 'Pick another tab.'}</p>
            </div>
          ) : (
            <div className="p-4 sm:p-6"><TaskRows tasks={shown} /></div>
          )}
        </section>
      )}
    </div>
  );
}

export default function Tasks() {
  const { user } = useSession();
  useNavToast();
  return <AdminLayout>{isManager(user) ? <PeopleView /> : <MyTasks />}</AdminLayout>;
}
