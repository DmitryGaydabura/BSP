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
    levelMax: t.levelMax || null,
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
    description: t.description || null,
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
    winnerPreChance: t.winnerPreChance ?? null,
    winnerPreSeed: t.winnerPreSeed ?? null,
    finalizedAvgRating: t.finalizedAvgRating ?? null,
    // Americano / friendly tournament fields
    friendly: t.friendly || false,
    isPrivate: t.isPrivate || false,
    pointsPerMatch: t.pointsPerMatch || null,
    roundsCount: t.roundsCount || null,
    resultEntryMode: t.resultEntryMode || null,
    createdById: t.createdById || null,
    createdByName: t.createdByName || null,
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

function renderTournamentsSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 }, (_, i) => `
    <div class="t-skel-card">
      <div class="skel t-skel-title" style="width:${65 + i * 5}%"></div>
      <div class="skel t-skel-meta" style="width:${40 + i * 4}%"></div>
      <div class="skel t-skel-tags"></div>
    </div>`).join('');
}

async function renderResults() {
  const list = document.getElementById('results-list');

  // Bootstrap hasn't resolved yet — show skeleton and wait
  if (apiLoading && !tournamentsData) {
    renderTournamentsSkeleton(list);
    return;
  }

  let source = [];
  if (apiAvailable && tournamentsData === null) {
    renderTournamentsSkeleton(list);
    try {
      tournamentsData = (await API.tournaments.list()).map(normalizeTournament);
    } catch { /* offline */ }
  }
  if (tournamentsData) source = tournamentsData;

  // Offline: bootstrap failed, or the tournaments fetch itself failed
  if (!source.length && (!apiAvailable || tournamentsData === null)) {
    list.innerHTML = `<div class="tab-offline-state">
      <div class="tab-offline-icon">📡</div>
      <div class="tab-offline-text">Немає з'єднання з сервером</div>
    </div>`;
    return;
  }

  if (activeResultsSubTab === 'upcoming') {
    // Friendly tournaments also show here (below official ones) — renderUpcomingList sections them
    const upcoming = source.filter(t => t.status !== 'FINISHED');
    rebuildMonthChips(upcoming);
    renderUpcomingList(upcoming, list);
  } else if (activeResultsSubTab === 'friendly') {
    const friendly = source.filter(t => t.friendly);
    rebuildMonthChips(friendly);
    renderFriendlyList(friendly, list);
  } else {
    const finished = source.filter(t => t.status === 'FINISHED' && !t.friendly);
    rebuildMonthChips(finished);
    renderFinishedList(finished, list);
  }

  // Keep an open tournament detail page in sync with freshly fetched data
  refreshOpenTournamentPage();
}

/** Friendly subtab: create CTA on top, then active tournaments, finished below. */
function renderFriendlyList(friendly, list) {
  const active = applyResultFilter(friendly.filter(t => t.status !== 'FINISHED'));
  const done   = applyResultFilter(friendly.filter(t => t.status === 'FINISHED'));

  const createRow = `
    <button class="t-create-row" onclick="openCreateAmericano()">
      <span class="t-create-plus">＋</span>
      <span class="t-create-text">
        <strong>Створити турнір</strong>
        <span>Дружній турнір — створити може будь-хто</span>
      </span>
    </button>`;

  if (!active.length && !done.length) {
    list.innerHTML = createRow + `<div class="empty-state"><div class="empty-state-icon">🎾</div>
      <div class="empty-state-text">Дружніх турнірів ще немає<br>
      <span style="font-size:12px;color:var(--text-muted)">Станьте першим організатором</span></div></div>`;
    return;
  }

  list.innerHTML = createRow + `
    <div id="friendly-active-list"></div>
    ${active.length && done.length ? '<div class="cup-section-title" style="margin:16px 0 8px">Завершені</div>' : ''}
    <div id="friendly-finished-list"></div>`;
  if (active.length) renderUpcomingList(active, document.getElementById('friendly-active-list'));
  if (done.length)   renderFinishedList(done, document.getElementById('friendly-finished-list'));
}

function applyResultFilter(source) {
  if (activeResultFilter === 'all') return source;
  return source.filter(t => String(t.date).slice(0, 7) === activeResultFilter);
}

/** Official tournaments first (classic/americano-format split), friendly ones below —
    used for both the main "Майбутні" tab and the "Дружні" subtab's active list. */
function renderUpcomingList(source, list) {
  const filtered = applyResultFilter(source);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-text">Немає запланованих турнірів</div></div>`;
    return;
  }

  const official = filtered.filter(t => !t.friendly);
  const friendly = filtered.filter(t => t.friendly);
  let html = splitByFormatHtml(official);
  if (friendly.length) {
    if (official.length) html += `<div class="t-list-sep">🎾 Дружні</div>`;
    html += friendly.map(buildTournamentRow).join('');
  }
  list.innerHTML = html;
  wireTournamentRows(list);
}

