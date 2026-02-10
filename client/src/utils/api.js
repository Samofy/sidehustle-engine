// Always use relative path - works on any domain (Railway, Vercel, localhost)
const BASE = '/api';

export { BASE as apiBase };

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

/**
 * Fetch that returns the raw Response (for SSE streaming, binary audio, etc.)
 */
export async function apiRawFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  return fetch(`${BASE}${path}`, { ...options, headers });
}

export function apiGet(path) {
  return apiFetch(path);
}

export function apiPost(path, body) {
  return apiFetch(path, { method: 'POST', body: JSON.stringify(body) });
}

export function apiPatch(path, body) {
  return apiFetch(path, { method: 'PATCH', body: JSON.stringify(body) });
}

export function apiDelete(path, body) {
  return apiFetch(path, { method: 'DELETE', body: body ? JSON.stringify(body) : undefined });
}
