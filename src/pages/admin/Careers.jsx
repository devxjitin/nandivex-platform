import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import CareerInterests from './CareerInterests.jsx';
import { deleteCareerRole, getCareers, reorderCareerRoles } from '../../lib/careersApi.js';
import { STATUS_LABEL } from '../../lib/careerRules.js';

const SITE_CAREERS_URL = 'https://nandivex.com/careers';

const icon = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const PlusIcon = () => <svg {...icon} strokeWidth="2.5"><path d="M12 5v14M5 12h14" /></svg>;
const UpIcon = () => <svg {...icon}><path d="M6 15l6-6 6 6" /></svg>;
const DownIcon = () => <svg {...icon}><path d="M6 9l6 6 6-6" /></svg>;
const TrashIcon = () => <svg {...icon}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;
const EditIcon = () => <svg {...icon}><path d="M4 20h4L19 9a2.1 2.1 0 0 0-3-3L5 17v3zM14 7l3 3" /></svg>;
const ExternalIcon = () => <svg {...icon}><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>;

const STATUS_STYLE = {
  open: 'bg-emerald-500/10 text-emerald-700',
  upcoming: 'bg-tint text-accent-dark',
  hidden: 'bg-soft text-muted',
};

const iconBtn = 'grid h-9 w-9 flex-none place-items-center rounded-full text-muted transition enabled:hover:bg-tint enabled:hover:text-accent disabled:opacity-30';

export default function Careers() {
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => { getCareers().then(setData).catch((err) => setLoadError(err.message)); }, []);

  const roles = data?.roles || [];
  const counts = { all: roles.length, open: 0, upcoming: 0, hidden: 0 };
  for (const r of roles) counts[r.status] += 1;
  const shown = filter === 'all' ? roles : roles.filter((r) => r.status === filter);

  const setRoles = (next) => setData((d) => ({ ...d, roles: next }));

  // A message passed in through navigation (after saving a role) is shown once as a toast.
  const shownFor = useRef(null);
  useEffect(() => {
    if (!location.state?.toast || shownFor.current === location.key) return;
    shownFor.current = location.key;
    toast.success(location.state.toast);
    navigate(location.pathname, { replace: true, state: null });
  }, [location, navigate, toast]);

  // Moves a role past its neighbour in the list being shown; the order is saved at once.
  async function move(role, dir) {
    const i = shown.findIndex((r) => r.id === role.id);
    const other = shown[i + dir];
    if (!other || busy) return;
    const ids = roles.map((r) => r.id);
    const a = ids.indexOf(role.id);
    const b = ids.indexOf(other.id);
    [ids[a], ids[b]] = [ids[b], ids[a]];
    const before = roles;
    setRoles(ids.map((id) => roles.find((r) => r.id === id)));
    setBusy(true);
    try {
      setRoles(await reorderCareerRoles(ids));
    } catch (err) {
      setRoles(before);
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    try {
      await deleteCareerRole(deleting.id);
      setRoles(roles.filter((r) => r.id !== deleting.id));
      toast.success('Role deleted');
      setDeleting(null);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const closeDelete = useCallback(() => setDeleting(null), []);
  const tabs = [['all', 'All'], ['open', 'Open'], ['upcoming', 'Coming soon'], ['hidden', 'Hidden']];

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl">Careers</h1>
            <p className="mt-1 text-sm text-muted">The roles on the Careers page of nandivex.com. Saved changes show on the website straight away.</p>
          </div>
          <a href={SITE_CAREERS_URL} target="_blank" rel="noreferrer" className="btn-line flex-none"><ExternalIcon /> View on website</a>
        </div>

        {loadError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{loadError}</p>}

        {data && (
          <section className="overflow-hidden rounded-2xl border border-line bg-surface shadow-card">
            <div className="flex flex-col gap-3 border-b border-line px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
              <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="Filter roles">
                {tabs.map(([key, label]) => (
                  <button key={key} type="button" role="tab" aria-selected={filter === key} onClick={() => setFilter(key)}
                    className={`rounded-full px-3.5 py-1.5 text-[13px] font-semibold transition ${filter === key ? 'bg-accent text-white' : 'text-muted hover:bg-tint hover:text-accent'}`}>
                    {label} <span className={filter === key ? 'text-white/80' : 'text-muted/70'}>{counts[key]}</span>
                  </button>
                ))}
              </div>
              <Link to="/admin/careers/new" className="btn-solid !py-2.5 text-[13px]"><PlusIcon /> Add role</Link>
            </div>

            {shown.length === 0 ? (
              <div className="p-10 text-center">
                <p className="font-display text-lg font-bold">{roles.length === 0 ? 'No roles yet' : 'No roles here'}</p>
                <p className="mt-1 text-sm text-muted">{roles.length === 0 ? 'Add the first role to show it on the website.' : 'Pick another tab, or add a role.'}</p>
              </div>
            ) : (
              <ul className="divide-y divide-line">
                {shown.map((r, i) => (
                  <li key={r.id} className="flex items-center gap-3 px-4 py-3.5 sm:px-6">
                    <div className="flex flex-none flex-col">
                      <button type="button" onClick={() => move(r, -1)} disabled={i === 0 || busy} aria-label={`Move ${r.title} up`} className={`${iconBtn} !h-7 !w-9`}><UpIcon /></button>
                      <button type="button" onClick={() => move(r, 1)} disabled={i === shown.length - 1 || busy} aria-label={`Move ${r.title} down`} className={`${iconBtn} !h-7 !w-9`}><DownIcon /></button>
                    </div>
                    <Link to={`/admin/careers/${r.id}`} className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-semibold hover:text-accent">{r.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded-full px-2.5 py-0.5 font-semibold ${STATUS_STYLE[r.status]}`}>{STATUS_LABEL[r.status]}</span>
                        <span className="rounded-full bg-soft px-2.5 py-0.5 font-semibold text-muted">{r.kind}</span>
                        {r.skills.length > 0 && <span className="hidden truncate text-muted sm:inline">{r.skills.slice(0, 4).join(', ')}{r.skills.length > 4 ? '…' : ''}</span>}
                      </span>
                    </Link>
                    <Link to={`/admin/careers/${r.id}`} aria-label={`Edit ${r.title}`} className={iconBtn}><EditIcon /></Link>
                    <button type="button" onClick={() => setDeleting(r)} aria-label={`Delete ${r.title}`} className={`${iconBtn} enabled:hover:!bg-red-500/10 enabled:hover:!text-red-600`}><TrashIcon /></button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {data && <CareerInterests />}

        {!data && !loadError && <p className="p-8 text-center text-sm text-muted">Loading…</p>}
      </div>

      {deleting && (
        <Dialog title="Delete this role?" description={`"${deleting.title}" will disappear from the website at once. This cannot be undone. If you may want it again, hide it instead.`} onClose={closeDelete}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeDelete} className="btn-line">Cancel</button>
            <button type="button" onClick={confirmDelete} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">{busy ? 'Deleting…' : 'Delete'}</button>
          </div>
        </Dialog>
      )}
    </AdminLayout>
  );
}
