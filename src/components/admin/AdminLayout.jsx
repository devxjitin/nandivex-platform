import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import Avatar from '../Avatar.jsx';
import NotificationBell from '../NotificationBell.jsx';
import { homeFor, isManager, useSession } from '../../lib/session.jsx';
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
function GlobeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.9 5.6 3.9 9s-1.3 6.4-3.9 9c-2.6-2.6-3.9-5.6-3.9-9S9.4 5.6 12 3z" />
    </svg>
  );
}
function UserIcon({ size = 18 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...stroke}>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-4 3.7-6 7.5-6s6.7 2 7.5 6" />
    </svg>
  );
}
function HomeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <path d="M3.5 11 12 4l8.5 7" />
      <path d="M5.5 10v9.5h13V10" />
    </svg>
  );
}
function TasksIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" {...stroke}>
      <rect x="4" y="3.5" width="16" height="17" rx="3" />
      <path d="M8.5 9.5l1.7 1.7 3.3-3.4M8.5 15.5h7" />
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

/** Breadcrumb trail per page. Items with `to` link back. */
const CRUMBS = [
  { match: (p) => p.startsWith('/admin/employees/new'), trail: [{ label: 'Employees', to: '/admin' }, { label: 'Add employee' }] },
  { match: (p) => /^\/admin\/employees\/[^/]+/.test(p), trail: [{ label: 'Employees', to: '/admin' }, { label: 'Details' }] },
  { match: (p) => p === '/admin/careers/new', trail: [{ label: 'Website' }, { label: 'Careers', to: '/admin/careers' }, { label: 'Add role' }] },
  { match: (p) => /^\/admin\/careers\/[^/]+/.test(p), trail: [{ label: 'Website' }, { label: 'Careers', to: '/admin/careers' }, { label: 'Edit role' }] },
  { match: (p) => p.startsWith('/admin/careers'), trail: [{ label: 'Website' }, { label: 'Careers' }] },
  { match: (p) => p.startsWith('/admin/contact'), trail: [{ label: 'Website' }, { label: 'Contact' }] },
  { match: (p) => p.startsWith('/admin'), trail: [{ label: 'Employees' }] },
  { match: (p) => p === '/tasks/new', trail: [{ label: 'Tasks', to: '/tasks' }, { label: 'Assign task' }] },
  { match: (p) => /^\/tasks\/[^/]+/.test(p), trail: [{ label: 'Tasks', to: '/tasks' }, { label: 'Task' }] },
  { match: (p) => p.startsWith('/tasks'), trail: [{ label: 'Tasks' }] },
  { match: (p) => p.startsWith('/profile'), trail: [{ label: 'Profile' }] },
  { match: (p) => p.startsWith('/home'), trail: [{ label: 'Home' }] },
];

export default function AdminLayout({ children }) {
  const { user, signOut } = useSession();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(readCollapsed);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const footRef = useRef(null);
  const careersActive = pathname.startsWith('/admin/careers');
  const contactActive = pathname.startsWith('/admin/contact');
  const websiteActive = careersActive || contactActive;
  const [siteOpen, setSiteOpen] = useState(websiteActive);
  useEffect(() => { if (websiteActive) setSiteOpen(true); }, [websiteActive]);

  const manager = isManager(user);
  const nav = [
    { to: '/home', label: 'Home', icon: <HomeIcon />, active: pathname.startsWith('/home') },
    { to: '/tasks', label: 'Tasks', icon: <TasksIcon />, active: pathname.startsWith('/tasks') },
    ...(manager ? [
      { to: '/admin', label: 'Employees', icon: <PeopleIcon />, active: pathname.startsWith('/admin') && !websiteActive },
    ] : []),
  ];
  const trail = (CRUMBS.find((c) => c.match(pathname)) || CRUMBS[0]).trail;

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
          <Link to={user ? homeFor(user) : '/'} aria-label="NandiVex Technologies" className="shell-brand">
            <img className="shell-logo" src="/brand/logo-horizontal.png" alt="NandiVex Technologies" />
            <img className="shell-icon" src="/brand/app-icon-violet.png" alt="" aria-hidden="true" />
          </Link>
        </div>

        <nav className="shell-nav" aria-label="Main">
          <div className="shell-label">Menu</div>
          {nav.map((item) => (
            <Link key={item.to} to={item.to} className={`shell-item${item.active ? ' active' : ''}`} aria-current={item.active ? 'page' : undefined} title={item.label}>
              <span className="shell-ico">{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {manager && (
            <>
              <button type="button" className={`shell-item shell-group${websiteActive ? ' has-active' : ''}`} aria-expanded={siteOpen} title="Website"
                onClick={() => { if (collapsed) navigate('/admin/careers'); else setSiteOpen((v) => !v); }}>
                <span className="shell-ico"><GlobeIcon /></span>
                <span>Website</span>
                <span className={`shell-gcaret${siteOpen ? ' open' : ''}`}><ChevronIcon /></span>
              </button>
              {siteOpen && (
                <div className="shell-sub">
                  <Link to="/admin/careers" className={`shell-subitem${careersActive ? ' active' : ''}`} aria-current={careersActive ? 'page' : undefined}>Careers</Link>
                  <Link to="/admin/contact" className={`shell-subitem${contactActive ? ' active' : ''}`} aria-current={contactActive ? 'page' : undefined}>Contact</Link>
                </div>
              )}
            </>
          )}
        </nav>

        <div className="shell-foot" ref={footRef}>
          {menuOpen && (
            <div className="shell-menu" role="menu" aria-label="Account">
              <div className="shell-menu-head">
                <Avatar user={user} className="shell-avatar shell-avatar-lg" />
                <span className="shell-menu-who">
                  <strong>{user?.name}</strong>
                  <small>{user?.email}</small>
                  <em>{user?.role}</em>
                </span>
              </div>
              <Link to="/profile" role="menuitem" className="shell-menu-item">
                <UserIcon size={16} />
                <span>Profile</span>
              </Link>
              <button type="button" role="menuitem" className="shell-menu-item shell-menu-danger" onClick={signOut}>
                <LogoutIcon />
                <span>Sign out</span>
              </button>
            </div>
          )}
          <button type="button" className="shell-chip" aria-haspopup="menu" aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)} title={user?.name}>
            <Avatar user={user} className="shell-avatar" />
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
            {trail.map((c, i) => (
              <span key={c.label} className={i === trail.length - 1 ? 'current' : undefined}>
                {i > 0 && <ChevronIcon />}
                {c.to ? <Link to={c.to} className="shell-crumb-link">{c.label}</Link> : c.label}
              </span>
            ))}
          </nav>
          <div className="shell-right">
            {/* A page can put its own buttons here (see Profile) through a portal. */}
            <div id="shell-actions" className="shell-actions" />
            <NotificationBell />
          </div>
        </header>
        <main className="min-w-0 px-5 py-8 sm:px-8 lg:px-10 lg:py-10">{children}</main>
      </div>
    </div>
  );
}
