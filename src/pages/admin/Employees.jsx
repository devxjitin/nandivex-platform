import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import { isLeadership } from '../../data/roles.js';
import { listEmployees, removeEmployee, resetPassword } from '../../lib/employeesApi.js';
import { useSession } from '../../lib/session.jsx';

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
  const { user: me } = useSession();
  const [people, setPeople] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [removing, setRemoving] = useState(null);
  const [toast, setToast] = useState(() => location.state?.toast ? { ok: location.state.ok !== false, text: location.state.toast } : null);

  useEffect(() => {
    listEmployees().then(setPeople).catch((err) => { setLoadError(err.message); setPeople([]); });
  }, []);
  // The toast came in through navigation state; clear it so a refresh does not show it again.
  useEffect(() => { if (location.state?.toast) navigate(location.pathname, { replace: true, state: null }); }, [location, navigate]);
  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  const closeRemove = useCallback(() => setRemoving(null), []);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (people || []).filter((p) =>
      (roleFilter === 'all' || p.role === roleFilter) &&
      (!q || p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)));
  }, [people, query, roleFilter]);

  async function onResend(p) {
    try {
      const { emailSent } = await resetPassword(p.id);
      setToast(emailSent
        ? { ok: true, text: `A new password was emailed to ${p.email}.` }
        : { ok: false, text: 'The password was changed but the email could not be sent. Try again.' });
    } catch (err) {
      setToast({ ok: false, text: err.message });
    }
  }

  async function onRemove() {
    const p = removing;
    try {
      await removeEmployee(p.id);
      setPeople((list) => list.filter((x) => x.id !== p.id));
      setToast({ ok: true, text: `${p.name} was removed.` });
    } catch (err) {
      setToast({ ok: false, text: err.message });
    }
    setRemoving(null);
  }

  const roleOptions = [...new Set((people || []).map((p) => p.role))].sort((a, b) => a.localeCompare(b));
  const leadership = (people || []).filter((p) => isLeadership(p.role)).length;
  const waiting = (people || []).filter((p) => p.status !== 'active').length;

  return (
    <AdminLayout>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl sm:text-4xl">Employees</h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">Add people, give each one a role and set their password. Their login details are emailed when the account is created.</p>
        </div>
        <Link to="/admin/employees/new" className="btn-solid">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          Add employee
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <Stat label="People" value={people ? people.length : '–'} />
        <Stat label="Founder and Co-Founder" value={people ? leadership : '–'} />
        <Stat label="Yet to sign in" value={people ? waiting : '–'} />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by name or email" aria-label="Search employees" className="field sm:max-w-sm" />
        <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} aria-label="Filter by role" className="field sm:max-w-[220px]">
          <option value="all">All roles</option>
          {roleOptions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
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
            <li className="hidden grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_120px_110px_220px] gap-4 bg-soft px-6 py-3 text-xs font-bold uppercase tracking-wider text-muted lg:grid">
              <span>Name</span><span>Email</span><span>Role</span><span>Status</span><span className="w-[220px] text-right">Actions</span>
            </li>
            {shown.map((p) => (
              <li key={p.id} className="grid gap-3 px-5 py-4 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1.6fr)_120px_110px_220px] lg:items-center lg:gap-4">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-tint font-display text-sm font-bold text-accent-dark">{initials(p.name)}</span>
                  <span className="min-w-0"><span className="block truncate font-semibold">{p.name}</span><span className="block text-xs text-muted">Added {fmtDate(p.createdAt)}</span></span>
                </div>
                <span className="truncate text-sm text-muted">{p.email}</span>
                <span><RoleBadge role={p.role} /></span>
                <span><StatusBadge status={p.status} /></span>
                <div className="flex gap-2 lg:w-[220px] lg:justify-end">
                  <button type="button" onClick={() => onResend(p)} disabled={p.id === me?.id} title={p.id === me?.id ? 'You cannot reset your own password here' : undefined} className="disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap rounded-full border border-line px-3 py-1.5 text-[13px] font-semibold transition enabled:hover:border-accent enabled:hover:text-accent">New password</button>
                  <button type="button" onClick={() => setRemoving(p)} disabled={p.id === me?.id} title={p.id === me?.id ? 'You cannot remove your own account' : undefined} className="whitespace-nowrap rounded-full disabled:cursor-not-allowed disabled:opacity-40 border border-line px-3 py-1.5 text-[13px] font-semibold text-red-600 transition enabled:hover:border-red-500">Remove</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {loadError && <p role="alert" className="mt-4 text-sm text-red-600">{loadError}</p>}

      {removing && (
        <Dialog title="Remove employee?" description={`${removing.name} (${removing.email}) will lose access to the platform.`} onClose={closeRemove}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeRemove} className="btn-line">Cancel</button>
            <button type="button" onClick={onRemove} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">Remove</button>
          </div>
        </Dialog>
      )}

      {toast && (
        <div role="status" className={`page-in fixed bottom-6 left-1/2 z-[60] w-[calc(100%-2.5rem)] max-w-md -translate-x-1/2 rounded-2xl border px-5 py-3.5 text-sm font-medium shadow-lift ${toast.ok ? 'border-emerald-500/30 bg-surface text-ink' : 'border-red-500/40 bg-surface text-red-600'}`}>
          {toast.text}
        </div>
      )}
    </AdminLayout>
  );
}
