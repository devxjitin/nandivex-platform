import { useSession } from '../lib/session.jsx';

/* Landing page for signed-in people who are not admins. The workspace modules will live here. */
export default function Home() {
  const { user, signOut } = useSession();
  return (
    <div className="flex min-h-screen flex-col bg-soft">
      <header className="flex items-center justify-between border-b border-line bg-surface px-5 py-4 sm:px-8">
        <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto" />
        <button type="button" onClick={signOut} className="btn-line !py-2">Sign out</button>
      </header>
      <main className="mx-auto w-full max-w-3xl px-5 py-14 sm:px-8">
        <p className="label">{user?.role}</p>
        <h1 className="mt-3 text-3xl sm:text-4xl">Welcome, {user?.name}</h1>
        <p className="mt-3 text-[15px] text-muted">You are signed in. Your workspace is being set up.</p>
      </main>
    </div>
  );
}
