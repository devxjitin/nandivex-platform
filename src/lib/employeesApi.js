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

/** Everything an employee has saved in their profile. The PAN and account number come back masked. */
export async function getEmployeeProfile(id) {
  const { profile } = await api(`/employees/${id}/profile`);
  return profile;
}

/** The full PAN or bank account number. Each call is recorded on the server. field: 'pan' | 'bankAccount' */
export async function revealSecret(id, field) {
  const { value } = await api(`/employees/${id}/profile/reveal`, { method: 'POST', body: { field } });
  return value;
}
