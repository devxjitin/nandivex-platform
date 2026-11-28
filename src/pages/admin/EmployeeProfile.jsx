import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Dialog from '../../components/admin/Dialog.jsx';
import { useToast } from '../../components/Toast.jsx';
import Avatar from '../../components/Avatar.jsx';
import RoleSelect, { roleNameOk } from '../../components/RoleSelect.jsx';
import { getEmployeeProfile, removeEmployee, resetPassword, revealSecret, updateEmployee } from '../../lib/employeesApi.js';
import { useSession } from '../../lib/session.jsx';

const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDob = (ymd) => (ymd ? new Date(`${ymd}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : '');

function Card({ title, children }) {
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <h2 className="border-b border-line px-6 py-4 text-base sm:px-8">{title}</h2>
      <dl className="grid gap-x-6 gap-y-5 p-6 sm:grid-cols-2 sm:p-8">{children}</dl>
    </section>
  );
}

function Item({ label, value, wide = false, mono = false }) {
  return (
    <div className={wide ? 'sm:col-span-2' : undefined}>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className={`mt-1 break-words text-[15px] font-medium ${mono ? 'font-mono' : ''}`}>{value || <span className="text-muted">Not added</span>}</dd>
    </div>
  );
}

/** A PAN or account number: masked until a manager chooses to show it. Showing it is recorded on the server. */
function Secret({ label, saved, last4, load }) {
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function show() {
    setBusy(true);
    setError('');
    try { setValue(await load()); } catch (err) { setError(err.message); } finally { setBusy(false); }
  }

  if (!saved) return <Item label={label} value="" />;
  return (
    <div>
      <dt className="text-[13px] text-muted">{label}</dt>
      <dd className="mt-1 flex items-center gap-3">
        <span className="break-all font-mono text-[15px] font-medium">{value || `••••••${last4}`}</span>
        {value
          ? <button type="button" onClick={() => setValue('')} className="text-[13px] font-semibold text-muted hover:text-accent">Hide</button>
          : <button type="button" onClick={show} disabled={busy} className="text-[13px] font-semibold text-accent hover:text-accent-dark disabled:opacity-60">{busy ? 'Loading…' : 'Show'}</button>}
      </dd>
      {error && <p className="mt-1 text-[13px] text-red-500">{error}</p>}
    </div>
  );
}

const iconProps = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
const KeyIcon = () => <svg {...iconProps}><circle cx="8" cy="15" r="4" /><path d="M10.8 12.2 20 3M16 7l3 3M14 9l2 2" /></svg>;
const TrashIcon = () => <svg {...iconProps}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" /></svg>;

const addressText = (a) => {
  // The country alone is not an address.
  if (![a.line1, a.line2, a.city, a.state, a.pincode].some((x) => x && x.trim())) return '';
  return [a.line1, a.line2, [a.city, a.state].filter(Boolean).join(', '), [a.pincode, a.country].filter(Boolean).join(' ')].filter((x) => x && x.trim()).join('\n');
};

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Name, email and role are set by an admin. The employee cannot change them, so this is the only place they are edited. */
function AccountCard({ id, p, onSaved }) {
  const { user: me, setUser } = useSession();
  const toast = useToast();
  const [v, setV] = useState({ name: p.fullName, email: p.email, role: p.role });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const dirty = v.name !== p.fullName || v.email !== p.email || v.role !== p.role;
  const set = (k) => (val) => { setV((x) => ({ ...x, [k]: val })); setErrors((x) => ({ ...x, [k]: undefined })); };

  async function save(e) {
    e.preventDefault();
    const found = {};
    if (v.name.trim().length < 2) found.name = 'Enter the full name.';
    if (!emailRe.test(v.email.trim())) found.email = 'Enter a valid email address.';
    if (!v.role.trim()) found.role = 'Choose a role.';
    else if (!roleNameOk(v.role)) found.role = 'Role name: 2 to 40 characters, letters and numbers only.';
    setErrors(found);
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const updated = await updateEmployee(id, v);
      if (me?.id === id) setUser(updated);
      onSaved(updated);
      toast.success('Account details saved');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const input = (k) => `field ${errors[k] ? 'field-error' : ''}`;
  return (
    <section className="rounded-2xl border border-line bg-surface shadow-card">
      <h2 className="border-b border-line px-6 py-4 text-base sm:px-8">Account</h2>
      <form onSubmit={save} noValidate className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
        <div>
          <label htmlFor="acc-name" className="mb-1.5 block text-sm font-semibold">Full name</label>
          <input id="acc-name" value={v.name} onChange={(e) => set('name')(e.target.value)} autoComplete="off" aria-invalid={!!errors.name} className={input('name')} />
          {errors.name && <p className="mt-1.5 text-[13px] text-red-500">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="acc-email" className="mb-1.5 block text-sm font-semibold">Email</label>
          <input id="acc-email" type="email" value={v.email} onChange={(e) => set('email')(e.target.value)} autoComplete="off" aria-invalid={!!errors.email} className={input('email')} />
          {errors.email && <p className="mt-1.5 text-[13px] text-red-500">{errors.email}</p>}
        </div>
        <div>
          <label htmlFor="acc-role" className="mb-1.5 block text-sm font-semibold">Role</label>
          <RoleSelect id="acc-role" value={v.role} onChange={set('role')} invalid={!!errors.role} />
          {errors.role && <p className="mt-1.5 text-[13px] text-red-500">{errors.role}</p>}
        </div>
        <div className="flex items-end gap-3 sm:justify-end">
          {dirty && !busy && (
            <button type="button" onClick={() => { setV({ name: p.fullName, email: p.email, role: p.role }); setErrors({}); }} className="text-[13px] font-semibold text-muted transition hover:text-accent">Discard</button>
          )}
          <button type="submit" disabled={!dirty || busy} className="btn-solid !px-5 !py-2.5 text-[13px]">{busy ? 'Saving…' : 'Save changes'}</button>
        </div>
      </form>
    </section>
  );
}

export default function EmployeeProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user: me } = useSession();
  const [p, setP] = useState(null);
  const [error, setError] = useState('');
  const [removing, setRemoving] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  useEffect(() => {
    setP(null);
    setError('');
    getEmployeeProfile(id).then(setP).catch((err) => setError(err.message));
  }, [id]);

  const closeRemove = useCallback(() => setRemoving(false), []);
  const isMe = me?.id === id;

  async function onResend() {
    setBusy(true);
    try {
      const { emailSent } = await resetPassword(id);
      if (emailSent) toast.success(`A new password was emailed to ${p.email}`);
      else toast.error('The password was changed but the email could not be sent. Try again.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function onRemove() {
    setBusy(true);
    try {
      await removeEmployee(id);
      navigate('/admin', { state: { toast: `${p.fullName} was removed.` } });
    } catch (err) {
      toast.error(err.message);
      setRemoving(false);
      setBusy(false);
    }
  }

  const current = p ? addressText(p.currentAddress) : '';
  const permanent = p ? addressText(p.permanentAddress) : '';

  return (
    <AdminLayout>
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}

      {p && (
        <div className="space-y-6">
          <section className="flex flex-col gap-6 rounded-2xl border border-line bg-surface p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
            <Avatar
              user={{ name: p.fullName, photoVersion: p.photoVersion }} path={`/employees/${id}/photo`}
              className="grid h-24 w-24 flex-none place-items-center overflow-hidden rounded-full bg-accent font-display text-3xl font-bold text-white"
            />
            <div className="min-w-0">
              <h1 className="truncate text-2xl sm:text-3xl">{p.fullName}</h1>
              <p className="mt-1 truncate text-sm text-muted">{p.email}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="rounded-full bg-tint px-3 py-1 text-xs font-semibold text-accent-dark">{p.role}</span>
                <span className="text-xs text-muted">Member since {fmtDate(p.createdAt)}</span>
              </div>
            </div>
          </section>

          <AccountCard key={`${p.fullName}|${p.email}|${p.role}`} id={id} p={p} onSaved={(u) => setP((x) => ({ ...x, fullName: u.name, email: u.email, role: u.role }))} />

          <Card title="Personal">
            <Item label="Date of birth" value={fmtDob(p.dateOfBirth)} />
            <Item label="Mobile number" value={p.phone} />
            <Item label="Gender" value={p.gender} />
            <Item label="Blood group" value={p.bloodGroup} />
          </Card>

          <Card title="Address">
            <Item label="Current address" value={current && <span className="whitespace-pre-line">{current}</span>} />
            <Item label="Permanent address" value={permanent && <span className="whitespace-pre-line">{permanent}</span>} />
          </Card>

          <Card title="PAN and bank details">
            <Secret label="PAN number" saved={p.pan.saved} last4={p.pan.last4} load={() => revealSecret(id, 'pan')} />
            <Item label="Account holder name" value={p.bank.holder} />
            <Item label="Bank name" value={p.bank.name} />
            <Secret label="Account number" saved={p.bank.accountSaved} last4={p.bank.accountLast4} load={() => revealSecret(id, 'bankAccount')} />
            <Item label="IFSC code" value={p.bank.ifsc} mono />
            <Item label="Branch" value={p.bank.branch} />
          </Card>

          <section className="rounded-2xl border border-line bg-surface shadow-card">
            <h2 className="border-b border-line px-6 py-4 text-base sm:px-8">Actions</h2>
            <div className="flex flex-col gap-3 p-6 sm:flex-row sm:flex-wrap sm:items-center sm:p-8">
              <button type="button" onClick={onResend} disabled={isMe || busy} className="btn-line">
                <KeyIcon /> New password
              </button>
              <button type="button" onClick={() => setRemoving(true)} disabled={isMe || busy} className="btn border-red-500/40 bg-surface text-red-600 hover:border-red-600 hover:bg-red-500/5">
                <TrashIcon /> Remove employee
              </button>
              {isMe && <p className="text-[13px] text-muted">You cannot reset or remove your own account here.</p>}
            </div>
          </section>
        </div>
      )}

      {removing && p && (
        <Dialog title="Remove employee?" description={`${p.fullName} (${p.email}) will lose access to the platform.`} onClose={closeRemove}>
          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={closeRemove} className="btn-line">Cancel</button>
            <button type="button" onClick={onRemove} disabled={busy} className="btn border-red-600 bg-red-600 text-white hover:bg-red-700">Remove</button>
          </div>
        </Dialog>
      )}

    </AdminLayout>
  );
}
