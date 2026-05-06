/* ── Blacksea Padel API Client ────────────────────────────────── */
const API = (() => {
  const BASE_URL = window.BSP_API_URL || 'http://localhost:8080/api';
  const TOKEN_KEY = 'bsp_token';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = t => localStorage.setItem(TOKEN_KEY, t);
  const removeToken = () => localStorage.removeItem(TOKEN_KEY);
  const isAuthenticated = () => !!getToken();

  async function request(method, path, body) {
    const headers = {
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    };
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      ...(body != null ? { body: JSON.stringify(body) } : {}),
    });

    if (res.status === 204) return null;
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.message || 'API Error'), { status: res.status, data });
    return data;
  }

  return {
    getToken, setToken, removeToken, isAuthenticated,

    auth: {
      loginWithTelegram: initData => request('POST', '/auth/telegram', { initData }),
    },

    users: {
      me:                ()               => request('GET',  '/users/me'),
      history:           ()               => request('GET',  '/users/me/history'),
      list:              ()               => request('GET',  '/users'),
      setRole:           (id, role)       => request('PUT',  `/users/${id}/role`, { role }),
      setStartingPoints: (id, level)      => request('PUT',  `/users/${id}/starting-points`, { level }),
    },

    tournaments: {
      list:             ()             => request('GET',    '/tournaments'),
      get:              id             => request('GET',    `/tournaments/${id}`),
      getLevels:        ()             => request('GET',    '/tournaments/levels'),
      create:           data           => request('POST',   '/tournaments', data),
      activate:         id             => request('POST',   `/tournaments/${id}/activate`),
      submitResults:    (id, payload)  => request('POST',   `/tournaments/${id}/results`, payload),
      finalize:         id             => request('POST',   `/tournaments/${id}/finalize`),
      delete:           id             => request('DELETE', `/tournaments/${id}`),
      getParticipants:  id             => request('GET',    `/tournaments/${id}/participants`),
      addParticipant:   (id, userId)   => request('POST',   `/tournaments/${id}/participants/${userId}`),
      removeParticipant:(id, userId)   => request('DELETE', `/tournaments/${id}/participants/${userId}`),
      join:             id             => request('POST',   `/tournaments/${id}/join`),
      leave:            id             => request('DELETE', `/tournaments/${id}/leave`),
    },

    ratings: {
      list:        () => request('GET',  '/ratings'),
      recalculate: () => request('POST', '/ratings/recalculate'),
    },
  };
})();
