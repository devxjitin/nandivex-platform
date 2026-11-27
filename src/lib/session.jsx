import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from './api.js';
import { APP_ENABLED } from './flags.js';
import { isManagerRole } from '../data/roles.js';

const Ctx = createContext(null);
export const useSession = () => useContext(Ctx);

/** Holds the signed-in user. `user` is undefined while the first check runs, null when signed out. */
export function SessionProvider({ children }) {
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    if (!APP_ENABLED) { setUser(null); return undefined; }
    let live = true;
    api('/auth/me').then((r) => live && setUser(r.user)).catch(() => live && setUser(null));
    return () => { live = false; };
  }, []);

  const signIn = useCallback(async (email, password) => {
    const { user: u } = await api('/auth/login', { method: 'POST', body: { email, password } });
    setUser(u);
    return u;
  }, []);

  const signOut = useCallback(async () => {
    try { await api('/auth/logout', { method: 'POST' }); } catch { /* cookie expires on its own */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, setUser, signIn, signOut }), [user, signIn, signOut]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const isManager = (user) => !!user && isManagerRole(user.role);

/** Where a signed-in user belongs. */
export function homeFor(user) {
  if (user.mustChangePassword) return '/change-password';
  return '/home';
}

/** Route guard. `manager` also requires an admin-level role. */
export function RequireAuth({ children, manager = false, allowMustChange = false }) {
  const { user } = useSession();
  if (user === undefined) return null;
  if (!user) return <Navigate to="/" replace />;
  if (user.mustChangePassword && !allowMustChange) return <Navigate to="/change-password" replace />;
  if (manager && !isManager(user)) return <Navigate to="/home" replace />;
  return children;
}
