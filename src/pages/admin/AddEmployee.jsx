import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import { createEmployee, listRoles } from '../../lib/employeesApi.js';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** 14 characters from an unambiguous alphabet, with at least one lowercase, uppercase, digit and symbol. */
function generatePassword() {
  const sets = ['abcdefghijkmnpqrstuvwxyz', 'ABCDEFGHJKLMNPQRSTUVWXYZ', '23456789', '!@#$%&*?'];
  const all = sets.join('');
  const pick = (chars) => chars[crypto.getRandomValues(new Uint32Array(1))[0] % chars.length];
  const out = sets.map(pick);
  while (out.length < 14) out.push(pick(all));
  for (let i = out.length - 1; i > 0; i--) {
    const j = crypto.getRandomValues(new Uint32Array(1))[0] % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out.join('');
}

const OTHER = '__other__';
const roleNameOk = (s) => /^[\p{L}\p{N} &/.+()-]{2,40}$/u.test(s.trim().replace(/\s+/g, ' '));

function validate({ name, email, role, password }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Enter the full name.';
  if (!emailRe.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!role) errors.role = 'Choose a role.';
  else if (!roleNameOk(role)) errors.role = 'Role name: 2 to 40 characters, letters and numbers only.';
  if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    errors.password = 'At least 10 characters, with a letter and a number.';
  }
  return errors;
}

function FieldError({ id, children }) {
  return children ? <p id={id} className="mt-1.5 text-[13px] text-red-500">{children}</p> : null;
}

const steps = [
  ['Account is created', 'With the role and password you set here.'],
  ['Login details are emailed', 'The email goes to the address you enter, right away.'],
  ['They sign in', 'And change the password if you asked them to.'],
];

