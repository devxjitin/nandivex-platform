import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import { APP_ENABLED } from '../lib/flags.js';
import { homeFor, useSession } from '../lib/session.jsx';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Eye({ off }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {off && <path d="M3 3l18 18" />}
    </svg>
  );
}

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, signIn } = useSession();
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  // A message passed in by another page, e.g. after a password reset.
  const [notice, setNotice] = useState(location.state?.notice || '');
  const [formError, setFormError] = useState('');

  // Already signed in: go straight to where this person belongs.
  if (user) return <Navigate to={homeFor(user)} replace />;

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const next = {};
    if (!emailRe.test(email)) next.email = 'Enter a valid email address.';
    if (!password) next.password = 'Enter your password.';
    setErrors(next);
    setNotice('');
    setFormError('');
    if (Object.keys(next).length) return;

    if (!APP_ENABLED) {
      setNotice('Sign-in is not available yet.');
      return;
    }
    setBusy(true);
    try {
      const signedIn = await signIn(email, password);
      navigate(homeFor(signedIn), { replace: true });
    } catch (err) {
      setFormError(err.message);
      setBusy(false);
    }
  }

  return (
    <AuthShell>
      <p className="label">Sign in</p>
      <h2 className="mt-3 text-3xl sm:text-[34px]">Welcome back</h2>
      <p className="mt-2 text-[15px] text-muted">Enter your details to continue.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email</label>
          <input
            id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com"
            aria-invalid={!!errors.email} aria-describedby={errors.email ? 'email-err' : undefined}
            className={`field ${errors.email ? 'field-error' : ''}`}
          />
          {errors.email && <p id="email-err" className="mt-1.5 text-[13px] text-red-500">{errors.email}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label htmlFor="password" className="text-sm font-semibold">Password</label>
            {APP_ENABLED && <Link to="/forgot-password" className="text-[13px] font-semibold text-accent hover:text-accent-dark">Forgot password?</Link>}
          </div>
          <div className="relative">
            <input
              id="password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="Enter your password"
              aria-invalid={!!errors.password} aria-describedby={errors.password ? 'pw-err' : undefined}
              className={`field pr-12 ${errors.password ? 'field-error' : ''}`}
            />
            <button
              type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}
              className="absolute right-2 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-full text-muted transition hover:text-accent"
            >
              <Eye off={show} />
            </button>
          </div>
          {errors.password && <p id="pw-err" className="mt-1.5 text-[13px] text-red-500">{errors.password}</p>}
        </div>

        <label className="flex cursor-pointer items-center gap-2.5 text-sm text-muted">
          <input type="checkbox" name="remember" className="h-4 w-4 rounded border-line accent-[rgb(var(--c-accent))]" />
          Keep me signed in on this device
        </label>

        {formError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{formError}</p>}
        {notice && <p role="status" className="rounded-xl border border-accent/30 bg-tint px-4 py-3 text-[13px] text-ink">{notice}</p>}

        <button type="submit" disabled={busy} className="btn-solid w-full !py-3.5 text-[15px]">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-8 text-center text-[13px] text-muted">
        Trouble signing in? Write to{' '}
        <a className="font-semibold text-accent hover:text-accent-dark" href="mailto:contact@nandivex.com">contact@nandivex.com</a>.
      </p>
    </AuthShell>
  );
}
