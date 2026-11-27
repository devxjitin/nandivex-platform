import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Select from '../../components/Select.jsx';
import { useToast } from '../../components/Toast.jsx';
import { isLeadership } from '../../data/roles.js';
import { listEmployees } from '../../lib/employeesApi.js';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join('');

function RoleBadge({ role }) {
  return (
    <span className={`inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${isLeadership(role) ? 'bg-accent text-white' : 'bg-tint text-accent-dark'}`}>{role}</span>
  );
}

function StatusBadge({ status }) {
  const active = status === 'active';
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold ${active ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700' : 'border-amber-500/30 bg-amber-500/10 text-amber-700'}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      {active ? 'Active' : 'Login sent'}
    </span>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5 shadow-card">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

export default function Employees() {
  const location = useLocation();
  const navigate = useNavigate();
  const [people, setPeople] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const toast = useToast();

  useEffect(() => {
    listEmployees().then(setPeople).catch((err) => { setLoadError(err.message); setPeople([]); });
  }, []);
  // A message passed in through navigation (e.g. after adding or removing someone) is shown once as a toast.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!location.state?.toast || shownFor.current === location.key) return;
    shownFor.current = location.key; // once per visit, even if React runs this effect twice
    (location.state.ok === false ? toast.error : toast.success)(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people || []).filter((p) =>
      (roleFilter === 'all' || p.role === roleFilter) &&
      (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
  }, [people, query, roleFilter]);

  const roleOptions = [...new Set((people || []).map((p) => p.role))].sort((a, b) => a.localeCompare(b));
  const leadership = (people || []).filter((p) => isLeadership(p.role)).length;
  const waiting = (people || []).filter((p) => p.status !== 'active').length;

  return (
    <AdminLayout>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="People" value={people ? people.length : '–'} />
        <Stat label="Founder and Co-Founder" value={people ? leadership : '–'} />
        <Stat label="Yet to sign in" value={people ? waiting : '–'} />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative sm:w-full sm:max-w-sm">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
          <input type="text" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search employees" className="field !pl-11" />
        </div>
        <Select aria-label="Filter by role" value={roleFilter} onChange={setRoleFilter} options={[{ value: 'all', label: 'All roles' }, ...roleOptions.map((r) => ({ value: r, label: r }))]} className="sm:w-[220px]" />
        <Link to="/admin/employees/new" className="btn-solid sm:ml-auto">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add employee
        </Link>
      </div>

      <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
        {people === null ? (
          <p className="p-8 text-center text-sm text-muted">Loading…</p>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center">
            <p className="font-display text-lg font-bold">{people.length === 0 ? 'No employees yet' : 'No one matches'}</p>
            <p className="mt-1 text-sm text-muted">{people.length === 0 ? 'Add the first person to get started.' : 'Try a different name or role.'}</p>
          </div>
        ) : (
          <ul className="divide-y divide-line">
            <li className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_120px_110px] gap-4 bg-soft px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
              <span>Name</span><span>Email</span><span>Role</span><span>Status</span>
            </li>
            {shown.map((p) => (
              <li key={p.id} onClick={() => navigate(`/admin/employees/${p.id}`)} className="group grid cursor-pointer gap-3 px-5 py-4 transition hover:bg-soft/60 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.5fr)_120px_110px] lg:items-center lg:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-tint font-display text-sm font-bold text-accent-dark">{initials(p.name)}</span>
                  <span className="min-w-0"><Link to={`/admin/employees/${p.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold group-hover:text-accent">{p.name}</Link><span className="block text-xs text-muted">Added {fmtDate(p.createdAt)}</span></span>
                </div>
                <span className="truncate text-sm text-muted">{p.email}</span>
                <span><RoleBadge role={p.role} /></span>
                <span><StatusBadge status={p.status} /></span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loadError && <p role="alert" className="mt-4 text-sm text-red-600">{loadError}</p>}

    </AdminLayout>
  );
}
