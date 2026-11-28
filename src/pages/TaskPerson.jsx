import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import { StatsTiles, TaskRows, taskStats, useNavToast } from '../components/tasks/PersonTasks.jsx';
import { isAdminRole } from '../data/roles.js';
import { listEmployees } from '../lib/employeesApi.js';
import { statusOf } from '../lib/taskRules.js';
import { listTasks } from '../lib/tasksApi.js';

const PlusIcon = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>;
const TABS = [['all', 'All'], ['pending', 'To do'], ['submitted', 'Under review'], ['rejected', 'Needs rework'], ['missed', 'Missed'], ['approved', 'Approved']];

/** One person's tasks, for a Founder, Co-Founder or Admin: who they are, how they are doing, and every task with its status. */
export default function TaskPerson() {
  const { id } = useParams();
  useNavToast();
  const [person, setPerson] = useState(null);
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    setPerson(null);
    setTasks(null);
    setError('');
    Promise.all([listEmployees(), listTasks()])
      .then(([people, all]) => {
        const p = people.find((x) => x.id === id);
        if (!p || isAdminRole(p.role)) { setError('Person not found.'); return; }
        setPerson(p);
        setTasks(all.filter((t) => t.assignee.id === id));
      })
      .catch((err) => setError(err.message));
  }, [id]);

  const stats = taskStats(tasks || []);
  const counts = { all: stats.total, pending: stats.pending, submitted: stats.submitted, rejected: stats.rejected, missed: stats.missed, approved: stats.approved };
  const shown = filter === 'all' ? tasks || [] : (tasks || []).filter((t) => statusOf(t) === filter);

  return (
    <AdminLayout>
      <div className="space-y-6">
        {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}
        {!person && !error && <p className="p-8 text-center text-sm text-muted">Loading…</p>}

        {person && tasks && (
          <>
            <section className="rounded-2xl border border-line bg-surface shadow-card">
              <div className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:p-8">
                <Avatar user={person} path={`/employees/${person.id}/photo`} className="grid h-20 w-20 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-2xl font-bold text-white" />
                <div className="min-w-0 flex-1">
                  <h1 className="truncate text-2xl">{person.name}</h1>
                  <p className="mt-1 truncate text-sm text-muted">{person.email}</p>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent-dark">{person.role}</span>
                    <Link to={`/admin/employees/${person.id}`} className="text-[13px] font-semibold text-accent hover:text-accent-dark">Full profile</Link>
                  </div>
                </div>
                <Link to={`/tasks/new?for=${person.id}`} className="btn-solid flex-none !py-2.5 text-[13px]"><PlusIcon /> Assign task</Link>
              </div>
              <div className="border-t border-line p-6 sm:px-8"><StatsTiles stats={stats} /></div>
            </section>

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
                  <p className="font-display text-lg font-bold">{tasks.length === 0 ? 'No tasks yet' : 'Nothing here'}</p>
                  <p className="mt-1 text-sm text-muted">{tasks.length === 0 ? `Assign the first task to ${person.name}.` : 'Pick another tab.'}</p>
                </div>
              ) : (
                <div className="p-4 sm:p-6"><TaskRows tasks={shown} /></div>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
