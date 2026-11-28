import { api } from './api.js';

/** Messages sent through the contact form on the website, newest first. */
export async function getContactMessages() {
  const { messages } = await api('/contact-messages');
  return messages;
}

/** status: 'new' or 'done'. Returns the saved message. */
export async function setContactStatus(id, status) {
  const { message } = await api(`/contact-messages/${id}`, { method: 'PATCH', body: { status } });
  return message;
}

export function deleteContactMessage(id) {
  return api(`/contact-messages/${id}`, { method: 'DELETE' });
}
