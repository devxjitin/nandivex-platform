import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { homeFor, useSession } from '../lib/session.jsx';

export default function ChangePassword() {
  const navigate = useNavigate();
  const { user, setUser, signOut } = useSession();
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function onSubmit(e) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const currentPassword = String(form.get('current') || '');
    const newPassword = String(form.get('next') || '');
    const confirm = String(form.get('confirm') || '');
    if (newPassword.length < 10 || !/[A-Za-z]/.test(newPassword) || !/\d/.test(newPassword)) {
      setError('New password needs at least 10 characters, with a letter and a number.');
      return;
    }
    if (newPassword !== confirm) {
      setError('The two new passwords do not match.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      const { user: updated } = await api('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
      setUser(updated);
      navigate(homeFor(updated), { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-paper">
      <div className="px-5 py-5 sm:px-8">
        <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto" />
      </div>
      <div className="flex flex-1 items-center justify-center px-5 pb-12 sm:px-8">
        <div className="page-in w-full max-w-[420px]">
          <p className="label">Set your password</p>
          <h1 className="mt-3 text-3xl">Choose a new password</h1>
          <p className="mt-2 text-[15px] text-muted">
            {user?.mustChangePassword
              ? 'The password you were emailed is temporary. Choose your own to continue.'
              : 'Pick a new password for your account.'}
          </p>

          <form onSubmit={onSubmit} noValidate className="mt-8 space-y-5">
            <div>
              <label htmlFor="current" className="mb-1.5 block text-sm font-semibold">Current password</label>
              <input id="current" name="current" type="password" autoComplete="current-password" className="field" />
            </div>
            <div>
              <label htmlFor="next" className="mb-1.5 block text-sm font-semibold">New password</label>
              <input id="next" name="next" type="password" autoComplete="new-password" className="field" />
              <p className="mt-1.5 text-[13px] text-muted">At least 10 characters, with a letter and a number.</p>
            </div>
            <div>
              <label htmlFor="confirm" className="mb-1.5 block text-sm font-semibold">Confirm new password</label>
              <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="field" />
            </div>

            {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-600">{error}</p>}

            <button type="submit" disabled={busy} className="btn-solid w-full !py-3.5 text-[15px]">{busy ? 'Saving…' : 'Save password'}</button>
            <button type="button" onClick={signOut} className="w-full text-center text-sm font-semibold text-muted hover:text-accent">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
