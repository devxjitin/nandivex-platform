import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import AdminLayout from '../../components/admin/AdminLayout.jsx';
import Checkbox from '../../components/Checkbox.jsx';
import Select from '../../components/Select.jsx';
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
const passwordOk = (p) => p.length >= 10 && /[A-Za-z]/.test(p) && /\d/.test(p);

function validate({ name, email, role, password }) {
  const errors = {};
  if (name.trim().length < 2) errors.name = 'Enter the full name.';
  if (!emailRe.test(email.trim())) errors.email = 'Enter a valid email address.';
  if (!role) errors.role = 'Choose a role.';
  else if (!roleNameOk(role)) errors.role = 'Role name: 2 to 40 characters, letters and numbers only.';
  if (!passwordOk(password)) errors.password = 'At least 10 characters, with a letter and a number.';
  return errors;
}

/** Live strength of the password being typed. Below the minimum rule it is always Weak. */
function strengthOf(password) {
  if (!password) return null;
  if (!passwordOk(password)) return { level: 1, label: 'Weak', hint: 'Use 10+ characters with a letter and a number.', bar: 'bg-red-500', text: 'text-red-600' };
  const extras =
    (/[a-z]/.test(password) && /[A-Z]/.test(password) ? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0) +
    (password.length >= 14 ? 1 : 0);
  if (extras === 0) return { level: 2, label: 'Fair', hint: 'Add capitals, a symbol or more length.', bar: 'bg-amber-500', text: 'text-amber-600' };
  if (extras === 1) return { level: 3, label: 'Good', hint: '', bar: 'bg-lime-500', text: 'text-lime-700' };
  return { level: 4, label: 'Strong', hint: '', bar: 'bg-emerald-600', text: 'text-emerald-700' };
}

function FieldError({ id, children }) {
  return children ? <p id={id} className="mt-1.5 text-[13px] text-red-500">{children}</p> : null;
}

function Req() {
  return <span className="ml-0.5 text-red-500" aria-hidden="true">*</span>;
}

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

  const strength = strengthOf(values.password);

  return (
    <AdminLayout>
      <form onSubmit={submit} noValidate className="rounded-2xl border border-line bg-surface shadow-card">
        <div className="grid gap-5 p-6 sm:grid-cols-2 sm:p-8">
          <div>
            <label htmlFor="emp-name" className="mb-1.5 block text-sm font-semibold">Full name<Req /></label>
            <input id="emp-name" value={values.name} onChange={set('name')} autoComplete="off" placeholder="Full name" aria-invalid={!!errors.name} aria-describedby={errors.name ? 'emp-name-err' : undefined} className={cls('name')} />
            <FieldError id="emp-name-err">{errors.name}</FieldError>
          </div>

          <div>
            <label htmlFor="emp-email" className="mb-1.5 block text-sm font-semibold">Email address<Req /></label>
            <input id="emp-email" type="email" value={values.email} onChange={set('email')} autoComplete="off" placeholder="name@example.com" aria-invalid={!!errors.email} aria-describedby={errors.email ? 'emp-email-err' : undefined} className={cls('email')} />
            <FieldError id="emp-email-err">{errors.email}</FieldError>
          </div>

          <div>
            <label htmlFor="emp-role" className="mb-1.5 block text-sm font-semibold">Role<Req /></label>
            <Select
              id="emp-role" value={roleChoice} onChange={(v) => onRoleChange({ target: { value: v } })} placeholder="Select a role"
              options={[...savedRoles.map((r) => ({ value: r, label: r })), { value: OTHER, label: 'Other…' }]}
              invalid={!!errors.role && roleChoice !== OTHER} aria-describedby={errors.role && roleChoice !== OTHER ? 'emp-role-err' : undefined}
            />
            {roleChoice !== OTHER && <FieldError id="emp-role-err">{errors.role}</FieldError>}
          </div>

          {roleChoice === OTHER && (
            <div>
              <label htmlFor="emp-role-name" className="mb-1.5 block text-sm font-semibold">New role name<Req /></label>
              <input id="emp-role-name" value={customRole} onChange={onCustomRoleChange} autoFocus autoComplete="off" placeholder="e.g. Marketing Lead" aria-invalid={!!errors.role} aria-describedby={errors.role ? 'emp-role-err' : undefined} className={cls('role')} />
              <FieldError id="emp-role-err">{errors.role}</FieldError>
            </div>
          )}

          <div className="sm:col-start-1">
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <label htmlFor="emp-password" className="text-sm font-semibold">Password<Req /></label>
              <button type="button" onClick={() => { setValues((v) => ({ ...v, password: generatePassword() })); setShowPw(true); clearError('password'); }} className="text-[13px] font-semibold text-accent hover:text-accent-dark">Generate strong password</button>
            </div>
            <div className="relative">
              <input id="emp-password" type={showPw ? 'text' : 'password'} value={values.password} onChange={set('password')} autoComplete="new-password" placeholder="Set a password" aria-invalid={!!errors.password} aria-describedby="emp-pw-strength" className={`${cls('password')} pr-16 font-mono`} />
              <button type="button" onClick={() => setShowPw((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:text-accent">{showPw ? 'Hide' : 'Show'}</button>
            </div>
            <div id="emp-pw-strength" aria-live="polite" className={strength ? 'mt-2.5 min-h-[34px]' : ''}>
              {strength ? (
                <>
                  <div className="flex gap-1.5" aria-hidden="true">
                    {[1, 2, 3, 4].map((n) => (
                      <span key={n} className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${n <= strength.level ? strength.bar : 'bg-line'}`} />
                    ))}
                  </div>
                  <p className="mt-1.5 text-[13px]">
                    <span className={`font-semibold ${strength.text}`}>{strength.label}</span>
                    {strength.hint && <span className="text-muted"> · {strength.hint}</span>}
                  </p>
                </>
              ) : (
                <FieldError id="emp-pw-err">{errors.password}</FieldError>
              )}
            </div>
          </div>

          <Checkbox checked={mustChange} onChange={(e) => setMustChange(e.target.checked)} className="sm:col-span-2">Ask them to choose a new password at first sign-in</Checkbox>
        </div>

        {formError && (
          <div className="border-t border-line px-6 py-4 sm:px-8">
            <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{formError}</p>
          </div>
        )}

        <div className="flex flex-col-reverse gap-3 border-t border-line px-6 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <p className="text-[13px] text-muted"><Req /> Required</p>
          <div className="flex flex-col-reverse gap-3 sm:flex-row">
            <Link to="/admin" className="btn-line">Cancel</Link>
            <button type="submit" disabled={busy} className="btn-solid">{busy ? 'Creating…' : 'Create account'}</button>
          </div>
        </div>
      </form>
    </AdminLayout>
  );
}
