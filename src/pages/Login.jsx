import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
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
  const { user, signIn } = useSession();
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <aside
        className="relative hidden overflow-hidden bg-night p-12 text-white lg:flex lg:flex-col lg:justify-between"
        style={{ backgroundImage: 'radial-gradient(900px 500px at 90% -10%, rgba(154,106,242,.55), transparent 60%), radial-gradient(700px 500px at -10% 110%, rgba(90,36,176,.7), transparent 60%), linear-gradient(160deg, #150E24 0%, #2A1B4D 60%, #3B2270 100%)' }}
      >
        <img src="/brand/logo-horizontal-white.png" alt="NandiVex Technologies" className="h-12 w-auto self-start" />

        <div className="relative z-10 max-w-md">
          <h1 className="text-[44px] font-extrabold leading-[1.08]">Software, apps and automation for businesses.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/70">Welcome to NandiVex Technologies.</p>
        </div>

        <p className="relative z-10 text-xs text-white/45">© {new Date().getFullYear()} NandiVex Technologies. All rights reserved.</p>
        <img src="/brand/app-icon-violet.png" alt="" aria-hidden="true" className="float-slow pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-[64px] opacity-[.12]" />
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col bg-paper">
        <div className="px-5 py-5 sm:px-8 lg:hidden">
          <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto" />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="page-in w-full max-w-[420px]">
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
                  <a href="#forgot" className="text-[13px] font-semibold text-accent hover:text-accent-dark">Forgot password?</a>
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
          </div>
        </div>
      </main>
    </div>
  );
}
