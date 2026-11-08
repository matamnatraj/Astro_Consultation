import { API_URL } from './config.js';
import { secureStorage } from './storage.js';

export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error?.message || (status === 0 ? 'Cannot reach the server. Check your connection.' : `Request failed (${status})`));
    this.status = status;
    this.code = body?.error?.code;
    this.details = body?.error?.details;
  }
}

/** API client with secure token storage and automatic access-token refresh. */
export function createApi(storageKey) {
  let session = null; // { accessToken, refreshToken }
  let loaded = false;
  let refreshing = null;
  const listeners = new Set();

  async function load() {
    if (!loaded) {
      try { session = JSON.parse((await secureStorage.get(storageKey)) || 'null'); } catch { session = null; }
      loaded = true;
    }
    return session;
  }
  async function save(s) {
    session = s;
    loaded = true;
    if (s) await secureStorage.set(storageKey, JSON.stringify(s)); else await secureStorage.remove(storageKey);
  }

  async function doFetch(url, init) {
    try { return await fetch(url, init); } catch { throw new ApiError(0, null); }
  }

  async function refresh() {
    const s = await load();
    if (!s?.refreshToken) throw new ApiError(401, { error: { message: 'Session expired' } });
    if (!refreshing) {
      refreshing = (async () => {
        const r = await doFetch(`${API_URL}/v1/auth/refresh`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ refreshToken: s.refreshToken }) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) { await save(null); listeners.forEach((l) => l(null)); throw new ApiError(r.status, body); }
        await save({ ...s, ...body });
        return body;
      })().finally(() => { refreshing = null; });
    }
    return refreshing;
  }

  async function request(method, path, body, { retry = true } = {}) {
    const s = await load();
    const res = await doFetch(`${API_URL}/v1${path}`, {
      method,
      headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(s?.accessToken ? { authorization: `Bearer ${s.accessToken}` } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (res.status === 401 && retry && s?.refreshToken) {
      await refresh();
      return request(method, path, body, { retry: false });
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new ApiError(res.status, data);
    return data;
  }

  return {
    get: (p) => request('GET', p),
    post: (p, b, o) => request('POST', p, b || {}, o),
    put: (p, b) => request('PUT', p, b),
    del: (p) => request('DELETE', p),
    hasSession: async () => Boolean(await load()),
    async accessToken() {
      const s = await load();
      if (!s) return null;
      try {
        const payload = JSON.parse(globalThis.atob(s.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
        if (payload.exp * 1000 - Date.now() < 30_000) return (await refresh()).accessToken;
      } catch { /* use as-is */ }
      return s.accessToken;
    },
    async setSession(s) { await save(s); listeners.forEach((l) => l(s)); },
    async logout() {
      const s = await load();
      if (s?.refreshToken) await request('POST', '/auth/logout', { refreshToken: s.refreshToken }, { retry: false }).catch(() => {});
      await save(null);
      listeners.forEach((l) => l(null));
    },
    onSessionChange(l) { listeners.add(l); return () => listeners.delete(l); },
  };
}
