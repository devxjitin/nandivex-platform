import { api } from './api.js';

/** The latest notifications and how many are unread: { notifications, unread }. */
export function listNotifications() {
  return api('/notifications');
}

export function markRead(id) {
  return api(`/notifications/${id}/read`, { method: 'POST' });
}

export function markAllRead() {
  return api('/notifications/read-all', { method: 'POST' });
}
