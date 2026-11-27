import { useSession } from '../../lib/session.jsx';

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3.1 2.4 3.5 5.2" />
    </svg>
  );
}

export default function AdminLayout({ children }) {
  const { user, signOut } = useSession();
  const initial = (user?.name || 'A').trim()[0]?.toUpperCase();

  return (
    <div className="min-h-screen bg-soft lg:grid lg:grid-cols-[250px_1fr]">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between px-5 py-4 lg:block lg:px-6 lg:py-6">
          <img src="/brand/logo-horizontal.png" alt="NandiVex Technologies" className="h-9 w-auto" />
          <button type="button" onClick={signOut} className="text-sm font-semibold text-muted hover:text-accent lg:hidden">Sign out</button>
        </div>

        <nav className="flex gap-1 px-3 pb-3 lg:flex-1 lg:flex-col lg:pb-0" aria-label="Admin">
          <span className="flex items-center gap-3 rounded-xl bg-tint px-3.5 py-2.5 text-sm font-semibold text-accent-dark" aria-current="page">
            <PeopleIcon /> Employees
          </span>
        </nav>

        <div className="hidden border-t border-line p-4 lg:block">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 flex-none place-items-center rounded-full bg-accent font-display text-sm font-bold text-white">{initial}</span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-semibold">{user?.name}</span>
              <span className="block truncate text-xs text-muted">{user?.role}</span>
            </span>
          </div>
          <button type="button" onClick={signOut} className="btn-line mt-4 w-full !py-2.5">Sign out</button>
        </div>
      </aside>

      <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
    </div>
  );
}
