import { useState } from 'react';
import { Link } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import { api } from '../lib/api.js';

const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function ForgotPassword() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get('email') || '').trim();
    if (!emailRe.test(email)) {
      setError('Enter a valid email address.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api('/auth/forgot-password', { method: 'POST', body: { email } });
      setSentTo(email);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <AuthShell>
        <p className="label">Check your email</p>
        <h2 className="mt-3 text-3xl sm:text-[34px]">Reset link on its way</h2>
        <p className="mt-2 text-[15px] text-muted">
          We have sent a link to <span className="font-semibold text-ink">{sentTo}</span> to reset your password. It works once and expires in 30 minutes.
        </p>
        <p className="mt-4 text-[13px] text-muted">Nothing in your inbox? Check the spam folder, or try again in a minute.</p>
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link to="/" className="btn-solid text-center">Back to sign in</Link>
          <button type="button" onClick={() => setSentTo('')} className="btn-line">Use another email</button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="label">Forgot password</p>
      <h2 className="mt-3 text-3xl sm:text-[34px]">Reset your password</h2>
      <p className="mt-2 text-[15px] text-muted">Enter the email address of your account and we will send you a link to choose a new password.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="email" className="mb-1.5 block text-sm font-semibold">Email</label>
          <input
            id="email" name="email" type="email" autoComplete="email" placeholder="you@example.com" autoFocus
            aria-invalid={!!error} aria-describedby={error ? 'email-err' : undefined}
            className={`field ${error ? 'field-error' : ''}`}
          />
          {error && <p id="email-err" role="alert" className="mt-1.5 text-[13px] text-red-500">{error}</p>}
        </div>

        <button type="submit" disabled={busy} className="btn-solid w-full !py-3.5 text-[15px]">
          {busy ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-8 text-center text-[13px] text-muted">
        <Link to="/" className="font-semibold text-accent hover:text-accent-dark">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
