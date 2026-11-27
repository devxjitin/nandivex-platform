import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import AdminLayout from '../components/admin/AdminLayout.jsx';
import Avatar from '../components/Avatar.jsx';
import { isLeadership } from '../data/roles.js';
import { listEmployees } from '../lib/employeesApi.js';
import { getProfile } from '../lib/profileApi.js';
import { isManager, useSession } from '../lib/session.jsx';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

/** What a complete profile has, so the home page can say how far along it is. */
function checklist(p, hasPhoto) {
  const addressed = ['line1', 'city', 'state', 'pincode'].every((k) => (p.currentAddress[k] || '').trim());
  return [
    { label: 'Profile photo', done: hasPhoto },
    { label: 'Date of birth', done: !!p.dateOfBirth },
    { label: 'Mobile number', done: !!p.phone },
    { label: 'Emergency contact', done: !!(p.emergencyName && p.emergencyPhone) },
    { label: 'Current address', done: addressed },
    { label: 'PAN number', done: p.pan.saved },
    { label: 'Bank details', done: !!(p.bank.accountSaved && p.bank.ifsc && p.bank.holder) },
  ];
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Tick({ done }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={done ? 'text-emerald-600' : 'text-muted/50'}>
      {done ? <path d="M5 12.5l4.5 4.5L19 7.5" /> : <circle cx="12" cy="12" r="3" />}
    </svg>
  );
}

export default function Home() {
  const { user } = useSession();
  const manager = isManager(user);
  const [items, setItems] = useState(null);
  const [people, setPeople] = useState(null);

  useEffect(() => {
    getProfile().then((p) => setItems(checklist(p, !!user?.photoVersion))).catch(() => setItems([]));
  }, [user?.photoVersion]);

  useEffect(() => {
    if (!manager) return;
    listEmployees().then(setPeople).catch(() => setPeople([]));
  }, [manager]);

  const done = items ? items.filter((i) => i.done).length : 0;
  const percent = items && items.length ? Math.round((done / items.length) * 100) : 0;
  const firstName = (user?.name || '').trim().split(/\s+/)[0];
  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  return (
    <AdminLayout>
      <div className="space-y-6">
        <section className="flex flex-col gap-5 rounded-2xl border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
          <Avatar user={user} className="grid h-16 w-16 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-2xl font-bold text-white" />
          <div className="min-w-0">
            <h1 className="truncate text-2xl sm:text-3xl">{greeting()}, {firstName}</h1>
            <p className="mt-1 text-sm text-muted">{today}</p>
          </div>
        </section>

        {items && items.length > 0 && percent < 100 && (
          <section className="rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-lg">Complete your profile</h2>
                <p className="mt-1 text-sm text-muted">{done} of {items.length} done</p>
              </div>
              <Link to="/profile" className="btn-solid !py-2.5">Open profile</Link>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completed">
              <div className="h-full rounded-full bg-accent transition-all duration-500" style={{ width: `${percent}%` }} />
            </div>
            <ul className="mt-5 grid gap-x-6 gap-y-2.5 text-sm sm:grid-cols-2 lg:grid-cols-4">
              {items.map((i) => (
                <li key={i.label} className={`flex items-center gap-2 ${i.done ? 'text-ink' : 'text-muted'}`}>
                  <Tick done={i.done} />
                  {i.label}
                </li>
              ))}
            </ul>
          </section>
        )}

        {manager && (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Stat label="People" value={people ? people.length : '–'} />
              <Stat label="Founder and Co-Founder" value={people ? people.filter((p) => isLeadership(p.role)).length : '–'} />
              <Stat label="Yet to sign in" value={people ? people.filter((p) => p.status !== 'active').length : '–'} />
            </div>

            <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
              <div className="flex items-center justify-between gap-4 border-b border-line px-6 py-4 sm:px-8">
                <h2 className="text-base">Recently added</h2>
                <div className="flex items-center gap-4 text-[13px] font-semibold">
                  <Link to="/admin" className="text-muted transition hover:text-accent">View all</Link>
                  <Link to="/admin/employees/new" className="text-accent transition hover:text-accent-dark">Add employee</Link>
                </div>
              </div>
              {people === null ? (
                <p className="p-8 text-center text-sm text-muted">Loading…</p>
              ) : people.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted">No employees yet.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {people.slice(0, 5).map((p) => (
                    <li key={p.id}>
                      <Link to={`/admin/employees/${p.id}`} className="flex items-center gap-3 px-6 py-3.5 transition hover:bg-soft/60 sm:px-8">
                        <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-tint font-display text-sm font-bold text-accent-dark">{initials(p.name)}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold">{p.name}</span>
                          <span className="block truncate text-xs text-muted">{p.email}</span>
                        </span>
                        <span className="hidden whitespace-nowrap rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent-dark sm:inline-flex">{p.role}</span>
                        <span className="hidden whitespace-nowrap text-xs text-muted md:block">Added {fmtDate(p.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </AdminLayout>
  );
}