/** AMERICANO and WINNERS_COURT share the app-user-created, self-managed format bucket. */
const AM_FAMILY_TYPES = new Set(['AMERICANO', 'WINNERS_COURT']);

/** Club (classic/cup) tournaments first, americano-format ones in their own
    section below — official americanos must not blend into the club list. */
function splitByFormatHtml(items) {
  const classic = items.filter(t => !AM_FAMILY_TYPES.has(t.type));
  const amer    = items.filter(t => AM_FAMILY_TYPES.has(t.type));
  let html = classic.map(buildTournamentRow).join('');
  if (amer.length) {
    if (classic.length) html += `<div class="t-list-sep">🎾 Американо</div>`;
    html += amer.map(buildTournamentRow).join('');
  }
  return html;
}

const T_STATUS_LABEL = { DRAFT: 'Реєстрація', ACTIVE: 'Активний', FINISHED: 'Завершено', GROUP_STAGE: 'Груповий етап', PLAYOFF: 'Плей-офф' };
const T_STATUS_CLS   = { DRAFT: 't-status-draft', ACTIVE: 't-status-active', FINISHED: 't-status-done', GROUP_STAGE: 't-status-live', PLAYOFF: 't-status-live' };

/** Full interactive tournament view — the body of the tournament detail page. */
function buildTournamentDetailCard(t) {
  const statusLabel = T_STATUS_LABEL;
  const statusCls   = T_STATUS_CLS;
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
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : t.type === 'CUP' ? '🏆 Кубок' : t.type === 'AMERICANO' ? '🎾 Американо' : t.type === 'WINNERS_COURT' ? "🪜 Winner's Court" : 'Парний';
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
        joinBtn = `<span class="chip-btn chip-reserve" title="Резерв · пара з ${esc(partnerN)}" style="pointer-events:none">⏳ Резерв · у парі</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else if (isReserveSolo) {
        joinBtn = `<span class="chip-btn chip-reserve" style="pointer-events:none">⏳ Резерв · шукає пару</span>`
                + (canLeave ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>` : '');
      } else if (isRegisteredPaired) {
        const partnerN = myPairEntry.player1?.id === currentUser?.id
            ? playerNameOf(myPairEntry.player2) : playerNameOf(myPairEntry.player1);
        joinBtn = `<span class="chip-btn chip-join" title="Пара з ${esc(partnerN)}" style="pointer-events:none">✓ У парі</span>`
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
      // Friendly tournaments have a softer leave rule — no 24h cutoff
      const friendlyCanLeave = isEnrolled && canJoin && t.friendly;
      const leaveBtn = (canLeave || friendlyCanLeave)
        ? `<button class="chip-btn chip-leave sr-leave-btn" data-id="${t.id}">Відписатись</button>`
        : '';
      joinBtn = canJoin
        ? (isEnrolled
            ? enrolledBadge + leaveBtn
            // Private roster is creator-managed — no self-join button
            : (t.isPrivate ? '' : `<button class="chip-btn chip-join sr-join-btn" data-id="${t.id}">${isFull ? 'У резерв' : 'Приєднатись'}</button>`))
        : '';
    }

    const priceLabel = t.price ? `${t.price} грн` : 'безкоштовно';

    const tpChip = (p, extra = '') => {
      const name = playerNameOf(p);
      return `<span class="tp-name${extra} tp-name-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${jsq(name)}')">${esc(name)}</span>`;
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

    // Americano / Winner's Court: the creator manages their own tournament like an admin
    const canManageT = currentUser && (currentUser.role === 'ADMIN'
        || t.createdById === currentUser.id);
    const amViewBtn = (AM_FAMILY_TYPES.has(t.type) && (t.status === 'ACTIVE' || (t.status === 'DRAFT' && canManageT)))
      ? `<button class="chip-btn chip-cup-view am-view-btn" data-id="${t.id}">${t.status === 'DRAFT' ? '⚙ Керувати турніром' : 'Раунди та рахунок'}</button>`
      : '';
    const friendlyBadges = `${t.friendly ? '<span class="friendly-badge">Дружній</span>' : ''}${t.isPrivate ? '<span class="friendly-badge fb-private">🔒</span>' : ''}`;

    return `
      <div class="tournament-card${t.type === 'CUP' ? ' tournament-card-cup' : ''}${t.friendly ? ' tournament-card-friendly' : ''}" data-tournament-id="${t.id}">
        <div class="tournament-card-header">
          <div class="tournament-meta">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div class="tournament-name">${esc(t.name)}${liveBadge}${friendlyBadges}</div>
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
              ${t.location ? `<span class="t-location-tag">📍 ${esc(t.location)}</span>` : ''}
              <span class="t-location-tag">💳 ${priceLabel}</span>
            </div>` : ''}
            ${t.description ? `<div class="t-description">${esc(t.description)}</div>` : ''}
            ${t.friendly && t.createdByName ? `<div class="t-organizer">Організатор: ${esc(t.createdByName)}</div>` : ''}
            ${t.type === 'CUP' && t.status === 'DRAFT' ? (joinBtn || '') : ''}
            ${cupViewBtn}
            ${amViewBtn}
            ${canManageT ? `
            <div class="t-admin-actions">
              ${t.status === 'DRAFT' || currentUser?.role === 'ADMIN' ? `<button class="t-admin-btn t-admin-edit-btn" data-id="${t.id}">Редагувати</button>` : ''}
              ${adminCupBtn}
              ${adminCupFinalize}
              <button class="t-admin-btn t-admin-delete-btn" data-id="${t.id}">Видалити</button>
            </div>` : ''}
          </div>
        </div>
        ${participantsList}
        ${reserveList}
      </div>`;
}

/** Wire join/leave/pair/admin actions inside a rendered tournament detail card. */
function wireTournamentCardActions(list) {
  list.querySelectorAll('.sr-join-btn').forEach(btn => {
    btn.addEventListener('click', () => attemptJoinTournament(parseInt(btn.dataset.id, 10)));
  });

  list.querySelectorAll('.sr-leave-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = parseInt(btn.dataset.id, 10);
      const t = (tournamentsData || []).find(x => x.id === tid);
      const name = t ? t.name : 'турнір';
      if (!(await uiConfirm(`Відписатись від «${name}»?`))) return;
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
    btn.addEventListener('click', () => attemptJoinTournament(parseInt(btn.dataset.id, 10), true));
  });

  list.querySelectorAll('.sr-pair-cancel-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const tid = parseInt(btn.dataset.id, 10);
      if (!(await uiConfirm('Скасувати заявку?'))) return;
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
      const isMe = currentUser && pr.player1?.id === currentUser.id;
      const canReq = isReserve ? (canJoin && !isEnrolled && !hasPendingRequest) : canRequestConfirmed;
      const joinBtn = (!isMe && canReq)
        ? `<button class="chip-btn chip-join sr-pair-join-btn" data-id="${t.id}" data-pid="${pr.participant1Id}" data-name="${esc(name)}"${isReserve ? ' data-reserve="1"' : ''}>Грати</button>`
        : '';
      const soloTag = isMe ? '' : `<span class="tp-solo-tag">${isReserve ? 'резерв · шукає пару' : 'шукає пару'}</span>`;
      return `<div class="tp-pair-row${isReserve ? ' tp-reserve-row' : ''}"><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player1?.id || ''}','${jsq(name)}')">${esc(name)}</span>${soloTag}${joinBtn}</div>`;
    }
    const n1 = playerNameOf(pr.player1), n2 = playerNameOf(pr.player2);
    const reserveTag = isReserve ? '<span class="tp-solo-tag">резерв</span>' : '';
    return `<div class="tp-pair-row${isReserve ? ' tp-reserve-row' : ''}"><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player1?.id || ''}','${jsq(n1)}')">${esc(n1)}</span><span class="tp-pair-sep">/</span><span class="tp-name tp-name-tap" onclick="_tournamentPlayerTap('${pr.player2?.id || ''}','${jsq(n2)}')">${esc(n2)}</span>${reserveTag}</div>`;
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
    // data-init lets the PNG export swap CORS-blocked photos for initials
    return `<img src="${safe}" alt="" data-init="${esc(initials(player.name))}" onerror="this.style.display='none'">`;
  }
  return initials(player.name);
}

