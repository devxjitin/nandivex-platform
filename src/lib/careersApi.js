import { api } from './api.js';

/** The Careers page of the website: { settings: { statusTitle, statusText }, roles: [...] }, hidden roles included. */
export function getCareers() {
  return api('/careers');
}

/** The message shown on the website while no role is open. Returns the saved settings. */
export async function saveCareerSettings({ statusTitle, statusText }) {
  const { settings } = await api('/careers/settings', { method: 'PUT', body: { statusTitle, statusText } });
  return settings;
}

export async function addCareerRole(role) {
  const { role: saved } = await api('/careers/roles', { method: 'POST', body: role });
  return saved;
}

export async function saveCareerRole(id, role) {
  const { role: saved } = await api(`/careers/roles/${id}`, { method: 'PUT', body: role });
  return saved;
}

export function deleteCareerRole(id) {
  return api(`/careers/roles/${id}`, { method: 'DELETE' });
}

/** Saves the order of all roles. Returns the roles in that order. */
export async function reorderCareerRoles(ids) {
  const { roles } = await api('/careers/roles/order', { method: 'PUT', body: { ids } });
  return roles;
}

/** People who used "Join the list" on the website, newest first. */
export async function getCareerInterests() {
  const { interests } = await api('/careers/interests');
  return interests;
}

export function deleteCareerInterest(id) {
  return api(`/careers/interests/${id}`, { method: 'DELETE' });
}
