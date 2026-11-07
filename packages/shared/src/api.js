// API client with access-token refresh. Tokens are kept per app (storageKey).
export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || `Request failed (${status})`);
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

export const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:4000';

function store(key) {
  const read = () => { try { return JSON.parse(localStorage.getItem(key)) || null; } catch { return null; } };
  return {
    get: read,
    set: (v) => { try { v ? localStorage.setItem(key, JSON.stringify(v)) : localStorage.removeItem(key); } catch { /* storage unavailable */ } },
  };
}

export function createApi(storageKey) {
  const tokens = store(storageKey);
  const listeners = new Set();
  let refreshing = null;

  async function refresh() {
    const t = tokens.get();
    if (!t?.refreshToken) throw new ApiError(401, { error: { message: 'Session expired' } });
    if (!refreshing) {
      refreshing = fetch(`${API_URL}/v1/auth/refresh`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: t.refreshToken }),
      }).then(async (r) => {
        const body = await r.json().catch(() => ({}));
        if (!r.ok) { tokens.set(null); listeners.forEach((l) => l(null)); throw new ApiError(r.status, body); }
        tokens.set({ ...t, ...body });
        return body;
      }).finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(method, path, body, { retry = true, raw = false } = {}) {
    const t = tokens.get();
    const res = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(t?.accessToken ? { authorization: `Bearer ${t.accessToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry && t?.refreshToken) {
      await refresh();
      return request(method, path, body, { retry: false, raw });
    }
    if (raw && res.ok) return res;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  return {
    get: (p, o) => request('GET', p, null, o),
    post: (p, b, o) => request('POST', p, b || {}, o),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
    tokens,
    async accessToken() {
      const t = tokens.get();
      if (!t) return null;
      try {
        const [, payload] = t.accessToken.split('.');
        const { exp } = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        if (exp * 1000 - Date.now() < 30_000) return (await refresh()).accessToken;
      } catch { /* fall through */ }
      return t.accessToken;
    },
    setSession(s) { tokens.set(s); listeners.forEach((l) => l(s)); },
    async logout() {
      const t = tokens.get();
      if (t?.refreshToken) await request('POST', '/auth/logout', { refreshToken: t.refreshToken }, { retry: false }).catch(() => {});
      tokens.set(null);
      listeners.forEach((l) => l(null));
    },
    onSessionChange(l) { listeners.add(l); return () => listeners.delete(l); },
    async download(path, filename) {
      const res = await request('GET', path, null, { raw: true });
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    },
  };
}
