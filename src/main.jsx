import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import './index.css';
import Login from './pages/Login.jsx';
import { RequireAuth, SessionProvider } from './lib/session.jsx';
import { APP_ENABLED } from './lib/flags.js';

/* In the deployed site APP_ENABLED is false, the bundler drops these imports, and only the sign-in page is served. */

const Employees = APP_ENABLED ? lazy(() => import('./pages/admin/Employees.jsx')) : null;
const AddEmployee = APP_ENABLED ? lazy(() => import('./pages/admin/AddEmployee.jsx')) : null;
const ChangePassword = APP_ENABLED ? lazy(() => import('./pages/ChangePassword.jsx')) : null;
const Home = APP_ENABLED ? lazy(() => import('./pages/Home.jsx')) : null;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <SessionProvider>
        <Suspense fallback={null}>
          <Routes>
            <Route path="/" element={<Login />} />
            {APP_ENABLED && (
              <>
                <Route path="/change-password" element={<RequireAuth allowMustChange><ChangePassword /></RequireAuth>} />
                <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
                <Route path="/admin" element={<RequireAuth manager><Employees /></RequireAuth>} />
                <Route path="/admin/employees/new" element={<RequireAuth manager><AddEmployee /></RequireAuth>} />
              </>
            )}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </SessionProvider>
    </BrowserRouter>
  </StrictMode>,
);
