import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { Navigate, Route, RouterProvider, Routes, createBrowserRouter } from 'react-router-dom';
import './index.css';
import Login from './pages/Login.jsx';
import { ToastProvider } from './components/Toast.jsx';
import { RequireAuth, SessionProvider } from './lib/session.jsx';
import { APP_ENABLED } from './lib/flags.js';

/* Every deploy renames the page chunks. A tab that was open before a deploy (or a cached copy of the page) then asks for a
   file that no longer exists, and the page shows "Failed to fetch dynamically imported module". Reload once to pick up the
   new files. The timestamp stops a reload loop if the network is simply down. */
window.addEventListener('vite:preloadError', (event) => {
  try {
    const last = Number(sessionStorage.getItem('chunk-reload-at') || 0);
    if (Date.now() - last < 15000) return;
    sessionStorage.setItem('chunk-reload-at', String(Date.now()));
  } catch { /* storage blocked: reload once anyway */ }
  event.preventDefault();
  window.location.reload();
});

/* In the deployed site APP_ENABLED is false, the bundler drops these imports, and only the sign-in page is served. */

const Employees = APP_ENABLED ? lazy(() => import('./pages/admin/Employees.jsx')) : null;
const Careers = APP_ENABLED ? lazy(() => import('./pages/admin/Careers.jsx')) : null;
const ContactMessages = APP_ENABLED ? lazy(() => import('./pages/admin/ContactMessages.jsx')) : null;
const CareerRole = APP_ENABLED ? lazy(() => import('./pages/admin/CareerRole.jsx')) : null;
const AddEmployee = APP_ENABLED ? lazy(() => import('./pages/admin/AddEmployee.jsx')) : null;
const ChangePassword = APP_ENABLED ? lazy(() => import('./pages/ChangePassword.jsx')) : null;
const ForgotPassword = APP_ENABLED ? lazy(() => import('./pages/ForgotPassword.jsx')) : null;
const ResetPassword = APP_ENABLED ? lazy(() => import('./pages/ResetPassword.jsx')) : null;
const EmployeeProfile = APP_ENABLED ? lazy(() => import('./pages/admin/EmployeeProfile.jsx')) : null;
const Profile = APP_ENABLED ? lazy(() => import('./pages/Profile.jsx')) : null;
const Home = APP_ENABLED ? lazy(() => import('./pages/Home.jsx')) : null;
const Tasks = APP_ENABLED ? lazy(() => import('./pages/Tasks.jsx')) : null;
const TaskPerson = APP_ENABLED ? lazy(() => import('./pages/TaskPerson.jsx')) : null;
const TaskNew = APP_ENABLED ? lazy(() => import('./pages/TaskNew.jsx')) : null;
const TaskDetail = APP_ENABLED ? lazy(() => import('./pages/TaskDetail.jsx')) : null;

function App() {
  return (
    <SessionProvider>
      <ToastProvider>
      <Suspense fallback={null}>
        <Routes>
          <Route path="/" element={<Login />} />
          {APP_ENABLED && (
            <>
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />
              <Route path="/change-password" element={<RequireAuth><ChangePassword /></RequireAuth>} />
              <Route path="/home" element={<RequireAuth><Home /></RequireAuth>} />
              <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
              <Route path="/tasks" element={<RequireAuth><Tasks /></RequireAuth>} />
              <Route path="/tasks/new" element={<RequireAuth manager><TaskNew /></RequireAuth>} />
              <Route path="/tasks/for/:id" element={<RequireAuth manager><TaskPerson /></RequireAuth>} />
              <Route path="/tasks/:id" element={<RequireAuth><TaskDetail /></RequireAuth>} />
              <Route path="/admin" element={<RequireAuth manager><Employees /></RequireAuth>} />
              <Route path="/admin/careers" element={<RequireAuth manager><Careers /></RequireAuth>} />
              <Route path="/admin/contact" element={<RequireAuth manager><ContactMessages /></RequireAuth>} />
              <Route path="/admin/careers/new" element={<RequireAuth manager><CareerRole /></RequireAuth>} />
              <Route path="/admin/careers/:id" element={<RequireAuth manager><CareerRole /></RequireAuth>} />
              <Route path="/admin/employees/new" element={<RequireAuth manager><AddEmployee /></RequireAuth>} />
              <Route path="/admin/employees/:id" element={<RequireAuth manager><EmployeeProfile /></RequireAuth>} />
            </>
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
      </ToastProvider>
    </SessionProvider>
  );
}

// A data router, so a page with unsaved changes can ask before the person leaves (useBlocker).
// One catch-all route renders the whole app above.
const router = createBrowserRouter([{ path: '*', element: <App /> }]);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
