import { useState } from 'react';
import ThemeToggle from '../components/ThemeToggle.jsx';

const highlights = [
  ['Projects and sprints', 'Every client build, its tasks and delivery dates in one view.'],
  ['Clients and billing', 'Proposals, invoices and payments without spreadsheets.'],
  ['Team and attendance', 'Who is working on what, leave, payroll and onboarding.'],
];

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
  const [errors, setErrors] = useState({});
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');

  function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get('email') || '').trim();
    const password = String(form.get('password') || '');
    const next = {};
    if (!emailRe.test(email)) next.email = 'Enter your work email address.';
    if (password.length < 8) next.password = 'Password must be at least 8 characters.';
    setErrors(next);
    setNotice('');
    if (Object.keys(next).length) return;
    // Backend is not connected yet: the real /auth/login call goes here.
    setBusy(true);
    setTimeout(() => {
      setBusy(false);
      setNotice('Design preview only. The sign-in API is not connected yet.');
    }, 900);
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
          <p className="label !text-white/60">NandiVex Platform</p>
          <h1 className="mt-4 text-[44px] font-extrabold leading-[1.08]">One place to run the whole company.</h1>
          <p className="mt-5 text-base leading-relaxed text-white/70">
            The internal workspace for the NandiVex team: delivery, clients, people and money, kept in step.
          </p>
          <ul className="mt-10 space-y-5">
            {highlights.map(([title, text]) => (
              <li key={title} className="flex gap-4">
                <span className="mt-1 grid h-6 w-6 flex-none place-items-center rounded-full bg-white/10 ring-1 ring-white/20">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12l5 5 9-10" /></svg>
                </span>
                <span>
                  <span className="block font-display text-[15px] font-bold">{title}</span>
                  <span className="block text-sm text-white/60">{text}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative z-10 text-xs text-white/45">© {new Date().getFullYear()} NandiVex Technologies. Authorised team access only.</p>
        <img src="/brand/app-icon-violet.png" alt="" aria-hidden="true" className="float-slow pointer-events-none absolute -bottom-16 -right-16 h-72 w-72 rounded-[64px] opacity-[.12]" />
      </aside>

      {/* Form panel */}
      <main className="relative flex flex-col bg-paper">
        <div className="flex items-center justify-between px-5 py-5 sm:px-8">
          <span className="lg:invisible">
            <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto dark:hidden" />
            <img src="/brand/logo-horizontal-white.png" alt="NandiVex Technologies" className="hidden h-9 w-auto dark:block" />
          </span>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
          <div className="page-in w-full max-w-[420px]">
            <p className="label">Team sign in</p>
            <h2 className="mt-3 text-3xl sm:text-[34px]">Welcome back</h2>
            <p className="mt-2 text-[15px] text-muted">Sign in with your NandiVex work account to continue.</p>

            <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
              <div>
                <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Work email</label>
                <input
                  id="email" name="email" type="email" autoComplete="email" placeholder="you@nandivex.com"
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

              {notice && <p role="status" className="rounded-xl border border-accent/30 bg-tint px-4 py-3 text-[13px] text-ink">{notice}</p>}

              <button type="submit" disabled={busy} className="btn-solid w-full !py-3.5 text-[15px]">
                {busy ? 'Signing in…' : 'Sign in'}
              </button>
            </form>

            <div className="my-6 flex items-center gap-3 text-xs uppercase tracking-widest text-muted">
              <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
            </div>

            <button type="button" className="btn-line w-full !py-3.5 text-[15px]">
              <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M23 12.3c0-.8-.1-1.6-.2-2.3H12v4.4h6.2a5.3 5.3 0 0 1-2.3 3.5v2.9h3.7C21.8 18.8 23 15.8 23 12.3z" /><path fill="#34A853" d="M12 23c3.1 0 5.7-1 7.6-2.8l-3.7-2.9c-1 .7-2.3 1.1-3.9 1.1-3 0-5.5-2-6.4-4.7H1.8v3A11 11 0 0 0 12 23z" /><path fill="#FBBC05" d="M5.6 13.7a6.6 6.6 0 0 1 0-4.2v-3H1.8a11 11 0 0 0 0 10.2l3.8-3z" /><path fill="#EA4335" d="M12 5.4c1.7 0 3.2.6 4.4 1.7l3.3-3.3A11 11 0 0 0 1.8 6.5l3.8 3C6.5 7.4 9 5.4 12 5.4z" /></svg>
              Continue with Google
            </button>

            <p className="mt-8 text-center text-[13px] text-muted">
              No account? Accounts are created by an admin. Ask your team lead or write to{' '}
              <a className="font-semibold text-accent hover:text-accent-dark" href="mailto:contact@nandivex.com">contact@nandivex.com</a>.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