export default function AddEmployee() {
  const navigate = useNavigate();
  const [values, setValues] = useState({ name: '', email: '', role: '', password: '' });
  const [savedRoles, setSavedRoles] = useState([]);
  const [roleChoice, setRoleChoice] = useState('');
  const [customRole, setCustomRole] = useState('');
  // Roles come from the API. If it fails the admin can still type a role through "Other".
  useEffect(() => { listRoles().then(setSavedRoles).catch(() => {}); }, []);
  const [mustChange, setMustChange] = useState(true);
  const [showPw, setShowPw] = useState(false);
  const [errors, setErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [busy, setBusy] = useState(false);

  const clearError = (...keys) => setErrors((prev) => {
    const next = { ...prev };
    keys.forEach((k) => delete next[k]);
    return next;
  });
  const set = (key) => (e) => { setValues((v) => ({ ...v, [key]: e.target.value })); clearError(key); };
  const cls = (key) => `field ${errors[key] ? 'field-error' : ''}`;

  function onRoleChange(e) {
    const choice = e.target.value;
    setRoleChoice(choice);
    clearError('role');
    setValues((v) => ({ ...v, role: choice === OTHER ? customRole : choice }));
  }

  function onCustomRoleChange(e) {
    setCustomRole(e.target.value);
    clearError('role');
    setValues((v) => ({ ...v, role: e.target.value }));
  }

  async function submit(e) {
    e.preventDefault();
    const found = validate(values);
    setErrors(found);
    setFormError('');
    if (Object.keys(found).length) return;
    setBusy(true);
    try {
      const { employee, emailSent } = await createEmployee({ ...values, mustChangePassword: mustChange });
      navigate('/admin', {
        state: emailSent
          ? { toast: `Account created. Login details emailed to ${employee.email}.` }
          : { ok: false, toast: `Account created, but the email to ${employee.email} could not be sent. Use "New password" to try again.` },
      });
    } catch (err) {
      setFormError(err.message || 'Could not create the account. Try again.');
      setBusy(false);
    }
  }

  return (
    <AdminLayout>
      <Link to="/admin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition hover:text-accent">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg>
        Employees
      </Link>

      <div className="mt-6">
        <p className="label">Admin</p>
        <h1 className="mt-2 text-3xl sm:text-4xl">Add employee</h1>
        <p className="mt-2 max-w-xl text-[15px] text-muted">Create the account and set the role and password. The login details are emailed as soon as it is created.</p>
      </div>

      <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_320px]">
        <form onSubmit={submit} noValidate className="space-y-8 rounded-2xl border border-line bg-surface p-6 shadow-card sm:p-8">
          <section>
            <h2 className="text-lg">Person</h2>
            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="emp-name" className="mb-1.5 block text-sm font-semibold">Full name</label>
                <input id="emp-name" value={values.name} onChange={set('name')} autoComplete="off" placeholder="Full name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'emp-name-err' : undefined} className={cls('name')} />
                <FieldError id="emp-name-err">{errors.name}</FieldError>
              </div>
              <div>
                <label htmlFor="emp-email" className="mb-1.5 block text-sm font-semibold">Email</label>
                <input id="emp-email" type="email" value={values.email} onChange={set('email')} autoComplete="off" placeholder="name@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'emp-email-err' : undefined} className={cls('email')} />
                <FieldError id="emp-email-err">{errors.email}</FieldError>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg">Access</h2>
            <div className="mt-5 space-y-5">
              <div className="grid gap-5 sm:max-w-xl sm:grid-cols-2">
                <div>
                  <label htmlFor="emp-role" className="mb-1.5 block text-sm font-semibold">Role</label>
                  <select id="emp-role" value={roleChoice} onChange={onRoleChange} aria-invalid={!!errors.role && roleChoice !== OTHER} aria-describedby={errors.role && roleChoice !== OTHER ? 'emp-role-err' : undefined} className={cls('role')}>
                    <option value="" disabled>Select a role</option>
                    {savedRoles.map((r) => <option key={r} value={r}>{r}</option>)}
                    <option value={OTHER}>Other…</option>
                  </select>
                  {roleChoice !== OTHER && <FieldError id="emp-role-err">{errors.role}</FieldError>}
                </div>
                {roleChoice === OTHER && (
                  <div>
                    <label htmlFor="emp-role-name" className="mb-1.5 block text-sm font-semibold">Role name</label>
                    <input id="emp-role-name" value={customRole} onChange={onCustomRoleChange} autoFocus autoComplete="off" placeholder="e.g. Marketing Lead" aria-invalid={!!errors.role} aria-describedby={errors.role ? 'emp-role-err' : undefined} className={cls('role')} />
                    <FieldError id="emp-role-err">{errors.role}</FieldError>
                  </div>
                )}
              </div>

              <div className="sm:max-w-md">
                <div className="mb-1.5 flex items-center justify-between">
                  <label htmlFor="emp-password" className="text-sm font-semibold">Password</label>
                  <button type="button" onClick={() => { setValues((v) => ({ ...v, password: generatePassword() })); setShowPw(true); clearError('password'); }} className="text-[13px] font-semibold text-accent hover:text-accent-dark">Generate strong password</button>
                </div>
                <div className="relative">
                  <input id="emp-password" type={showPw ? 'text' : 'password'} value={values.password} onChange={set('password')} autoComplete="new-password" placeholder="Set a password" aria-invalid={!!errors.password} aria-describedby={errors.password ? 'emp-pw-err' : undefined} className={`${cls('password')} pr-16 font-mono`} />
                  <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:text-accent">{showPw ? 'Hide' : 'Show'}</button>
                </div>
                <FieldError id="emp-pw-err">{errors.password}</FieldError>
              </div>

              <label className="flex cursor-pointer items-start gap-2.5 text-sm text-muted">
                <input type="checkbox" checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-line accent-[rgb(var(--c-accent))]" />
                <span>Ask them to change this password the first time they sign in <span className="text-ink/70">(recommended, since it travels by email)</span></span>
              </label>
            </div>
          </section>

          {formError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{formError}</p>}

          <div className="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
            <Link to="/admin" className="btn-line">Cancel</Link>
            <button type="submit" disabled={busy} className="btn-solid">{busy ? 'Creating…' : 'Create account and send email'}</button>
          </div>
        </form>

        <aside className="rounded-2xl border border-line bg-surface p-6 shadow-card xl:sticky xl:top-10">
          <h2 className="text-lg">What happens next</h2>
          <ol className="mt-5 space-y-5">
            {steps.map(([title, text], i) => (
              <li key={title} className="flex gap-3.5">
                <span className="grid h-7 w-7 flex-none place-items-center rounded-full bg-tint font-display text-sm font-bold text-accent-dark">{i + 1}</span>
                <span>
                  <span className="block text-sm font-semibold">{title}</span>
                  <span className="block text-[13px] text-muted">{text}</span>
                </span>
              </li>
            ))}
          </ol>
        </aside>
      </div>
    </AdminLayout>
  );
}
