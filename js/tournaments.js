/* ════════════════════════════════════════════════════════════════
   RENDER — RESULTS
════════════════════════════════════════════════════════════════ */

let activeResultFilter = 'all';
let activeResultsSubTab = 'upcoming';
let tournamentsData = null; // cached from API

function normalizeTournament(t) {
  if (!t.pairs) return t;
  return {
    id: t.id,
    name: t.name,
    date: t.date,
    year: String(t.date).slice(0, 4),
    level: t.level,
    levelLabel: t.levelLabel || t.level,
    levelRangeLabel: t.levelRangeLabel || t.levelLabel || t.level,
    type: t.type || 'PAIR',
    status: t.status,
    maxParticipants: t.maxParticipants,
    minRating: t.minRating,
    maxRating: t.maxRating,
    price: t.price ?? null,
    location: t.location || null,
    time: t.time || null,
    participantCount: t.participantCount || (t.participants || []).length,
    participants: t.participants || [],
    reserveParticipants: t.reserveParticipants || [],
    // PAIR tournament registration fields
    pairRegistrations: t.pairRegistrations || null,
    pairReserveRegistrations: t.pairReserveRegistrations || [],
    canRegisterSolo: t.canRegisterSolo ?? null,
    canJoinAsReserve: t.canJoinAsReserve ?? false,
    myPendingPairRequestId: t.myPendingPairRequestId || null,
    myPendingPairTargetParticipantId: t.myPendingPairTargetParticipantId || null,
    myPendingPairTargetName: t.myPendingPairTargetName || null,
    raketoId: t.raketoId || null,
    hasAnalysis: t.hasAnalysis || false,
    analysisGeneratedAt: t.analysisGeneratedAt || null,
    results: (t.pairs || [])
      .sort((a, b) => (a.position || 99) - (b.position || 99))
      .map(p => ({
        pos: p.position || 0,
        pair: p.player2?.displayName
          ? [p.player1?.displayName || '?', p.player2?.displayName]
          : [p.player1?.displayName || '?'],
        players: [
          { id: p.player1?.id || null, name: p.player1?.displayName || '?', photoUrl: p.player1?.photoUrl || null },
          ...(p.player2 ? [{ id: p.player2.id || null, name: p.player2.displayName || '?', photoUrl: p.player2.photoUrl || null }] : []),
        ],
        score: p.score || '',
        pts: p.pointsEarned || 0,
      })),
  };
}

async function renderResults() {
  const list = document.getElementById('results-list');
  list.innerHTML = '<div class="empty-state"><div class="empty-state-text">Завантаження...</div></div>';

  let source = TOURNAMENTS;
  if (apiAvailable && tournamentsData === null) {
    try {
      tournamentsData = (await API.tournaments.list()).map(normalizeTournament);
    } catch { /* fallback */ }
  }
  if (tournamentsData) source = tournamentsData;

  if (activeResultsSubTab === 'upcoming') {
    const upcoming = source.filter(t => t.status !== 'FINISHED');
    rebuildMonthChips(upcoming);
    renderUpcomingList(upcoming, list);
  } else {
    const finished = source.filter(t => t.status === 'FINISHED');
    rebuildMonthChips(finished);
    renderFinishedList(finished, list);
  }
}

function applyResultFilter(source) {
  if (activeResultFilter === 'all') return source;
  return source.filter(t => String(t.date).slice(0, 7) === activeResultFilter);
}

