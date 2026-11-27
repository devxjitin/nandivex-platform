import { api } from './api.js';

export async function listEmployees() {
  const { employees } = await api('/employees');
  return employees;
}

/** Creates the account; the API emails the login details. Returns { employee, emailSent }. */
export function createEmployee({ name, email, role, password, mustChangePassword }) {
  return api('/employees', { method: 'POST', body: { name, email, role, password, mustChangePassword } });
}

/** Sets a new temporary password and emails it. Returns { emailSent }. */
export function resetPassword(id) {
  return api(`/employees/${id}/reset-password`, { method: 'POST' });
}

export function removeEmployee(id) {
  return api(`/employees/${id}`, { method: 'DELETE' });
}

/** Every role used so far, for the role dropdown. */
export async function listRoles() {
  const { roles } = await api('/roles');
  return roles;
}
