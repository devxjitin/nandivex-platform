import { api, apiBlob, apiUpload } from './api.js';

/** Tasks the signed-in person may see: all of them for a Founder, Co-Founder or Admin, otherwise their own. */
export async function listTasks() {
  const { tasks } = await api('/tasks');
  return tasks;
}

/** One task with its explanation (brief), the current draft proof and every time proof was handed in. */
export async function getTask(id) {
  const { task } = await api(`/tasks/${id}`);
  return task;
}

/** { title, description, assigneeId, dueDate: 'YYYY-MM-DD' | null } */
export async function createTask(values) {
  const { task } = await api('/tasks', { method: 'POST', body: values });
  return task;
}

/** { title, description, dueDate }. Returns the full task. */
export async function updateTask(id, values) {
  const { task } = await api(`/tasks/${id}`, { method: 'PATCH', body: values });
  return task;
}

export function deleteTask(id) {
  return api(`/tasks/${id}`, { method: 'DELETE' });
}

/** role: 'brief' (the explanation, managers) or 'proof' (the assignee's work). */
export async function addTextItem(id, role, text) {
  const { item } = await api(`/tasks/${id}/items?role=${role}`, { method: 'POST', body: { kind: 'text', text } });
  return item;
}

export async function addLinkItem(id, role, url) {
  const { item } = await api(`/tasks/${id}/items?role=${role}`, { method: 'POST', body: { kind: 'link', url } });
  return item;
}

export async function addFileItem(id, role, file, type) {
  const blob = new Blob([file], { type });
  const { item } = await apiUpload(`/tasks/${id}/files?role=${role}&name=${encodeURIComponent(file.name)}`, blob);
  return item;
}

export function removeItem(id, role, itemId) {
  return api(`/tasks/${id}/items/${itemId}?role=${role}`, { method: 'DELETE' });
}

/** Hands the draft proof in for review. Returns the full task. */
export async function submitProof(id, note) {
  const { task } = await api(`/tasks/${id}/submit`, { method: 'POST', body: { note } });
  return task;
}

/** decision: 'approve' or 'reject' (a note is required to reject). Returns the full task. */
export async function reviewTask(id, decision, note) {
  const { task } = await api(`/tasks/${id}/review`, { method: 'POST', body: { decision, note } });
  return task;
}

/** The bytes of an uploaded file as a Blob. */
export function fetchItemFile(id, itemId) {
  return apiBlob(`/tasks/${id}/items/${itemId}/file`);
}