function renderUpcomingList(source, list) {
  const filtered = applyResultFilter(source);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-text">Немає запланованих турнірів</div></div>`;
    return;
  }

  const statusLabel = { DRAFT: 'Реєстрація', ACTIVE: 'Активний', FINISHED: 'Завершено', GROUP_STAGE: 'Груповий етап', PLAYOFF: 'Плей-офф' };
  const statusCls   = { DRAFT: 't-status-draft', ACTIVE: 't-status-active', FINISHED: 't-status-done', GROUP_STAGE: 't-status-live', PLAYOFF: 't-status-live' };

  list.innerHTML = filtered.map(t => {
    const confirmed     = t.participants || [];
    const reserve       = t.reserveParticipants || [];
    const pairRegs      = t.pairRegistrations || [];
    const pairResRegs   = t.pairReserveRegistrations || [];
    // CUP registers in DRAFT using the same partner-invite flow as PAIR tournaments.
    const isPairReg     = t.type === 'PAIR' || (t.type === 'CUP' && t.status === 'DRAFT');
    const myPairEntry   = (isPairReg && currentUser)
        ? pairRegs.find(pr => pr.player1?.id === currentUser.id || pr.player2?.id === currentUser.id)
        : null;
    const myReserveEntry = (isPairReg && currentUser)
        ? pairResRegs.find(pr => pr.player1?.id === currentUser.id || pr.player2?.id === currentUser.id)
        : null;
    const isRegisteredSolo   = !!(myPairEntry && !myPairEntry.player2);
    const isRegisteredPaired = !!(myPairEntry && myPairEntry.player2);
    const isReserveSolo      = !!(myReserveEntry && !myReserveEntry.player2);
    const isReservePaired    = !!(myReserveEntry && myReserveEntry.player2);
    const hasPendingRequest  = isPairReg && !!t.myPendingPairRequestId;
    const isEnrolled  = isPairReg
        ? !!(myPairEntry || myReserveEntry)
        : !!(currentUser && [...confirmed, ...reserve].some(p => p.id === currentUser.id));
    const isInReserve = isPairReg
        ? !!(myReserveEntry)
        : !!(currentUser && reserve.some(p => p.id === currentUser.id));
    const canJoin     = currentUser && (t.status === 'DRAFT' || t.status === 'ACTIVE');
    const isFull      = isPairReg
        ? (!t.canRegisterSolo && pairRegs.filter(pr => !pr.player2 && pr.player1?.id !== currentUser?.id).length === 0)
        : !!(t.maxParticipants && (t.participantCount || 0) >= t.maxParticipants);

    const ratingRange = [
      t.minRating ? `від ${t.minRating}` : '',
      t.maxRating ? `до ${t.maxRating}` : '',
    ].filter(Boolean).join('–');

    const pairResCount = pairResRegs.length;
    const reserveCount = reserve.length;
    const participantsInfo = isPairReg
      ? (t.maxParticipants
          ? `${pairRegs.length}/${Math.floor(t.maxParticipants / 2)} пар${pairResCount ? ` · +${pairResCount} резерв` : ''}`
          : (pairRegs.length ? `${pairRegs.length} пар${pairResCount ? ` · +${pairResCount} резерв` : ''}` : ''))
      : (t.maxParticipants
          ? `${t.participantCount || 0}/${t.maxParticipants} уч.${reserveCount ? ` · +${reserveCount} резерв` : ''}`
          : (t.participantCount ? `${t.participantCount} уч.${reserveCount ? ` · +${reserveCount} резерв` : ''}` : ''));
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : t.type === 'CUP' ? '🏆 Кубок' : 'Парний';
    const isLive = t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF';
    const liveBadge = isLive ? `<span class="live-badge">● LIVE</span>` : '';
    const canJoinCup = t.type === 'CUP' && (t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF' || t.status === 'FINISHED');

    const tStart = t.time
      ? new Date(`${t.date}T${t.time}`)
      : new Date(`${t.date}T00:00:00`);
    const hoursUntil = (tStart - Date.now()) / 36e5;
    const canLeave = isEnrolled && canJoin && hoursUntil > 24;

    let joinBtn = '';
    if (isPairReg && canJoin) {
      if (hasPendingRequest) {
        joinBtn = `<span class="chip-btn chip-reserve" style="pointer-events:none">⏳ ${t.myPendingPairTargetName || 'Заявка'}</span>`
                + `<button class="chip-btn chip-leave sr-pair-cancel-btn" data-id="${t.id}">Скасувати</button>`;
      } else if (isReservePaired) {
        const activeEntry = myReserveEntry;
        const partnerN = activeEntry.player1?.id === currentUser?.id
            ? playerNameOf(activeEntry.player2) : playerNameOf(activeEntry.player1);
        joinBtn = `<span class="chip-btn chip-reserve" title="Резерв · пара з ${partnerN}" style="pointer-events:none">⏳ Резерв · у парі</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else if (isReserveSolo) {
        joinBtn = `<span class="chip-btn chip-reserve" style="pointer-events:none">⏳ Резерв · шукає пару</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else if (isRegisteredPaired) {
        const partnerN = myPairEntry.player1?.id === currentUser?.id
            ? playerNameOf(myPairEntry.player2) : playerNameOf(myPairEntry.player1);
        joinBtn = `<span class="chip-btn chip-join" title="Пара з ${partnerN}" style="pointer-events:none">✓ У парі</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else if (isRegisteredSolo) {
        joinBtn = `<span class="chip-btn chip-reserve" style="pointer-events:none">🔍 Шукає пару</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else {
        const hasSolosToJoin = pairRegs.some(pr => !pr.player2 && pr.player1?.id !== currentUser?.id);
        if (t.canRegisterSolo || hasSolosToJoin) {
          joinBtn = `<button class="chip-btn chip-join sr-join-btn" data-id="${t.id}">Зареєструватись</button>`;
        } else if (t.canJoinAsReserve) {
          joinBtn = `<button class="chip-btn chip-reserve sr-join-reserve-btn" data-id="${t.id}">У резерв</button>`;
        }
      }
    } else if (!isPairReg) {
      const enrolledBadge = isEnrolled
        ? `<span class="chip-btn ${isInReserve ? 'chip-reserve' : 'chip-join'}" style="pointer-events:none">${isInReserve ? 'Резерв' : 'Зареєстровано'}</span>`
        : '';
      const leaveBtn = canLeave
        ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>`
        : '';
      joinBtn = canJoin
        ? (isEnrolled
            ? enrolledBadge + leaveBtn
            : `<button class="chip-btn chip-join sr-join-btn" data-id="${t.id}">${isFull ? 'У резерв' : 'Приєднатись'}</button>`)
        : '';
    }

    const priceLabel = t.price ? `${t.price} грн` : 'безкоштовно';

    const tpChip = (p, extra = '') => {
      const name = playerNameOf(p);
      const safeName = esc(name);
      return `<span class="tp-name${extra} tp-name-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${safeName}')">${esc(name)}</span>`;
    };

    const participantsList = isPairReg
      ? buildPairParticipantsList(t, pairRegs, pairResRegs, canJoin, hasPendingRequest, isEnrolled, myReserveEntry)
      : (confirmed.length > 0
          ? `<div class="tournament-participants-list">
              <div class="tp-label">Учасники</div>
              <div class="tp-names">${confirmed.map(p => tpChip(p)).join('')}</div>
            </div>`
          : '');

    const reserveList = (!isPairReg && reserve.length > 0)
      ? `<div class="tournament-participants-list reserve-section">
          <div class="tp-label">Резерв</div>
          <div class="tp-names">${reserve.map(p => tpChip(p, ' tp-reserve')).join('')}</div>
        </div>`
      : '';

    const cupViewBtn = (t.type === 'CUP' && (isLive || t.status === 'FINISHED'))
      ? `<button class="chip-btn chip-cup-view cup-view-btn" data-id="${t.id}">Переглянути Кубок</button>`
      : '';
    const adminCupBtn = (t.type === 'CUP' && t.status === 'DRAFT' && currentUser?.role === 'ADMIN')
      ? `<button class="t-admin-btn t-admin-cup-start-btn" data-id="${t.id}">▶ Запустити кубок</button>`
      : '';
    const adminCupFinalize = (t.type === 'CUP' && t.status === 'PLAYOFF' && currentUser?.role === 'ADMIN')
      ? `<button class="t-admin-btn t-admin-cup-finalize-btn" data-id="${t.id}">✓ Фіналізувати кубок</button>`
      : '';

    return `
      <div class="tournament-card${t.type === 'CUP' ? ' tournament-card-cup' : ''}" data-tournament-id="${t.id}">
        <div class="tournament-card-header">
          <div class="tournament-meta">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div class="tournament-name">${esc(t.name)}${liveBadge}</div>
              ${t.type !== 'CUP' ? joinBtn : ''}
            </div>
            <div class="tournament-date-cat">
              <span class="tournament-date">${fmt(t.date)}${t.time ? ' · ' + t.time.slice(0,5) : ''}</span>
              ${t.levelLabel ? `<span class="level-badge level-badge-lg ${levelClass(t.levelLabel)}">${t.levelRangeLabel || t.levelLabel}</span>` : ''}
              <span class="tournament-cat">${typeLabel}</span>
            </div>
            <div class="tournament-meta-info">
              <span class="${statusCls[t.status] || 't-status-done'}">${statusLabel[t.status] || t.status}</span>
              ${ratingRange ? `<span class="t-meta-tag">· ${ratingRange} pts</span>` : ''}
              ${participantsInfo ? `<span class="t-meta-tag">· ${participantsInfo}</span>` : ''}
            </div>
            ${t.location || t.price != null ? `
            <div class="t-location-row">
              ${t.location ? `<span class="t-location-tag">📍 ${t.location}</span>` : ''}
              <span class="t-location-tag">💳 ${priceLabel}</span>
            </div>` : ''}
            ${t.type === 'CUP' && t.status === 'DRAFT' ? (joinBtn || '') : ''}
            ${cupViewBtn}
            ${currentUser?.role === 'ADMIN' ? `
            <div class="t-admin-actions">
              <button class="t-admin-btn t-admin-edit-btn" data-id="${t.id}">Редагувати</button>
              ${adminCupBtn}
              ${adminCupFinalize}
              <button class="t-admin-btn t-admin-delete-btn" data-id="${t.id}">Видалити</button>
            </div>` : ''}
          </div>
        </div>
        ${participantsList}
        ${reserveList}
      </div>`;
  }).join('');

  list.querySelectorAll('.sr-join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      // Raketo-link is required for self-enrollment (admins bypass this)
      if (currentUser && !currentUser.raketoDocId && currentUser.role !== 'ADMIN') {
        showToast('Для реєстрації потрібно підключити профіль Raketo 🎾', 'error');
        switchTab('profile');
        return;
      }
      const tid = parseInt(btn.dataset.id, 10);
      const tournament = (tournamentsData || []).find(t => t.id === tid);
      if (tournament) showRegistrationConfirm(tournament);
    });
  });

  list.querySelectorAll('.sr-leave-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = parseInt(btn.dataset.id, 10);
      const t = (tournamentsData || []).find(x => x.id === tid);
      const name = t ? t.name : 'турнір';
      if (!confirm(`Відписатись від «${name}»?`)) return;
      btn.disabled = true;
      try {
        await API.tournaments.leave(tid);
        tournamentsData = null;
        showToast('Ви відписались від турніру', 'success');
        await renderResults();
      } catch (e) {
        showToast(e.message || 'Помилка відписки', 'error');
        btn.disabled = false;
      }
    });
  });

  list.querySelectorAll('.sr-pair-join-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentUser && !currentUser.raketoDocId && currentUser.role !== 'ADMIN') {
        showToast('Для реєстрації потрібно підключити профіль Raketo 🎾', 'error');
        switchTab('profile');
        return;
      }
      const tid = parseInt(btn.dataset.id, 10);
      const pid = parseInt(btn.dataset.pid, 10);
      const isReserve = btn.dataset.reserve === '1';
      const tournament = (tournamentsData || []).find(x => x.id === tid);
      if (!tournament) return;
      const pool = isReserve ? (tournament.pairReserveRegistrations || []) : (tournament.pairRegistrations || []);
      const soloEntry = pool.find(pr => pr.participant1Id === pid);
      if (soloEntry) showPairJoinConfirm(tournament, soloEntry, isReserve);
    });
  });

  list.querySelectorAll('.sr-join-reserve-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (currentUser && !currentUser.raketoDocId && currentUser.role !== 'ADMIN') {
        showToast('Для реєстрації потрібно підключити профіль Raketo 🎾', 'error');
        switchTab('profile');
        return;
      }
      const tid = parseInt(btn.dataset.id, 10);
      const tournament = (tournamentsData || []).find(x => x.id === tid);
      if (tournament) showRegistrationConfirm(tournament, false, true);
    });
  });

  list.querySelectorAll('.sr-pair-cancel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = parseInt(btn.dataset.id, 10);
      if (!confirm('Скасувати заявку?')) return;
      btn.disabled = true;
      try {
        await API.tournaments.cancelPairRequest(tid);
        tournamentsData = null;
        showToast('Заявку скасовано', 'info');
        await renderResults();
      } catch (e) {
        showToast(e.message || 'Помилка', 'error');
        btn.disabled = false;
      }
    });
  });

  wireAdminTournamentBtns(list);
}

function buildPairParticipantsList(t, pairRegs, pairResRegs, canJoin, hasPendingRequest, isEnrolled, myReserveEntry) {
  if (!pairRegs.length && !t.canRegisterSolo && !pairResRegs.length) return '';

  const canRequestConfirmed = canJoin && !isEnrolled && !hasPendingRequest;
  const canRequestReserve   = canJoin && !isEnrolled && !hasPendingRequest && !!myReserveEntry === false;

  const renderRow = (pr, isReserve) => {
    if (!pr.player2) {
      const name = playerNameOf(pr.player1);
      const safe = esc(name);
      const isMe = currentUser && pr.player1?.id === currentUser.id;
      const canReq = isReserve ? (canJoin && !isEnrolled && !hasPendingRequest) : canRequestConfirmed;
      const joinBtn = (!isMe && canReq)
        ? `<button class="chip-btn chip-join sr-pair-join-btn" data-id="${t.id}" data-pid="${pr.participant1Id}" data-name="${safe}"${isReserve ? ' data-reserve="1"' : ''}>Грати</button>`
        : '';
      const soloTag = isMe ? '' : `<span class="tp-solo-tag">${isReserve ? 'резерв · шукає пару' : 'шукає пару'}</span>`;
      return `<div class="tp-pair-row${isReserve ? ' tp-reserve-row' : ''}"><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player1?.id || ''}','${safe}')">${esc(name)}</span>${soloTag}${joinBtn}</div>`;
    }
    const n1 = playerNameOf(pr.player1), n2 = playerNameOf(pr.player2);
    const s1 = n1.replace(/'/g, '&#39;'), s2 = n2.replace(/'/g, '&#39;');
    const reserveTag = isReserve ? '<span class="tp-solo-tag">резерв</span>' : '';
    return `<div class="tp-pair-row${isReserve ? ' tp-reserve-row' : ''}"><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player1?.id || ''}','${s1}')">${n1}</span><span class="tp-pair-sep">/</span><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player2?.id || ''}','${s2}')">${n2}</span>${reserveTag}</div>`;
  };

  const confirmedRows = pairRegs.map(pr => renderRow(pr, false));
  const reserveRows   = pairResRegs.map(pr => renderRow(pr, true));

  const totalSlots = t.maxParticipants ? Math.floor(t.maxParticipants / 2) : 0;
  const label = totalSlots ? `Пари (${pairRegs.length}/${totalSlots})` : `Пари (${pairRegs.length})`;

  let html = `<div class="tournament-participants-list"><div class="tp-label">${label}</div><div class="tp-pairs">${confirmedRows.join('')}</div></div>`;
  if (reserveRows.length) {
    html += `<div class="tournament-participants-list reserve-section"><div class="tp-label">Резерв (${pairResRegs.length})</div><div class="tp-pairs">${reserveRows.join('')}</div></div>`;
  }
  return html;
}

function fpAvatarHtml(player) {
  if (player.photoUrl) {
    const safe = player.photoUrl.replace(/"/g, '&quot;');
    return `<img src="${safe}" alt="" onerror="this.style.display='none'">`;
  }
  return initials(player.name);
}

function renderFinishedList(source, list) {
  const filtered = applyResultFilter(source);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-text">Немає завершених турнірів</div></div>`;
    return;
  }

  list.innerHTML = filtered.map(t => {
    const results = (t.results || []).slice().sort((a, b) => a.pos - b.pos);
    const top3    = results.filter(r => r.pos >= 1 && r.pos <= 3);
    const rest    = results.filter(r => r.pos > 3);
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : t.type === 'CUP' ? '🏆 Кубок' : 'Парний';

    const podiumConfig = [
      { pos: 2, cls: 'fp-2', blockCls: 'fp-b2', rankCls: 'fp-r2', crown: '' },
      { pos: 1, cls: 'fp-1', blockCls: 'fp-b1', rankCls: 'fp-r1', crown: '<span class="fp-crown">👑</span>' },
      { pos: 3, cls: 'fp-3', blockCls: 'fp-b3', rankCls: 'fp-r3', crown: '' },
    ];

    const podiumHtml = top3.length > 0
      ? `<div class="finished-podium">
          ${podiumConfig.map(({ pos, cls, blockCls, rankCls, crown }) => {
            const r = top3.find(r => r.pos === pos);
            if (!r) return '';
            const players = r.players || r.pair.map(n => ({ id: null, name: n, photoUrl: null }));
            const avatarSection = players.length > 1
              ? `<div class="fp-avatar-duo">${players.map(p => `<div class="fp-avatar lb-row-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${esc(p.name)}')">${fpAvatarHtml(p)}</div>`).join('')}</div>`
              : `<div class="fp-avatar-wrap lb-row-tap" onclick="_tournamentPlayerTap('${players[0].id || ''}','${esc(players[0].name)}')"> ${crown}<div class="fp-avatar">${fpAvatarHtml(players[0])}</div></div>`;
            const names = players.map(p => `<span class="lb-row-tap" style="cursor:pointer" onclick="_tournamentPlayerTap('${p.id || ''}','${esc(p.name)}')">${esc(p.name)}</span>`).join('<span class="fp-name-sep"> / </span>');
            return `<div class="fp-place ${cls}">
              ${avatarSection}
              <div class="fp-names">${names}</div>
              ${r.score ? `<div class="fp-score">${r.score}</div>` : ''}
              ${r.pts !== 0 ? `<div class="fp-pts ${r.pts > 0 ? '' : 'neg'}">${r.pts > 0 ? '+' : ''}${r.pts}</div>` : ''}
              <div class="fp-block ${blockCls}"><span class="fp-rank ${rankCls}">${pos}</span></div>
            </div>`;
          }).join('')}
        </div>`
      : '';

    const hasScore = results.some(r => r.score);
    const restHtml = rest.length > 0
      ? `<div class="results-table">
          ${hasScore ? `<div class="results-col-labels">
            <span class="results-col-label-score">Рах.</span>
            <span class="results-col-label-pts">BSP</span>
          </div>` : ''}
          ${rest.map(r => {
            const rPlayers = r.players || r.pair.map(n => ({ id: null, name: n }));
            const nameSpans = rPlayers.map(p => `<span class="lb-row-tap" style="cursor:pointer" onclick="_tournamentPlayerTap('${p.id || ''}','${esc(p.name)}')">${esc(p.name)}</span>`).join('<span class="separator"> / </span>');
            return `
            <div class="results-row">
              <span class="results-pos pos-${r.pos}">${r.pos}</span>
              <div class="results-pair"><div class="results-pair-names">${nameSpans}</div></div>
              ${r.score ? `<span class="results-score">${r.score}</span>` : (hasScore ? `<span class="results-score-empty"></span>` : '')}
              <span class="results-pts ${r.pts > 0 ? 'pos' : r.pts < 0 ? 'neg' : 'zero'}">${r.pts > 0 ? '+' : ''}${r.pts}</span>
            </div>`;
          }).join('')}
        </div>`
      : '';

    const analysisBtn = t.hasAnalysis
      ? `<button class="analysis-btn" onclick="openAnalysisModal(${t.id})">
           <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
           Аналіз турніру
         </button>`
      : '';

    const cupViewBtn = t.type === 'CUP'
      ? `<button class="chip-btn chip-cup-view cup-view-btn" data-id="${t.id}">Переглянути Кубок</button>`
      : '';

    return `<div class="finished-card">
      <div class="finished-card-header">
        <div class="finished-card-name">${esc(t.name)}</div>
        <div class="finished-card-meta">
          <span class="tournament-date">${fmt(t.date)}</span>
          ${t.levelLabel ? `<span class="level-badge level-badge-lg ${levelClass(t.levelLabel)}">${t.levelRangeLabel || t.levelLabel}</span>` : ''}
          <span class="tournament-cat">${typeLabel}</span>
        </div>
        ${cupViewBtn}
        ${currentUser?.role === 'ADMIN' ? `
        <div class="t-admin-actions">
          <button class="t-admin-btn t-admin-edit-btn" data-id="${t.id}">Редагувати</button>
          <button class="t-admin-btn t-admin-delete-btn" data-id="${t.id}">Видалити</button>
        </div>` : ''}
      </div>
      ${podiumHtml}
      ${restHtml}
      ${analysisBtn}
    </div>`;
  }).join('');

  wireAdminTournamentBtns(list);
}

function wireAdminTournamentBtns(container) {
  container.querySelectorAll('.t-admin-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = (tournamentsData || []).find(x => String(x.id) === String(btn.dataset.id));
      if (t) await openEditTournament(t);
    });
  });
  container.querySelectorAll('.t-admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Видалити цей турнір? Цю дію не можна скасувати.')) return;
      btn.disabled = true;
      try {
        await API.tournaments.delete(btn.dataset.id);
        tournamentsData = null;
        renderResults();
      } catch (e) {
        alert('Помилка: ' + (e.message || 'unknown'));
        btn.disabled = false;
      }
    });
  });
  container.querySelectorAll('.t-admin-cup-start-btn').forEach(btn => {
    btn.addEventListener('click', () => openCupStartModal(btn.dataset.id));
  });
  container.querySelectorAll('.t-admin-cup-finalize-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Фіналізувати кубок та нарахувати рейтинг?')) return;
      btn.disabled = true;
      try {
        await API.cup.finalize(btn.dataset.id);
        tournamentsData = null;
        renderResults();
        showToast('Кубок завершено! Рейтинг нараховано 🏆');
      } catch (e) {
        alert('Помилка: ' + (e.data?.message || e.message || 'unknown'));
        btn.disabled = false;
      }
    });
  });
  container.querySelectorAll('.cup-view-btn').forEach(btn => {
    btn.addEventListener('click', () => openCupModal(btn.dataset.id));
  });
}

