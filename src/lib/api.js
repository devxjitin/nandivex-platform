/* Tiny fetch wrapper for the NandiVex API. Sends the session cookie and turns failures into Errors
   with a readable message. In dev, /api is proxied to the API container (see vite.config.js). */
const BASE = (import.meta.env.VITE_API_URL || '/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (res.status === 204) return null;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Something went wrong. Please try again.', res.status);
  return data;
}

/** Downloads a file (the profile picture) as a Blob. Returns null when there is none. */
export async function apiBlob(path, { cache } = {}) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { credentials: 'include', cache });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  if (res.status === 404) return null;
  if (!res.ok) throw new ApiError('Could not load the picture.', res.status);
  return res.blob();
}

/** Sends a file as the raw request body (the profile picture). */
export async function apiUpload(path, blob) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': blob.type }, body: blob });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and try again.', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || 'Could not upload the picture.', res.status);
  return data;
}
