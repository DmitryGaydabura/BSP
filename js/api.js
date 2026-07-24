/* ── Blacksea Padel API Client ────────────────────────────────── */
const API = (() => {
  const BASE_URL = window.BSP_API_URL || 'http://localhost:8080/api';
  const TOKEN_KEY = 'bsp_token';

  const getToken = () => localStorage.getItem(TOKEN_KEY);
  const setToken = t => localStorage.setItem(TOKEN_KEY, t);
  const removeToken = () => localStorage.removeItem(TOKEN_KEY);
  const isAuthenticated = () => !!getToken();

  // Active club id (from core.js global). Defaults to BLACKSEA before core.js loads
  // or in any edge case where it is unset. Used to scope club-specific endpoints.
  const club = () => (typeof currentClub !== 'undefined' && currentClub) ? currentClub : 'BLACKSEA';

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
      cache: 'no-store',
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
      me:                  ()               => request('GET',  '/users/me'),
      history:             ()               => request('GET',  '/users/me/history'),
      userHistory:         (id)             => request('GET',  `/users/${id}/history`),
      claimInitialPoints:  (data)           => request('POST', '/users/me/claim-initial-points', data),
      list:                ()               => request('GET',  '/users'),
      setRole:             (id, role)       => request('PUT',  `/users/${id}/role`, { role }),
      setStartingPoints:   (id, level)      => request('PUT',  `/users/${id}/starting-points`, { level }),
      setRatingPoints:     (id, points)     => request('PUT',  `/users/${id}/rating-points`, { points }),
      delete:              (id)             => request('DELETE', `/users/${id}`),
      setContact:            (id, contact)   => request('PUT',  `/users/${id}/contact`, { contact }),
      setRaketoDocId:        (id, docId, raketoName) => request('PUT',  `/users/${id}/raketo-doc-id`, { raketoDocId: docId, ...(raketoName ? { raketoName } : {}) }),
      adminImportFromRaketo: (data)         => request('POST', '/users/import-from-raketo', data),
      mergeUsers:            (keepId, deleteId) => request('POST', `/users/${keepId}/merge/${deleteId}`),
      directory:             ()                 => request('GET',  '/users/directory'),
      support:               (message)          => request('POST', '/users/me/support', { message }),
      h2h:                   (targetId)         => request('GET',  `/users/${targetId}/h2h`),
      h2hAnalysis:           (targetId)         => request('POST', `/users/${targetId}/h2h/analysis`),
    },

    tournaments: {
      list:             ()             => request('GET',    `/tournaments?club=${club()}`),
      get:              id             => request('GET',    `/tournaments/${id}`),
      getLevels:        ()             => request('GET',    '/tournaments/levels'),
      create:           data           => request('POST',   '/tournaments', { ...data, club: club() }),
      activate:         id             => request('POST',   `/tournaments/${id}/activate`),
      submitResults:    (id, payload)  => request('POST',   `/tournaments/${id}/results`, payload),
      finalize:         id             => request('POST',   `/tournaments/${id}/finalize`),
      update:           (id, data)     => request('PUT',    `/tournaments/${id}`, data),
      delete:           id             => request('DELETE', `/tournaments/${id}`),
      getParticipants:  id             => request('GET',    `/tournaments/${id}/participants`),
      addParticipant:   (id, userId, announce = true) => request('POST',   `/tournaments/${id}/participants/${userId}?announce=${announce}`),
      removeParticipant:(id, userId, announce = true) => request('DELETE', `/tournaments/${id}/participants/${userId}?announce=${announce}`),
      join:             id             => request('POST',   `/tournaments/${id}/join`),
      leave:            id             => request('DELETE', `/tournaments/${id}/leave`),
      sendPairRequest:  (id, targetParticipantId) => request('POST', `/tournaments/${id}/pair-request/${targetParticipantId}`),
      cancelPairRequest: id            => request('DELETE', `/tournaments/${id}/pair-request`),
      getMyPairRequest:  id            => request('GET',    `/tournaments/${id}/pair-request/mine`),
      adminPair:        (id, u1, u2)  => request('POST',   `/tournaments/${id}/admin-pair`, { userId1: u1, userId2: u2 }),
      adminUnpair:      (id, uid)     => request('DELETE', `/tournaments/${id}/admin-pair/${uid}`),
      setRaketoId:      (id, raketoId) => request('PATCH',  `/tournaments/${id}/raketo`, { raketoId }),
      importFromRaketo: (id)           => request('POST',   `/tournaments/${id}/import-from-raketo`),
      generateAnalysis: id             => request('POST',   `/tournaments/${id}/analysis`),
      getAnalysis:      id             => request('GET',    `/tournaments/${id}/analysis`),
      generatePlayerAnalysis: id       => request('POST',   `/tournaments/${id}/player-analysis`),
      getPlayerAnalysis:      id       => request('GET',    `/tournaments/${id}/player-analysis`),
    },

    americano: {
      get:               id             => request('GET',    `/tournaments/${id}/americano`),
      create:            data           => request('POST',   '/tournaments/americano', { ...data, club: club() }),
      update:            (id, data)     => request('PUT',    `/tournaments/americano/${id}`, data),
      start:             id             => request('POST',   `/tournaments/${id}/americano/start`),
      submitMatch:       (id, matchId, s) => request('PUT',  `/tournaments/${id}/americano/matches/${matchId}/result`, s),
      finalize:          id             => request('POST',   `/tournaments/${id}/americano/finalize`),
      delete:            id             => request('DELETE', `/tournaments/${id}/americano`),
      addParticipant:    (id, userId)   => request('POST',   `/tournaments/${id}/americano/participants/${userId}`),
      removeParticipant: (id, userId)   => request('DELETE', `/tournaments/${id}/americano/participants/${userId}`),
    },

    winnersCourt: {
      get:               id             => request('GET',    `/tournaments/${id}/winners-court`),
      create:            data           => request('POST',   '/tournaments/winners-court', { ...data, club: club() }),
      update:            (id, data)     => request('PUT',    `/tournaments/winners-court/${id}`, data),
      start:             id             => request('POST',   `/tournaments/${id}/winners-court/start`),
      submitMatch:       (id, matchId, s) => request('PUT',  `/tournaments/${id}/winners-court/matches/${matchId}/result`, s),
      advanceRound:      id             => request('POST',   `/tournaments/${id}/winners-court/advance-round`),
      finalize:          id             => request('POST',   `/tournaments/${id}/winners-court/finalize`),
      delete:            id             => request('DELETE', `/tournaments/${id}/winners-court`),
      addParticipant:    (id, userId)   => request('POST',   `/tournaments/${id}/winners-court/participants/${userId}`),
      removeParticipant: (id, userId)   => request('DELETE', `/tournaments/${id}/winners-court/participants/${userId}`),
    },

    cup: {
      get:              id              => request('GET',  `/tournaments/${id}/cup`),
      start:            (id, payload)   => request('POST', `/tournaments/${id}/cup/start`, payload),
      submitGroupMatch: (id, matchId, s) => request('PUT', `/tournaments/${id}/cup/group-matches/${matchId}/result`, s),
      confirmGroups:    (id, payload)   => request('POST', `/tournaments/${id}/cup/confirm-groups`, payload || null),
      submitPlayoff:    (id, matchId, s) => request('PUT', `/tournaments/${id}/cup/playoff-matches/${matchId}/result`, s),
      reseedPlayoff:    (id, payload)   => request('POST', `/tournaments/${id}/cup/playoff/reseed`, payload),
      finalize:         id              => request('POST', `/tournaments/${id}/cup/finalize`),
    },

    matches: {
      list:          ()             => request('GET',    '/matches'),
      get:           id             => request('GET',    `/matches/${id}`),
      create:        data           => request('POST',   '/matches', data),
      cancel:        id             => request('DELETE', `/matches/${id}`),
      join:          id             => request('POST',   `/matches/${id}/join`),
      leave:         id             => request('DELETE', `/matches/${id}/leave`),
      addPlayer:     (id, userId)   => request('POST',   `/matches/${id}/players/${userId}`),
      promote:       (id, userId)   => request('POST',   `/matches/${id}/players/${userId}/promote`),
      waitlist:      (id, userId)   => request('POST',   `/matches/${id}/players/${userId}/waitlist`),
      removePlayer:  (id, userId)   => request('DELETE', `/matches/${id}/players/${userId}`),
      submitSets:    (id, payload)  => request('PUT',    `/matches/${id}/sets`, payload),
      approve:       id             => request('POST',   `/matches/${id}/approve`),
    },

    locations: {
      list:       ()         => request('GET',    '/locations'),
      adminList:  ()         => request('GET',    '/admin/locations'),
      create:     data       => request('POST',   '/admin/locations', data),
      update:     (id, data) => request('PUT',    `/admin/locations/${id}`, data),
      remove:     id         => request('DELETE', `/admin/locations/${id}`),
    },

    ratings: {
      list:        () => request('GET',  '/ratings'),
      guests:      () => request('GET',  '/ratings/guests'),
      recalculate: () => request('POST', '/ratings/recalculate'),
      migrateV2:   () => request('POST', '/ratings/migrate-v2'),
    },

    activity: {
      monthly: (month) => request('GET', `/activity?month=${month}&club=${club()}`),
    },

    achievements: {
      getConfig: ()             => request('GET', '/achievements/config'),
      setEnabled: (id, enabled) => request('PUT', `/achievements/config/${id}`, { enabled }),
    },

    announcements: {
      unseen:    ()             => request('GET',    '/announcements/unseen'),
      active:    ()             => request('GET',    '/announcements/active'),
      markSeen:  (ids)          => request('POST',   '/announcements/seen', { ids }),
      adminList: ()             => request('GET',    '/announcements/admin'),
      create:    (data)         => request('POST',   '/announcements', data),
      update:    (id, data)     => request('PUT',    `/announcements/${id}`, data),
      setActive: (id, active)   => request('PATCH',  `/announcements/${id}/active`, { active }),
      reorder:   (orderedIds)   => request('PUT',    '/announcements/reorder', { orderedIds }),
      delete:    (id)           => request('DELETE', `/announcements/${id}`),
    },
  };
})();
