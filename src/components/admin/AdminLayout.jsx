import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useSession } from '../../lib/session.jsx';
import './shell.css';

/* Fixed sidebar that collapses to icons, a slim top bar with the toggle and breadcrumbs, and the
   account chip with its menu at the bottom of the sidebar. Every page renders its own AdminLayout,
   so the collapsed choice is kept in localStorage and read again on each mount. */

const SIDEBAR_KEY = 'nandivex.sidebar';

function readCollapsed() {
  try { return window.localStorage.getItem(SIDEBAR_KEY) === 'collapsed'; } catch { return false; }
}

const stroke = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };

function PeopleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.6-3.4 3.2-5.5 6.5-5.5s5.9 2.1 6.5 5.5" />
      <path d="M16 4.7a3.5 3.5 0 0 1 0 6.6M18 14.8c1.8.7 3.1 2.4 3.5 5.2" />
    </svg>
  );
}
function PanelIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="M9 4v16" />
    </svg>
  );
}
function ChevronIcon({ size = 14 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke} strokeWidth="2.5"><path d="M9 6l6 6-6 6" /></svg>
  );
}
function LogoutIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" {...stroke}>
      <path d="M9 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h3" />
      <path d="M16 8l4 4-4 4M20 12H9" />
    </svg>
  );
}

const CRUMBS = [
  { match: (p) => p.startsWith('/admin/employees/new'), trail: ['Employees', 'Add employee'] },
  { match: (p) => p.startsWith('/admin'), trail: ['Employees'] },
];

export default function AdminLayout({ children }) {
  const { user, signOut } = useSession();
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const footRef = useRef(null);

  const initial = (user?.name || 'A').trim()[0]?.toUpperCase();
  const trail = (CRUMBS.find((c) => c.match(pathname)) || CRUMBS[CRUMBS.length - 1]).trail;

  // A new page closes the mobile drawer and the account menu.
  useEffect(() => { setOpen(false); setMenuOpen(false); }, [pathname]);

  // The account menu closes on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDown = (e) => { if (!footRef.current?.contains(e.target)) setMenuOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  function toggle() {
    if (window.matchMedia('(max-width: 1023px)').matches) { setOpen((v) => !v); return; }
    const next = !collapsed;
    setCollapsed(next);
    setMenuOpen(false);
    try { window.localStorage.setItem(SIDEBAR_KEY, next ? 'collapsed' : 'expanded'); } catch { /* not remembered */ }
  }

  return (
    <div className={`shell${collapsed ? ' shell-collapsed' : ''}${open ? ' shell-open' : ''}`}>
      <aside className="shell-sidebar" aria-label="Main navigation">
        <div className="shell-head">
          <Link to="/admin" aria-label="NandiVex Technologies" className="shell-brand">
            <img className="shell-logo" src="/brand/logo-horizontal.png" alt="NandiVex Technologies" />
            <img className="shell-icon" src="/brand/app-icon-violet.png" alt="" aria-hidden="true" />
          </Link>
        </div>

        <nav className="shell-nav" aria-label="Admin">
          <div className="shell-label">Menu</div>
          <Link to="/admin" className={`shell-item${pathname.startsWith('/admin') ? ' active' : ''}`} aria-current={pathname.startsWith('/admin') ? 'page' : undefined} title="Employees">
            <span className="shell-ico"><PeopleIcon /></span>
            <span>Employees</span>
          </Link>
        </nav>

        <div className="shell-foot" ref={footRef}>
          {menuOpen && (
            <div className="shell-menu" role="menu" aria-label="Account">
              <div className="shell-menu-head">
                <span className="shell-avatar shell-avatar-lg">{initial}</span>
                <span className="shell-menu-who">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                  <em>{user?.role}</em>
                </span>
              </div>
              <button type="button" role="menuitem" className="shell-menu-item shell-menu-danger" onClick={signOut}>
                <LogoutIcon />
                <span>Sign out</span>
              </button>
            </div>
          )}
          <button type="button" className="shell-chip" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} title={user?.name}>
            <span className="shell-avatar">{initial}</span>
            <span className="shell-meta">
              <strong>{user?.name}</strong>
              <small>{user?.role}</small>
            </span>
            <span className={`shell-caret${menuOpen ? ' open' : ''}`}><ChevronIcon /></span>
          </button>
          <small className="shell-copy">© NandiVex Technologies</small>
        </div>
      </aside>
      {open && <div className="shell-scrim" onClick={() => setOpen(false)} />}

      <div className="shell-main">
        <header className="shell-bar">
          <button type="button" className="shell-toggle" aria-label="Toggle navigation" onClick={toggle}>
            <PanelIcon />
          </button>
          <nav className="shell-crumbs" aria-label="Breadcrumb">
            <span>NandiVex</span>
            {trail.map((c, i) => (
              <span key={c} className={i === trail.length - 1 ? 'current' : undefined}>
                <ChevronIcon />
                {i === trail.length - 1 ? c : <Link to="/admin" className="shell-crumb-link">{c}</Link>}
              </span>
            ))}
          </nav>
          {user?.role && <span className="shell-role" title="Your role">{user.role}</span>}
        </header>
        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
