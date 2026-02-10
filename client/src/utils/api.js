const BASE = import.meta.env.VITE_API_URL || '/api';

export { BASE as apiBase };

// Derive the WebSocket base URL from the API URL
// e.g. "https://foo.railway.app/api" → "wss://foo.railway.app"
export function getWsBase() {
  try {
    const url = new URL(BASE);
    const protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${url.host}`;
  } catch {
    // Relative URL (dev mode) — use current page host
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//${window.location.host}`;
  }
}

async function parseJSON(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(
      res.ok
        ? 'Received an unexpected response from the server.'
        : `Server error (${res.status}). Please try again.`
    );
  }
}

export async function apiFetch(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  const data = await parseJSON(res);

  if (!res.ok) {
    throw new Error(data.error || `Request failed: ${res.status}`);
  }

  return data;
}

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