function renderFinishedList(source, list) {
  const filtered = applyResultFilter(source);

  if (!filtered.length) {
    list.innerHTML = `<div class="empty-state"><div class="empty-state-icon">🏆</div><div class="empty-state-text">Немає завершених турнірів</div></div>`;
    return;
  }

  const classic = filtered.filter(t => !AM_FAMILY_TYPES.has(t.type));
  const amer    = filtered.filter(t => AM_FAMILY_TYPES.has(t.type));
  let html = classic.map(buildFinishedRow).join('');
  if (amer.length) {
    if (classic.length) html += `<div class="t-list-sep">🎾 Американо</div>`;
    html += amer.map(buildFinishedRow).join('');
  }
  list.innerHTML = html;
  wireTournamentRows(list);
}

/** Finished tournament full view (champion plaque + medals + results table) — detail page body. */
function buildFinishedDetailCard(t) {
    const results = (t.results || []).slice().sort((a, b) => a.pos - b.pos);
    // Legacy data may contain shared positions (e.g. 1,1,3) — keep every entry
    // per slot so tied players never disappear from the ceremony.
    const champs  = results.filter(r => r.pos === 1);
    const silvers = results.filter(r => r.pos === 2);
    const bronzes = results.filter(r => r.pos === 3);
    const rest    = results.filter(r => r.pos > 3);
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : t.type === 'CUP' ? '🏆 Кубок' : t.type === 'AMERICANO' ? '🎾 Американо' : t.type === 'WINNERS_COURT' ? "🪜 Winner's Court" : 'Парний';

    const playersOf = r => r.players || r.pair.map(n => ({ id: null, name: n, photoUrl: null }));
    const tapAttr   = p => `onclick="_tournamentPlayerTap('${p.id || ''}','${jsq(p.name)}')"`;

    // ── Champion plaque ──
    const champBlocks = champs.map(r => {
      const players = playersOf(r);
      const avatars = `<div class="fin-hero-avatars${players.length > 1 ? ' fin-duo' : ''}">
          <span class="fin-hero-crown">👑</span>
          ${players.map(p => `<div class="fin-hero-avatar lb-row-tap" ${tapAttr(p)}>${fpAvatarHtml(p)}</div>`).join('')}
        </div>`;
      const names = players.map(p => `<span class="lb-row-tap" ${tapAttr(p)}>${esc(p.name)}</span>`).join('<span class="fin-hero-amp">/</span>');
      return `<div class="fin-hero-champ">
          ${avatars}
          <div class="fin-hero-names">${names}</div>
          <div class="fin-hero-meta">
            ${r.score ? `<span class="fin-hero-score">${esc(r.score)}</span>` : ''}
            ${r.pts ? `<span class="fin-hero-pts">${r.pts > 0 ? '+' : ''}${r.pts} <small>BSP</small></span>` : ''}
          </div>
        </div>`;
    }).join('');

    // Plaque footer — the story of the win: pre-tournament win chance (Elo,
    // computed by the backend from ratings *before* the tournament), the
    // seed→finish journey, field strength, and an occasional «Прорив дня».
    const teams     = results.length;
    const soloChamp = champs.length === 1 && playersOf(champs[0]).length === 1;
    let footerHtml = '';
    if (t.winnerPreChance != null && teams >= 2) {
      const baseline = 100 / teams;
      const badge = t.winnerPreChance <= baseline * 0.6
        ? '<span class="fin-odds-badge fin-odds-sensation">Сенсація</span>'
        : t.winnerPreSeed === 1
        ? `<span class="fin-odds-badge fin-odds-fav">${soloChamp ? 'Фаворит' : 'Фаворити'}</span>`
        : '';
      footerHtml += `<div class="fin-odds">
          <div class="fin-odds-gauge">
            <svg class="fin-odds-ring" viewBox="0 0 40 40" aria-hidden="true">
              <!-- presentation attrs duplicate the CSS so the PNG export survives
                   html-to-image's lossy style inlining on SVG children -->
              <circle class="fin-odds-track" cx="20" cy="20" r="16" pathLength="100" fill="none" stroke="rgba(244,242,234,0.15)" stroke-width="3.5"/>
              <circle class="fin-odds-arc" cx="20" cy="20" r="16" pathLength="100" transform="rotate(-90 20 20)" fill="none" stroke="#D9EF55" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="${Math.max(3, Math.min(t.winnerPreChance, 100))} 100" style="--p:${Math.max(3, Math.min(t.winnerPreChance, 100))}"/>
            </svg>
            <span class="fin-odds-num">${t.winnerPreChance}%</span>
          </div>
          <div class="fin-odds-txt">
            <div class="fin-odds-label">Шансів на перемогу до старту</div>
          </div>
          ${badge}
        </div>`;
    }
    const factCells = [];
    if (t.winnerPreSeed != null && teams >= 2) {
      factCells.push({ l: 'Посів → фініш', v: `№${t.winnerPreSeed} → №1` });
    }
    if (t.finalizedAvgRating) {
      factCells.push({ l: 'Сила поля', v: `${t.finalizedAvgRating} <small>BSP</small>` });
    }
    // «Прорив дня» — a non-champion pair that out-earned the champions
    const champMaxPts = champs.length ? Math.max(...champs.map(r => r.pts || 0)) : 0;
    const breakout = results.filter(r => r.pos !== 1)
      .reduce((a, r) => (r.pts || 0) > (a ? a.pts : 0) ? r : a, null);
    if (breakout && breakout.pts > champMaxPts && breakout.pts > 0) {
      factCells.push({ l: 'Прорив дня', v: `+${breakout.pts}`, sub: playersOf(breakout).map(p => esc(p.name)).join(' / ') });
    }
    if (factCells.length) {
      footerHtml += `<div class="fin-facts">${factCells.map(f =>
        `<div class="fin-fact"><span class="fin-fact-l">${f.l}</span><span class="fin-fact-v">${f.v}</span>${f.sub ? `<span class="fin-fact-sub">${f.sub}</span>` : ''}</div>`).join('')}</div>`;
    }
    if (!footerHtml) footerHtml = '<div class="fin-hero-pad"></div>';

    const heroHtml = champs.length > 0
      ? `<div class="fin-hero">
          <div class="fin-hero-eyebrow">${soloChamp ? 'Чемпіон турніру' : 'Чемпіони турніру'}</div>
          ${champBlocks}
          ${footerHtml}
        </div>`
      : '';

    // ── Silver & bronze medal cards ──
    const medalCard = (r, tier) => {
      const players = playersOf(r);
      const avatars = `<div class="fin-medal-avatars${players.length > 1 ? ' fin-duo' : ''}">
          ${players.map(p => `<div class="fin-medal-avatar lb-row-tap" ${tapAttr(p)}>${fpAvatarHtml(p)}</div>`).join('')}
        </div>`;
      const names = players.map(p => `<span class="lb-row-tap" ${tapAttr(p)}>${esc(p.name)}</span>`).join('');
      return `<div class="fin-medal fin-medal-${tier}">
          <span class="fin-medal-rank">${r.pos}</span>
          <div class="fin-medal-tier">${tier === 2 ? 'Срібло' : 'Бронза'}</div>
          ${avatars}
          <div class="fin-medal-names">${names}</div>
          ${r.score ? `<div class="fin-medal-score">${esc(r.score)}</div>` : ''}
          ${r.pts ? `<div class="fin-medal-pts${r.pts > 0 ? '' : ' neg'}">${r.pts > 0 ? '+' : ''}${r.pts}</div>` : ''}
        </div>`;
    };
    const medalsHtml = (silvers.length || bronzes.length)
      ? `<div class="fin-medals">${silvers.map(r => medalCard(r, 2)).join('')}${bronzes.map(r => medalCard(r, 3)).join('')}</div>`
      : '';

    // ── Personal result ribbon (champions are already on the plaque) ──
    const my = currentUser
      ? results.find(r => playersOf(r).some(p => p.id != null && String(p.id) === String(currentUser.id)))
      : null;
    const myHtml = my && my.pos > 1
      ? `<div class="fin-my">${
          my.pos === 2 ? 'Ви взяли срібло 🥈' :
          my.pos === 3 ? 'У вас бронза 🥉' :
          `Ви фінішували <b>#${my.pos}</b> з ${teams}`
        }${my.pts ? ` · <b class="${my.pts > 0 ? 'fin-my-pos' : 'fin-my-neg'}">${my.pts > 0 ? '+' : ''}${my.pts} BSP</b>` : ''}</div>`
      : '';

    const hasScore = results.some(r => r.score);
    const restHtml = rest.length > 0
      ? `<div class="fin-table-label">Турнірна таблиця</div>
        <div class="results-table">
          ${hasScore ? `<div class="results-col-labels">
            <span class="results-col-label-score">Рах.</span>
            <span class="results-col-label-pts">BSP</span>
          </div>` : ''}
          ${rest.map(r => {
            const rPlayers = r.players || r.pair.map(n => ({ id: null, name: n }));
            const nameSpans = rPlayers.map(p => `<span class="lb-row-tap" style="cursor:pointer" onclick="_tournamentPlayerTap('${p.id || ''}','${jsq(p.name)}')">${esc(p.name)}</span>`).join('<span class="separator"> / </span>');
            return `
            <div class="results-row">
              <span class="results-pos pos-${r.pos}">${r.pos}</span>
              <div class="results-pair"><div class="results-pair-names">${nameSpans}</div></div>
              ${r.score ? `<span class="results-score">${esc(r.score)}</span>` : (hasScore ? `<span class="results-score-empty"></span>` : '')}
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
      : AM_FAMILY_TYPES.has(t.type)
      ? `<button class="chip-btn chip-cup-view am-view-btn" data-id="${t.id}">Раунди та рахунок</button>`
      : '';
    const friendlyBadges = `${t.friendly ? '<span class="friendly-badge">Дружній</span>' : ''}${t.isPrivate ? '<span class="friendly-badge fb-private">🔒</span>' : ''}`;

    return `<div class="finished-card${t.friendly ? ' tournament-card-friendly' : ''}">
      <div class="finished-card-header">
        <div class="finished-card-name">${esc(t.name)}${friendlyBadges}</div>
        <div class="finished-card-meta">
          <span class="tournament-date">${fmt(t.date)}</span>
          ${t.levelLabel ? `<span class="level-badge level-badge-lg ${levelClass(t.levelLabel)}">${t.levelRangeLabel || t.levelLabel}</span>` : ''}
          <span class="tournament-cat">${typeLabel}</span>
        </div>
        ${t.description ? `<div class="t-description">${esc(t.description)}</div>` : ''}
        ${cupViewBtn}
        ${currentUser?.role === 'ADMIN' ? `
        <div class="t-admin-actions">
          <button class="t-admin-btn t-admin-edit-btn" data-id="${t.id}">Редагувати</button>
          <button class="t-admin-btn t-admin-delete-btn" data-id="${t.id}">Видалити</button>
        </div>` : ''}
      </div>
      ${heroHtml}
      ${medalsHtml}
      ${myHtml}
      ${restHtml}
      ${results.length ? `<button class="fin-share-btn" onclick="exportFinishedPng(${t.id})">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
        Зберегти як картинку
      </button>` : ''}
      ${analysisBtn}
    </div>`;
}

/* ── PNG export of the finished-tournament card ─────────────────── */

/** Lazy-load the vendored html-to-image lib (kept off the boot path). */
function ensureHtmlToImage() {
  return new Promise((resolve, reject) => {
    if (window.htmlToImage) return resolve();
    const s = document.createElement('script');
    s.src = 'js/vendor/html-to-image.min.js?v=1';
    s.onload = resolve;
    s.onerror = () => reject(new Error('lib load failed'));
    document.head.appendChild(s);
  });
}

/** Render the open finished card to a PNG data URL (clean shareable version). */
async function _captureFinishedCardPng() {
  const card = document.querySelector('#t-page-body .finished-card');
  if (!card) throw new Error('card not found');
  await ensureHtmlToImage();

  // Work on an offscreen clone: strip buttons/personal bits, add branding.
  const clone = card.cloneNode(true);
  clone.querySelectorAll('.t-admin-actions, .analysis-btn, .fin-share-btn, .fin-my, .cup-view-btn, .am-view-btn')
    .forEach(el => el.remove());
  clone.insertAdjacentHTML('beforeend', '<div class="fin-export-brand">★ BLACKSEA PADEL · ODESA ★</div>');

  const frame = document.createElement('div');
  frame.className = 'fin-export-frame';
  frame.appendChild(clone);
  // Fixed canonical width — shared PNGs look the same from any device
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-10000px;top:0;width:440px;';
  holder.appendChild(frame);
  document.body.appendChild(holder);

  try {
    // Avatars the CORS way or not at all: photos we can't re-fetch would
    // otherwise come out blank — swap them for initials.
    await Promise.all([...clone.querySelectorAll('img')].map(async img => {
      try {
        const r = await fetch(img.src, { mode: 'cors' });
        if (!r.ok) throw new Error();
      } catch {
        img.replaceWith(document.createTextNode(img.dataset.init || ''));
      }
    }));
    const opts = { pixelRatio: 2, backgroundColor: getComputedStyle(document.body).backgroundColor };
    await htmlToImage.toPng(frame, opts);          // warm-up: dodges the WebKit blank-first-render race
    return await htmlToImage.toPng(frame, opts);
  } finally {
    holder.remove();
  }
}

async function exportFinishedPng(tid) {
  const btn = document.querySelector('#t-page-body .fin-share-btn');
  if (btn?.disabled) return;
  const origHtml = btn ? btn.innerHTML : '';
  if (btn) { btn.disabled = true; btn.textContent = 'Готуємо картинку…'; }
  try {
    const dataUrl = await _captureFinishedCardPng();
    const t = (tournamentsData || []).find(x => String(x.id) === String(tid));
    const fileName = `BSP-${t?.date || 'results'}.png`;
    const blob = await (await fetch(dataUrl)).blob();
    const file = new File([blob], fileName, { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file] });
        showToast('Готово! 📸');
        return;
      } catch (e) {
        if (e.name === 'AbortError') return; // user closed the share sheet
        // fall through to plain download
      }
    }
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Картинку збережено 📸');
  } catch (e) {
    showToast('Не вдалося створити картинку', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
  }
}

function wireAdminTournamentBtns(container) {
  container.querySelectorAll('.t-admin-edit-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const t = (tournamentsData || []).find(x => String(x.id) === String(btn.dataset.id));
      if (!t) return;
      if (AM_FAMILY_TYPES.has(t.type)) openEditAmericano(t);
      else await openEditTournament(t);
    });
  });
  container.querySelectorAll('.t-admin-delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Видалити цей турнір? Цю дію не можна скасувати.'))) return;
      const t = (tournamentsData || []).find(x => String(x.id) === String(btn.dataset.id));
      btn.disabled = true;
      try {
        // Americano / Winner's Court go through their own endpoints — creators may delete their own
        if (t?.type === 'AMERICANO') await API.americano.delete(btn.dataset.id);
        else if (t?.type === 'WINNERS_COURT') await API.winnersCourt.delete(btn.dataset.id);
        else await API.tournaments.delete(btn.dataset.id);
        tournamentsData = null;
        renderResults();
      } catch (e) {
        showToast('Помилка: ' + (e.data?.message || e.message || 'unknown'), 'error');
        btn.disabled = false;
      }
    });
  });
  container.querySelectorAll('.am-view-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = (tournamentsData || []).find(x => String(x.id) === String(btn.dataset.id));
      if (t?.type === 'WINNERS_COURT') openWinnersCourtModal(btn.dataset.id);
      else openAmericanoModal(btn.dataset.id);
    });
  });
  container.querySelectorAll('.t-admin-cup-start-btn').forEach(btn => {
    btn.addEventListener('click', () => openCupStartModal(btn.dataset.id));
  });
  container.querySelectorAll('.t-admin-cup-finalize-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Фіналізувати кубок та нарахувати рейтинг?'))) return;
      btn.disabled = true;
      try {
        await API.cup.finalize(btn.dataset.id);
        tournamentsData = null;
        renderResults();
        showToast('Кубок завершено! Рейтинг нараховано 🏆');
      } catch (e) {
        showToast('Помилка: ' + (e.data?.message || e.message || 'unknown'), 'error');
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

/* ════════════════════════════════════════════════════════════════
   COMPACT LIST ROWS + FULL-SCREEN TOURNAMENT PAGE
   Lists show scannable rows; tapping one opens the detail page,
   whose body is the full interactive card (buildTournamentDetailCard
   / buildFinishedDetailCard) with all join/pair/admin actions.
════════════════════════════════════════════════════════════════ */

function tRowDateBlock(t) {
  const d = new Date(t.date);
  return `<div class="t-row-date"><span class="t-row-day">${d.getDate()}</span><span class="t-row-mon">${UA_MONTHS[d.getMonth()]}</span></div>`;
}

/** The current user's relation to a tournament, or null when not enrolled. */
function myEnrollmentState(t) {
  if (!currentUser) return null;
  const isPairReg = t.type === 'PAIR' || (t.type === 'CUP' && t.status === 'DRAFT');
  if (isPairReg) {
    const inEntry = pool => (pool || []).find(pr =>
      pr.player1?.id === currentUser.id || pr.player2?.id === currentUser.id);
    const main = inEntry(t.pairRegistrations);
    const res  = inEntry(t.pairReserveRegistrations);
    if (!main && !res && t.myPendingPairRequestId) return { label: '⏳ Заявка надіслана', cls: 'wait' };
    if (main && main.player2) return { label: '✓ У парі', cls: 'ok' };
    if (main)                 return { label: '🔍 Шукаєте пару', cls: 'warn' };
    if (res && res.player2)   return { label: '⏳ Резерв · у парі', cls: 'wait' };
    if (res)                  return { label: '⏳ Резерв', cls: 'wait' };
    return null;
  }
  const inMain = (t.participants || []).some(p => p.id === currentUser.id);
  const inRes  = (t.reserveParticipants || []).some(p => p.id === currentUser.id);
  if (inMain) return { label: '✓ Зареєстровано', cls: 'ok' };
  if (inRes)  return { label: '⏳ Резерв', cls: 'wait' };
  return null;
}

function tTypeLabel(t) {
  return t.type === 'SINGLE' ? 'Одиночний'
       : t.type === 'CUP' ? '🏆 Кубок'
       : t.type === 'AMERICANO' ? '🎾 Американо'
       : t.type === 'WINNERS_COURT' ? "🪜 Winner's Court"
       : 'Парний';
}

function buildTournamentRow(t) {
  const isLive = t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF';
  const isPairReg = t.type === 'PAIR' || (t.type === 'CUP' && t.status === 'DRAFT');
  const pairRegs = t.pairRegistrations || [];
  const cnt = isPairReg
    ? (t.maxParticipants
        ? `${pairRegs.length}/${Math.floor(t.maxParticipants / 2)} пар`
        : (pairRegs.length ? `${pairRegs.length} пар` : ''))
    : (t.maxParticipants
        ? `${t.participantCount || 0}/${t.maxParticipants} уч.`
        : (t.participantCount ? `${t.participantCount} уч.` : ''));
  const st = myEnrollmentState(t);
  const meta = [
    t.time ? t.time.slice(0, 5) : null,
    t.levelRangeLabel || t.levelLabel,
    tTypeLabel(t),
    cnt,
  ].filter(Boolean).join(' · ');
  return `
    <button class="t-row${t.friendly ? ' t-row-friendly' : ''}${AM_FAMILY_TYPES.has(t.type) ? ' t-row-am' : ''}" data-id="${t.id}">
      ${tRowDateBlock(t)}
      <div class="t-row-main">
        <div class="t-row-name">${esc(t.name)}${isLive ? '<span class="live-badge">● LIVE</span>' : ''}${t.isPrivate ? '<span class="friendly-badge fb-private">🔒</span>' : ''}</div>
        <div class="t-row-meta">${esc(meta)}</div>
        <div class="t-row-tags">
          <span class="${T_STATUS_CLS[t.status] || 't-status-done'}">${T_STATUS_LABEL[t.status] || esc(t.status)}</span>
          ${st ? `<span class="t-row-state st-${st.cls}">${st.label}</span>` : ''}
        </div>
      </div>
      <span class="t-row-chev">›</span>
    </button>`;
}

function buildFinishedRow(t) {
  const results = t.results || [];
  const win = results.find(r => r.pos === 1);
  const my = currentUser
    ? results.find(r => (r.players || []).some(p => p.id != null && String(p.id) === String(currentUser.id)))
    : null;
  return `
    <button class="t-row t-row-done${t.friendly ? ' t-row-friendly' : ''}${AM_FAMILY_TYPES.has(t.type) ? ' t-row-am' : ''}" data-id="${t.id}">
      ${tRowDateBlock(t)}
      <div class="t-row-main">
        <div class="t-row-name">${esc(t.name)}</div>
        <div class="t-row-meta">${win ? `🥇 ${esc(win.pair.join(' / '))}` : tTypeLabel(t)}</div>
        <div class="t-row-tags">
          ${t.levelLabel ? `<span class="level-badge level-badge-sm ${levelClass(t.levelLabel)}">${t.levelRangeLabel || t.levelLabel}</span>` : ''}
          ${my ? `<span class="t-row-state ${my.pts >= 0 ? 'st-ok' : 'st-neg'}">Ви: #${my.pos} · ${my.pts > 0 ? '+' : ''}${my.pts}</span>` : ''}
          ${t.hasAnalysis ? '<span class="t-row-state st-wait">AI аналіз</span>' : ''}
        </div>
      </div>
      <span class="t-row-chev">›</span>
    </button>`;
}

function wireTournamentRows(list) {
  list.querySelectorAll('.t-row').forEach(row => {
    row.addEventListener('click', () => openTournamentPage(parseInt(row.dataset.id, 10)));
  });
}

/* ── Tournament detail page ─────────────────────────────────────── */
let tPageId = null;

async function openTournamentPage(tid) {
  tPageId = tid;
  const page = document.getElementById('t-page');
  const body = document.getElementById('t-page-body');
  page.classList.add('t-page-visible');
  if (tg) tg.BackButton.show();

  let t = (tournamentsData || []).find(x => String(x.id) === String(tid));
  if (!t) {
    body.innerHTML = '<div class="history-loading">Завантаження...</div>';
    try {
      t = normalizeTournament(await API.tournaments.get(tid));
    } catch {
      body.innerHTML = `<div class="tab-offline-state"><div class="tab-offline-icon">📡</div><div class="tab-offline-text">Не вдалося завантажити турнір</div></div>`;
      return;
    }
    if (tPageId !== tid) return; // page changed while loading
  }
  renderTournamentPage(t);
}

function renderTournamentPage(t) {
  document.getElementById('t-page-title').textContent = t.name;
  const body = document.getElementById('t-page-body');
  body.innerHTML = t.status === 'FINISHED'
    ? buildFinishedDetailCard(t)
    : buildTournamentDetailCard(t);
  wireTournamentCardActions(body);
  body.scrollTop = 0;
}

function closeTournamentPage() {
  tPageId = null;
  document.getElementById('t-page').classList.remove('t-page-visible');
  if (tg && currentTab === 'home') tg.BackButton.hide();
}

/** Re-render the open detail page after tournamentsData was refetched. */
function refreshOpenTournamentPage() {
  if (!tPageId) return;
  const t = (tournamentsData || []).find(x => String(x.id) === String(tPageId));
  if (t) renderTournamentPage(t);
}

document.getElementById('t-page-back').addEventListener('click', closeTournamentPage);

/* Stale-while-revalidate: refetch the tournament list in the background and
   re-render only when something actually changed — no skeleton flash. */
let _tFetchSeq = 0;
async function refreshTournamentsSilently() {
  if (!apiAvailable) return;
  const seq = ++_tFetchSeq;
  try {
    const fresh = (await API.tournaments.list()).map(normalizeTournament);
    if (seq !== _tFetchSeq) return; // a newer refresh finished first
    const changed = JSON.stringify(fresh) !== JSON.stringify(tournamentsData);
    tournamentsData = fresh;
    if (changed) {
      if (currentTab === 'results') renderResults();
      else refreshOpenTournamentPage();
    }
  } catch { /* offline — keep showing the cached data */ }
}

/** Registration entry point shared by list, detail page and Home hero. */
function attemptJoinTournament(tid, asReserve = false) {
  const tournament = (tournamentsData || []).find(t => t.id === tid);
  if (!tournament) return;
  // Raketo link is required for self-enrollment (admins bypass this;
  // friendly tournaments are open to everyone)
  if (!tournament.friendly && currentUser && !currentUser.raketoDocId && currentUser.role !== 'ADMIN') {
    showToast('Для реєстрації потрібно підключити профіль Raketo 🎾', 'error');
    switchTab('profile');
    return;
  }
  showRegistrationConfirm(tournament, false, asReserve);
}

