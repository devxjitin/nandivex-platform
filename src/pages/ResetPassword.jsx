import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import AuthShell from '../components/AuthShell.jsx';
import { api } from '../lib/api.js';

export default function ResetPassword() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [show, setShow] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const newPassword = String(form.get('next') || '');
    const confirm = String(form.get('confirm') || '');
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('Password needs at least 10 characters, with a letter and a number.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await api('/auth/reset-password', { method: 'POST', body: { token, newPassword } });
      navigate('/', { replace: true, state: { notice: 'Your password has been changed. Sign in with the new password.' } });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  if (!token) {
    return (
      <AuthShell>
        <p className="label">Reset password</p>
        <h2 className="mt-3 text-3xl sm:text-[34px]">This link is incomplete</h2>
        <p className="mt-2 text-[15px] text-muted">Open the link from the email exactly as it was sent, or ask for a new one.</p>
        <Link to="/forgot-password" className="btn-solid mt-8 inline-block text-center">Ask for a new link</Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell>
      <p className="label">Reset password</p>
      <h2 className="mt-3 text-3xl sm:text-[34px]">Choose a new password</h2>
      <p className="mt-2 text-[15px] text-muted">Pick a password you have not used before. You will sign in with it right after.</p>

      <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
        <div>
          <label htmlFor="next" className="mb-1.5 block text-sm font-semibold">New password</label>
          <div className="relative">
            <input id="next" name="next" type={show ? 'text' : 'password'} autoComplete="new-password" autoFocus className="field pr-16" />
            <button type="button" onClick={() => setShow((s) => !s)} className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-3 py-1.5 text-[13px] font-semibold text-muted transition hover:text-accent">{show ? 'Hide' : 'Show'}</button>
          </div>
          <p className="mt-1.5 text-[13px] text-muted">At least 10 characters, with a letter and a number.</p>
        </div>
        <div>
          <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">Confirm new password</label>
          <input id="confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" className="field" />
        </div>

        {error && (
          <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">
            {error}{' '}
            {/not valid any more/i.test(error) && <Link to="/forgot-password" className="font-semibold underline">Ask for a new link</Link>}
          </p>
        )}

        <button type="submit" disabled={busy} className="btn-solid w-full !py-3.5 text-[15px]">{busy ? 'Saving…' : 'Save new password'}</button>
      </form>

      <p className="mt-8 text-center text-[13px] text-muted">
        <Link to="/" className="font-semibold text-accent hover:text-accent-dark">Back to sign in</Link>
      </p>
    </AuthShell>
  );
}
