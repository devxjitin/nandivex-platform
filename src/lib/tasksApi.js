import { api, apiBlob, apiUpload } from './api.js';

export async function fetchLinkPreview(url) {
  const { preview } = await api('/tasks/link-preview', { method: 'POST', body: { url } });
  return preview;
}

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
function itemQuery(role, submissionId) {
  const query = new URLSearchParams({ role });
  if (submissionId) query.set('submissionId', submissionId);
  return query;
}

export async function saveItem(id, role, values, { itemId, submissionId } = {}) {
  const query = itemQuery(role, submissionId);
  const suffix = itemId ? `/${itemId}` : '';
  if (values.kind === 'file') {
    query.set('name', values.file.name);
    const blob = new Blob([values.file], { type: values.type });
    const { item } = await apiUpload(`/tasks/${id}/files${suffix}?${query}`, blob);
    return item;
  }
  const { item } = await api(`/tasks/${id}/items${suffix}?${query}`, { method: itemId ? 'PATCH' : 'POST', body: values });
  return item;
}

export const addTextItem = (id, role, text) => saveItem(id, role, { kind: 'text', text });
export const addLinkItem = (id, role, url) => saveItem(id, role, { kind: 'link', url });
export const addFileItem = (id, role, file, type) => saveItem(id, role, { kind: 'file', file, type });

export function removeItem(id, role, itemId, submissionId) {
  return api(`/tasks/${id}/items/${itemId}?${itemQuery(role, submissionId)}`, { method: 'DELETE' });
}

export async function updateProofNote(id, submissionId, note) {
  const saved = await api(`/tasks/${id}/proof-note?${itemQuery('proof', submissionId)}`, { method: 'PATCH', body: { note } });
  return saved.note;
}

/** Hands the draft proof in for review. Returns the full task. */
export async function submitProof(id, note) {
  const { task } = await api(`/tasks/${id}/submit`, { method: 'POST', body: { note } });
  return task;
}

/** decision: 'approve' or 'reject' (a note is required to reject). Returns the full task. */
export async function reviewTask(id, decision, note, reviewVersion) {
  const { task } = await api(`/tasks/${id}/review`, { method: 'POST', body: { decision, note, reviewVersion } });
  return task;
}

/** The bytes of an uploaded file as a Blob. */
export function fetchItemFile(id, itemId) {
  return apiBlob(`/tasks/${id}/items/${itemId}/file`, { cache: 'no-store' });
}