const UA_MONTHS = ['Січ','Лют','Бер','Квіт','Трав','Черв','Лип','Серп','Вер','Жовт','Лист','Груд'];

function rebuildMonthChips(tournaments) {
  const row = document.getElementById('results-filter');
  // remove existing month chips (data-month attribute marks them)
  row.querySelectorAll('[data-month]').forEach(el => el.remove());

  const months = [...new Set(
    tournaments.map(t => String(t.date).slice(0, 7)).filter(Boolean)
  )].sort((a, b) => b.localeCompare(a)); // most recent first

  months.forEach(ym => {
    const [y, m] = ym.split('-');
    const label = UA_MONTHS[parseInt(m, 10) - 1] + ' ' + y;
    const btn = document.createElement('button');
    btn.className = 'filter-chip';
    btn.dataset.filter = ym;
    btn.dataset.month = '1';
    btn.textContent = label;
    if (activeResultFilter === ym) btn.classList.add('active');
    row.appendChild(btn);
  });
}

document.getElementById('results-subtabs').addEventListener('click', e => {
  const btn = e.target.closest('.results-subtab');
  if (!btn) return;
  document.querySelectorAll('#results-subtabs .results-subtab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  activeResultsSubTab = btn.dataset.subtab;
  activeResultFilter = 'all';
  document.querySelectorAll('#results-filter .filter-chip').forEach(c => c.classList.remove('active'));
  document.querySelector('#results-filter .filter-chip[data-filter="all"]').classList.add('active');
  renderResults();
});

document.getElementById('results-filter').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('#results-filter .filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeResultFilter = chip.dataset.filter;
  renderResults();
});

