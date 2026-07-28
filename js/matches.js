/* ════════════════════════════════════════════════════════════════
   CASUAL (NON-TOURNAMENT) MATCHES
   List screen (Активні / Останні) + full-screen detail page (#m-page,
   mirrors #t-page) + create sheet + per-set team/score editor.
════════════════════════════════════════════════════════════════ */

let matchesData = null; // cached list from API.matches.list()
let mPageId = null;     // id of the open detail page, or null
let mSetEditor = null;  // { _rosterKey, sets:[{teamA:[id,id],teamB:[id,id],gamesA,gamesB,tbA,tbB}], sel:{setIdx,id}|null }

const M_STATUS_LABEL = { OPEN: 'Збір гравців', PENDING_APPROVAL: 'Очікує підтвердження', FINISHED: 'Завершено', CANCELLED: 'Скасовано' };
const M_STATUS_CLS   = { OPEN: 't-status-draft', PENDING_APPROVAL: 't-status-live', FINISHED: 't-status-done', CANCELLED: 't-status-done' };

function mMatchTitle(m) {
  return m.title || `Товариський матч #${m.id}`;
}

function mCacheUpdate(fresh) {
  if (!fresh) return;
  if (!matchesData) { matchesData = [fresh]; return; }
  const idx = matchesData.findIndex(x => String(x.id) === String(fresh.id));
  if (idx >= 0) matchesData[idx] = fresh; else matchesData.unshift(fresh);
}

/* ── List screen ─────────────────────────────────────────────────── */

function renderMatchesSkeleton(list) {
  list.innerHTML = Array.from({ length: 3 }, (_, i) => `
    <div class="t-skel-card">
      <div class="skel t-skel-title" style="width:${60 + i * 6}%"></div>
      <div class="skel t-skel-meta" style="width:${35 + i * 5}%"></div>
      <div class="skel t-skel-tags"></div>
    </div>`).join('');
}

async function renderMatches() {
  const list = document.getElementById('matches-list');
  if (!list) return;

  if (apiLoading && matchesData === null) { renderMatchesSkeleton(list); return; }

  if (apiAvailable && matchesData === null) {
    renderMatchesSkeleton(list);
    try { matchesData = await API.matches.list(); } catch { /* offline */ }
  }

  if (matchesData === null && (!apiAvailable)) {
    list.innerHTML = `<div class="tab-offline-state">
      <div class="tab-offline-icon">📡</div>
      <div class="tab-offline-text">Немає з'єднання з сервером</div>
    </div>`;
    return;
  }

  const source = matchesData || [];
  const active = source.filter(m => m.status === 'OPEN' || m.status === 'PENDING_APPROVAL');
  const finished = source.filter(m => m.status === 'FINISHED')
    .sort((a, b) => new Date(b.finishedAt || b.createdAt) - new Date(a.finishedAt || a.createdAt))
    .slice(0, 15);

  // Same reasoning as renderResults: revisiting the tab must not rebuild rows
  // that would come out byte-identical.
  if (!shouldRepaint('matches', [currentUser?.id ?? null, active, finished])) {
    refreshOpenMatchPage();
    return;
  }

  const createRow = `
    <button class="t-create-row" onclick="openAnnounceMatchModal()">
      <span class="t-create-plus" aria-hidden="true">📣</span>
      <span class="t-create-text">
        <strong>Анонсувати гру</strong>
        <span>Зберіть гравців на конкретний час і корт</span>
      </span>
    </button>
    <button class="t-create-row" onclick="openRecordMatchModal()">
      <span class="t-create-plus" aria-hidden="true">➕</span>
      <span class="t-create-text">
        <strong>Записати матч</strong>
        <span>Уже зіграли — одразу внесіть рахунок</span>
      </span>
    </button>`;

  if (!active.length && !finished.length) {
    list.innerHTML = createRow + `<div class="empty-state"><div class="empty-state-icon">🎾</div>
      <div class="empty-state-text">Матчів ще немає<br>
      <span style="font-size:12px;color:var(--text-muted)">Створіть перший товариський матч</span></div></div>`;
    return;
  }

  let html = createRow;
  if (active.length)   html += `<div class="t-list-sep">Активні</div>` + active.map(buildMatchRow).join('');
  if (finished.length) html += `<div class="t-list-sep">Останні</div>` + finished.map(buildMatchRow).join('');
  list.innerHTML = html;
  wireMatchRows(list);

  // Keep an open detail page in sync with the freshly fetched list
  refreshOpenMatchPage();
}

let _mFetchSeq = 0;
async function refreshMatchesSilently() {
  if (!apiAvailable) return;
  const seq = ++_mFetchSeq;
  try {
    const fresh = await API.matches.list();
    if (seq !== _mFetchSeq) return;
    const changed = JSON.stringify(fresh) !== JSON.stringify(matchesData);
    matchesData = fresh;
    if (!changed) return;
    if (currentTab === 'matches') renderMatches();
    else refreshOpenMatchPage();
  } catch { /* offline — keep showing the cached data */ }
}

// Time-first label: prefer the (not-yet-deployed) scheduledAt field, fall back
// to "created" — coded defensively since the backend may not send it yet.
function mScheduleLabel(m) {
  if (m.scheduledAt) {
    const d = new Date(m.scheduledAt);
    if (!isNaN(d.getTime())) {
      const datePart = d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      const timePart = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' });
      return `${datePart} · ${timePart}`;
    }
  }
  return `Створено ${fmt(m.createdAt)}`;
}

// One player's avatar in a lineup strip (overlapping circles, mirrors lb-avatar sizing).
function mLineupAvatar(u) {
  return `<span class="m-lineup-av" title="${esc(playerNameOf(u))}">${avatarHtml({ name: playerNameOf(u), photoUrl: u.photoUrl }, 'sm')}</span>`;
}

// Who's actually playing, at a glance. ≥4 active players get a 2v2 "vs" split
// (mirrors the default team pairing used by the score composer); fewer just show
// whoever has joined so far.
function mLineupHtml(activeUsers) {
  if (!activeUsers.length) return `<span class="m-lineup-empty">Ще ніхто не приєднався</span>`;
  if (activeUsers.length >= 4) {
    const teamA = activeUsers.slice(0, 2), teamB = activeUsers.slice(2, 4);
    return `
      <span class="m-lineup-team">${teamA.map(mLineupAvatar).join('')}</span>
      <span class="m-row-vs">vs</span>
      <span class="m-lineup-team">${teamB.map(mLineupAvatar).join('')}</span>`;
  }
  return `<span class="m-lineup-team">${activeUsers.map(mLineupAvatar).join('')}</span>`;
}

// Tally sets won per side from m.sets to show a finished match's result inline,
// without needing to open the detail page. Team rosters are read off the first
// set (matches don't change lineup mid-match).
function mSetsSummary(m) {
  const sets = m.sets || [];
  if (!sets.length) return null;
  let winsA = 0, winsB = 0;
  sets.forEach(s => { if (s.gamesA > s.gamesB) winsA++; else if (s.gamesB > s.gamesA) winsB++; });
  return {
    sets, winsA, winsB,
    teamA: [sets[0].a1, sets[0].a2],
    teamB: [sets[0].b1, sets[0].b2],
    aWon: winsA > winsB,
    bWon: winsB > winsA,
  };
}

function buildMatchRow(m) {
  const dotCls = m.status === 'OPEN' ? 'm-dot-open'
    : m.status === 'PENDING_APPROVAL' ? 'm-dot-pending'
    : m.status === 'CANCELLED' ? 'm-dot-cancelled'
    : 'm-dot-done';
  const myTag = m.myState === 'ACTIVE'
    ? `<span class="t-row-state st-ok">У складі</span>`
    : m.myState === 'WAITLIST'
      ? `<span class="t-row-state st-wait">У черзі</span>`
      : '';

  const timeLabel = mScheduleLabel(m);
  const locName = m.location && typeof m.location === 'object' ? m.location.name : m.location;
  const locLabel = locName ? `<span class="m-row-loc">· ${esc(locName)}</span>` : '';

  let bodyHtml;
  if (m.status === 'FINISHED') {
    const summary = mSetsSummary(m);
    if (summary) {
      const scoreStr = summary.sets.map(s => {
        const tb = s.tiebreakA != null ? ` (${s.tiebreakA}:${s.tiebreakB})` : '';
        return `${s.gamesA}:${s.gamesB}${tb}`;
      }).join(', ');
      bodyHtml = `
        <div class="m-row-final">
          <div class="m-row-team${summary.aWon ? ' m-row-team-win' : ''}">
            <span class="m-lineup-team">${summary.teamA.map(mLineupAvatar).join('')}</span>
            <span class="m-row-team-names">${esc(playerNameOf(summary.teamA[0]))} / ${esc(playerNameOf(summary.teamA[1]))}</span>
          </div>
          <div class="m-row-final-mid">
            <span class="m-row-setscore">${summary.winsA}:${summary.winsB}</span>
          </div>
          <div class="m-row-team m-row-team-right${summary.bWon ? ' m-row-team-win' : ''}">
            <span class="m-row-team-names">${esc(playerNameOf(summary.teamB[0]))} / ${esc(playerNameOf(summary.teamB[1]))}</span>
            <span class="m-lineup-team">${summary.teamB.map(mLineupAvatar).join('')}</span>
          </div>
        </div>
        <div class="m-row-games">${esc(scoreStr)}</div>`;
    } else {
      bodyHtml = `<div class="m-lineup-empty">Рахунок не внесено</div>`;
    }
  } else {
    const active = (m.activePlayers || []).map(ap => ap.user);
    const waitN = (m.waitlist || []).length;
    bodyHtml = `
      <div class="m-row-lineup">${mLineupHtml(active)}</div>
      ${waitN ? `<div class="m-row-waitn">+${waitN} у черзі</div>` : ''}`;
  }

  return `
    <button class="t-row m-row ${m.ratingEnabled ? 'm-row-rating' : 'm-row-friendly'}" data-id="${m.id}">
      <div class="t-row-main">
        <div class="m-row-top">
          <span class="m-row-time">${esc(timeLabel)}</span>
          ${locLabel}
          <span class="m-row-kind" aria-hidden="true">${m.ratingEnabled ? '⚡' : '🎾'}</span>
          <span class="m-dot ${dotCls}" aria-hidden="true"></span>
        </div>
        ${bodyHtml}
        ${myTag ? `<div class="m-row-tags">${myTag}</div>` : ''}
      </div>
      <span class="t-row-chev">›</span>
    </button>`;
}

function wireMatchRows(list) {
  list.querySelectorAll('.m-row').forEach(row => {
    row.addEventListener('click', () => openMatchPage(parseInt(row.dataset.id, 10)));
  });
}

/* ── Detail page ─────────────────────────────────────────────────── */

async function openMatchPage(id) {
  mPageId = id;
  const page = document.getElementById('m-page');
  const body = document.getElementById('m-page-body');
  page.classList.add('t-page-visible');
  if (tg) tg.BackButton.show();

  const cached = (matchesData || []).find(x => String(x.id) === String(id));
  if (cached) renderMatchPage(cached);
  else body.innerHTML = '<div class="history-loading">Завантаження...</div>';

  try {
    const fresh = await API.matches.get(id);
    if (mPageId !== id) return; // page changed while loading
    mCacheUpdate(fresh);
    mSetEditor = null; // rebuild composer from the freshly loaded sets/roster
    renderMatchPage(fresh);
  } catch {
    if (!cached) {
      body.innerHTML = `<div class="tab-offline-state"><div class="tab-offline-icon">📡</div><div class="tab-offline-text">Не вдалося завантажити матч</div></div>`;
    }
  }
}

function renderMatchPage(m) {
  document.getElementById('m-page-title').textContent = mMatchTitle(m);
  const body = document.getElementById('m-page-body');
  body.innerHTML = buildMatchDetailBody(m);
  wireMatchPageActions(body, m);
}

function closeMatchPage() {
  mPageId = null;
  mSetEditor = null;
  document.getElementById('m-page').classList.remove('t-page-visible');
  if (tg && currentTab === 'home') tg.BackButton.hide();
}

/** Re-render the open detail page after matchesData was refetched. */
function refreshOpenMatchPage() {
  if (!mPageId) return;
  const m = (matchesData || []).find(x => String(x.id) === String(mPageId));
  if (m) renderMatchPage(m);
}

document.getElementById('m-page-back')?.addEventListener('click', closeMatchPage);

/* ── Detail body builders ────────────────────────────────────────── */

function mRosterRow(u, opts) {
  const avatar = avatarHtml({ name: playerNameOf(u), photoUrl: u.photoUrl }, 'sm');
  const pts = u.ratingPoints != null ? `<span class="m-roster-pts">${u.ratingPoints}</span>` : '';
  let actions = '';
  if (opts.showPromote)  actions += `<button type="button" class="m-roster-act m-act-promote" data-uid="${u.id}" aria-label="До складу">↑</button>`;
  if (opts.showWaitlist) actions += `<button type="button" class="m-roster-act m-act-waitlist" data-uid="${u.id}" aria-label="У чергу">↓</button>`;
  if (opts.showRemove)   actions += `<button type="button" class="m-roster-act m-act-remove" data-uid="${u.id}" aria-label="Прибрати">✕</button>`;
  return `
    <div class="m-roster-row">
      <div class="lb-avatar">${avatar}</div>
      <div class="m-roster-name">${esc(playerNameOf(u))}</div>
      ${pts}
      ${actions ? `<div class="m-roster-actions">${actions}</div>` : ''}
    </div>`;
}

function buildRosterSection(m) {
  const active = m.activePlayers || [];
  const waitlist = m.waitlist || [];
  const canManage = !!m.canManageRoster;
  const activeFull = active.length >= 4;

  const activeRows = active.map(ap => mRosterRow(ap.user, {
    showWaitlist: canManage,
    showRemove: canManage,
  })).join('') || `<div class="m-roster-empty">Ще ніхто не приєднався</div>`;

  let html = `
    <div class="m-section-title">Склад (${active.length}/4)</div>
    <div class="m-roster-list">${activeRows}</div>`;

  if (waitlist.length || canManage) {
    const waitlistRows = waitlist.map(wp => mRosterRow(wp.user, {
      showPromote: canManage && !activeFull,
      showRemove: canManage,
    })).join('') || `<div class="m-roster-empty">Черга порожня</div>`;
    html += `
      <div class="m-section-title">Черга${waitlist.length ? ` (${waitlist.length})` : ''}</div>
      <div class="m-roster-list">${waitlistRows}</div>`;
  }

  if (canManage) {
    // Creator invites (lands ACTIVE if a slot is free, else WAITLIST); admin adds straight
    // to ACTIVE. Same picker, the backend decides where the player lands.
    const label = currentUser?.role === 'ADMIN' ? 'Додати гравця' : 'Запросити гравця';
    html += `<button type="button" class="btn-secondary" id="m-invite-btn" style="width:100%;margin-top:8px">+ ${esc(label)}</button>`;
  }
  return html;
}

function buildJoinBlock(m) {
  if (!m.canJoin) return '';
  return `<button type="button" class="btn-primary" id="m-join-btn" style="width:100%;margin-bottom:14px">Приєднатися</button>`;
}

function buildApproveBlock(m) {
  if (m.status !== 'PENDING_APPROVAL') return '';
  const submitter = m.scoreSubmittedBy ? playerNameOf(m.scoreSubmittedBy) : '';
  if (m.canApprove) {
    return `<div class="m-approve-banner">
      <div class="m-approve-text">Рахунок внесено${submitter ? ` (${esc(submitter)})` : ''}. Підтвердьте результат, щоб зарахувати матч.</div>
      <button type="button" class="btn-primary" id="m-approve-btn" style="width:100%;margin-top:8px">✓ Підтвердити рахунок</button>
    </div>`;
  }
  return `<div class="cup-bracket-note">Рахунок${submitter ? ` від ${esc(submitter)}` : ''} очікує підтвердження від суперників.</div>`;
}

function buildSetsReadOnly(m) {
  const sets = m.sets || [];
  if (!sets.length) return `<div class="m-roster-empty">Рахунок ще не внесено</div>`;
  return sets.map(s => {
    const hasTb = s.tiebreakA != null;
    const tb = hasTb ? `<span class="cup-match-tb"> (${s.tiebreakA}:${s.tiebreakB})</span>` : '';
    return `<div class="cup-match-row cup-match-played">
      <span class="cup-match-team">${esc(playerNameOf(s.a1))} / ${esc(playerNameOf(s.a2))}</span>
      <span class="cup-match-score">${s.gamesA}:${s.gamesB}${tb}</span>
      <span class="cup-match-team cup-match-team-right">${esc(playerNameOf(s.b1))} / ${esc(playerNameOf(s.b2))}</span>
    </div>`;
  }).join('');
}

function buildMatchDetailBody(m) {
  const stLabel = M_STATUS_LABEL[m.status] || m.status;
  const stCls   = M_STATUS_CLS[m.status] || 't-status-done';
  const creatorName = m.createdBy ? playerNameOf(m.createdBy) : '';
  const canCancel = m.canManageRoster && (m.status === 'OPEN' || m.status === 'PENDING_APPROVAL');
  // Any participant who isn't the creator can leave (the creator cancels instead) —
  // only meaningful while the match hasn't already finished/been cancelled.
  const canLeave = !!currentUser
    && (m.myState === 'ACTIVE' || m.myState === 'WAITLIST')
    && m.createdBy?.id !== currentUser.id
    && m.status !== 'FINISHED' && m.status !== 'CANCELLED';

  return `
    <div class="m-page-badges">
      <span class="${stCls}">${stLabel}</span>
      <span class="m-badge ${m.ratingEnabled ? 'm-badge-rating' : 'm-badge-friendly'}">${m.ratingEnabled ? '⚡ Рейтинговий' : '🎾 Дружній'}</span>
    </div>
    <div class="t-organizer" style="margin:6px 0 14px">Створив ${esc(creatorName)} · ${fmt(m.createdAt)}</div>

    ${buildApproveBlock(m)}
    ${buildJoinBlock(m)}

    ${buildRosterSection(m)}

    <div class="m-section-title">Рахунок</div>
    ${m.canSubmitScore ? buildSetEditorHtml(m) : buildSetsReadOnly(m)}

    ${(m.status === 'FINISHED' && m.ratingEnabled && m.finalizedAvgRating != null)
      ? `<div class="cup-bracket-note" style="margin-top:10px">Середній рейтинг матчу на момент завершення: ${m.finalizedAvgRating}</div>` : ''}

    ${canCancel ? `<button type="button" class="t-admin-btn t-admin-delete-btn" id="m-cancel-btn" style="width:100%;margin-top:16px">Скасувати матч</button>` : ''}
    ${canLeave ? `<div style="display:flex;justify-content:center;margin-top:14px">
      <button type="button" class="chip-btn chip-leave" id="m-leave-btn">Вийти з матчу</button>
    </div>` : ''}
  `;
}

/* ── Set editor (team picker + game score) ───────────────────────── */

function mDefaultSet(m) {
  const ids = (m.activePlayers || []).map(p => p.user.id);
  return { teamA: [ids[0], ids[1]], teamB: [ids[2], ids[3]], gamesA: '', gamesB: '', tbA: '', tbB: '' };
}

function mEnsureSetEditor(m) {
  const activeIds = (m.activePlayers || []).map(p => p.user.id).slice().sort((a, b) => a - b).join(',');
  if (mSetEditor && mSetEditor._rosterKey === activeIds) return;
  const sets = (m.sets && m.sets.length)
    ? m.sets.map(s => ({
        teamA: [s.a1.id, s.a2.id],
        teamB: [s.b1.id, s.b2.id],
        gamesA: s.gamesA, gamesB: s.gamesB,
        tbA: s.tiebreakA ?? '', tbB: s.tiebreakB ?? '',
      }))
    : [mDefaultSet(m)];
  mSetEditor = { _rosterKey: activeIds, sets, sel: null };
}

function mNeedsTb(s) {
  const a = parseInt(s.gamesA, 10), b = parseInt(s.gamesB, 10);
  return (a === 7 && b === 6) || (a === 6 && b === 7);
}

/** Mirrors the cup score rules: winner has 6 or 7 games; 7 only vs 5 or 6. */
function validateSetGames(a, b) {
  if (isNaN(a) || isNaN(b)) return 'введіть рахунок сету';
  if (a === b) return 'рахунок не може бути рівним';
  const hi = Math.max(a, b), lo = Math.min(a, b);
  if (hi === 6) {
    if (lo > 4) return 'при 6 геймах потрібна перевага ≥2 (або 7:5)';
  } else if (hi === 7) {
    if (lo !== 5 && lo !== 6) return 'при 7 геймах суперник має мати 5 або 6';
  } else {
    return 'переможець сету повинен мати 6 або 7 геймів';
  }
  return null;
}

function mPlayerById(m, id) {
  const all = [...(m.activePlayers || []).map(x => x.user), ...(m.waitlist || []).map(x => x.user)];
  return all.find(u => String(u.id) === String(id));
}

function mChip(m, id, setIdx) {
  const u = mPlayerById(m, id);
  const name = u ? playerNameOf(u) : '?';
  const isSel = mSetEditor.sel && mSetEditor.sel.setIdx === setIdx && mSetEditor.sel.id === id;
  return `<button type="button" class="mse-chip${isSel ? ' mse-chip-sel' : ''}" data-set="${setIdx}" data-id="${id}">
    <span class="mse-chip-name">${esc(name)}</span>
  </button>`;
}

function buildSetEditorHtml(m) {
  const activeIds = (m.activePlayers || []).map(p => p.user.id);
  if (activeIds.length !== 4) {
    return `<div class="cup-bracket-note">Потрібно рівно 4 активних гравці, щоб внести рахунок сетів.</div>`;
  }
  mEnsureSetEditor(m);

  let html = mSetEditor.sets.map((s, i) => `
    <div class="mse-set rs-match">
      <div class="rs-match-title">Сет ${i + 1}${mSetEditor.sets.length > 1 ? `<button type="button" class="mse-remove-set" data-set="${i}">✕</button>` : ''}</div>
      <div class="mse-teams">
        <div class="mse-team">${s.teamA.map(id => mChip(m, id, i)).join('')}</div>
        <span class="rs-vs">vs</span>
        <div class="mse-team">${s.teamB.map(id => mChip(m, id, i)).join('')}</div>
      </div>
      <div class="mse-score-row">
        <input class="form-input cup-score-input mse-games" type="number" min="0" max="7" inputmode="numeric" data-set="${i}" data-side="A" value="${s.gamesA}" placeholder="0">
        <span class="mse-score-sep">:</span>
        <input class="form-input cup-score-input mse-games" type="number" min="0" max="7" inputmode="numeric" data-set="${i}" data-side="B" value="${s.gamesB}" placeholder="0">
      </div>
      <div class="mse-tb-row" style="display:${mNeedsTb(s) ? '' : 'none'}">
        <input class="form-input cup-score-input cup-tb-input mse-tb" type="number" min="0" max="20" inputmode="numeric" data-set="${i}" data-side="A" value="${s.tbA}" placeholder="0">
        <span class="mse-score-sep">:</span>
        <input class="form-input cup-score-input cup-tb-input mse-tb" type="number" min="0" max="20" inputmode="numeric" data-set="${i}" data-side="B" value="${s.tbB}" placeholder="0">
      </div>
    </div>`).join('');

  html += `<button type="button" class="btn-secondary" id="mse-add-set" style="width:100%;margin:2px 0 10px">+ Додати сет</button>`;
  html += `<button type="button" class="btn-primary" id="mse-submit" style="width:100%">Зберегти рахунок</button>`;
  return html;
}

function mChipClick(setIdx, id) {
  const sel = mSetEditor.sel;
  if (!sel) { mSetEditor.sel = { setIdx, id }; return; }
  if (sel.setIdx === setIdx && sel.id === id) { mSetEditor.sel = null; return; }
  if (sel.setIdx !== setIdx) { mSetEditor.sel = { setIdx, id }; return; }
  const s = mSetEditor.sets[setIdx];
  const slotOf = pid => s.teamA.includes(pid) ? s.teamA : s.teamB;
  const arrSel = slotOf(sel.id);
  const arrCur = slotOf(id);
  const iSel = arrSel.indexOf(sel.id);
  const iCur = arrCur.indexOf(id);
  arrSel[iSel] = id;
  arrCur[iCur] = sel.id;
  mSetEditor.sel = null;
}

/* ── Wiring ───────────────────────────────────────────────────────── */

function wireMatchPageActions(container, m) {
  container.querySelector('#m-join-btn')?.addEventListener('click', async () => {
    try {
      const fresh = await API.matches.join(m.id);
      mCacheUpdate(fresh);
      renderMatchPage(fresh);
      renderMatches();
      showToast('Ви приєдналися до матчу 🎾', 'success');
    } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
  });

  container.querySelectorAll('.m-act-promote').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const fresh = await API.matches.promote(m.id, parseInt(btn.dataset.uid, 10));
        mCacheUpdate(fresh); renderMatchPage(fresh); renderMatches();
      } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
    });
  });

  container.querySelectorAll('.m-act-waitlist').forEach(btn => {
    btn.addEventListener('click', async () => {
      try {
        const fresh = await API.matches.waitlist(m.id, parseInt(btn.dataset.uid, 10));
        mCacheUpdate(fresh); renderMatchPage(fresh); renderMatches();
      } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
    });
  });

  container.querySelectorAll('.m-act-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Прибрати гравця з матчу?'))) return;
      try {
        const fresh = await API.matches.removePlayer(m.id, parseInt(btn.dataset.uid, 10));
        mCacheUpdate(fresh); renderMatchPage(fresh); renderMatches();
      } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
    });
  });

  container.querySelector('#m-approve-btn')?.addEventListener('click', async (ev) => {
    if (!(await uiConfirm('Підтвердити рахунок матчу? Це завершить матч.'))) return;
    // Guard against a double-tap applying the rating twice (backend also has an optimistic lock)
    const btn = ev.currentTarget;
    if (btn.disabled) return;
    btn.disabled = true;
    try {
      const fresh = await API.matches.approve(m.id);
      mCacheUpdate(fresh); renderMatchPage(fresh); renderMatches();
      showToast('Рахунок підтверджено ✓', 'success');
    } catch (e) {
      btn.disabled = false;
      showToast(e.data?.message || e.message || 'Помилка', 'error');
    }
  });

  container.querySelector('#m-cancel-btn')?.addEventListener('click', async () => {
    if (!(await uiConfirm('Скасувати цей матч?'))) return;
    try {
      await API.matches.cancel(m.id);
      showToast('Матч скасовано', 'info');
      closeMatchPage();
      matchesData = null;
      renderMatches();
    } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
  });

  container.querySelector('#m-invite-btn')?.addEventListener('click', () => openMatchAddPicker(m));

  container.querySelector('#m-leave-btn')?.addEventListener('click', async () => {
    if (!(await uiConfirm('Вийти з цього матчу?'))) return;
    try {
      await API.matches.leave(m.id);
      showToast('Ви вийшли з матчу', 'info');
      closeMatchPage();
      matchesData = null;
      renderMatches();
    } catch (e) { showToast(e.data?.message || e.message || 'Помилка', 'error'); }
  });

  // ── Set editor ──
  container.querySelectorAll('.mse-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      mChipClick(parseInt(chip.dataset.set, 10), parseInt(chip.dataset.id, 10));
      renderMatchPage(m);
    });
  });

  container.querySelectorAll('.mse-games').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.set, 10);
      const s = mSetEditor.sets[i];
      const val = inp.value === '' ? '' : parseInt(inp.value, 10);
      if (inp.dataset.side === 'A') s.gamesA = val; else s.gamesB = val;
      const setEl = inp.closest('.mse-set');
      const tbRow = setEl?.querySelector('.mse-tb-row');
      if (!tbRow) return;
      const needsTb = mNeedsTb(s);
      tbRow.style.display = needsTb ? '' : 'none';
      if (!needsTb) { s.tbA = ''; s.tbB = ''; }
    });
  });

  container.querySelectorAll('.mse-tb').forEach(inp => {
    inp.addEventListener('input', () => {
      const i = parseInt(inp.dataset.set, 10);
      const s = mSetEditor.sets[i];
      const val = inp.value === '' ? '' : parseInt(inp.value, 10);
      if (inp.dataset.side === 'A') s.tbA = val; else s.tbB = val;
    });
  });

  container.querySelector('#mse-add-set')?.addEventListener('click', () => {
    mSetEditor.sets.push(mDefaultSet(m));
    renderMatchPage(m);
  });

  container.querySelectorAll('.mse-remove-set').forEach(btn => {
    btn.addEventListener('click', () => {
      mSetEditor.sets.splice(parseInt(btn.dataset.set, 10), 1);
      renderMatchPage(m);
    });
  });

  container.querySelector('#mse-submit')?.addEventListener('click', async () => {
    const btn = container.querySelector('#mse-submit');
    const sets = mSetEditor.sets;
    if (!sets.length) { showToast('Додайте хоча б один сет', 'error'); return; }

    const payload = [];
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i];
      const all = [...s.teamA, ...s.teamB];
      if (new Set(all).size !== 4 || all.some(id => id == null)) {
        showToast(`Сет ${i + 1}: у складі мають бути 4 різні гравці`, 'error'); return;
      }
      const gamesA = parseInt(s.gamesA, 10), gamesB = parseInt(s.gamesB, 10);
      const err = validateSetGames(gamesA, gamesB);
      if (err) { showToast(`Сет ${i + 1}: ${err}`, 'error'); return; }

      const needsTb = mNeedsTb(s);
      const entry = { a1: s.teamA[0], a2: s.teamA[1], b1: s.teamB[0], b2: s.teamB[1], gamesA, gamesB };
      if (needsTb) {
        const tbA = parseInt(s.tbA, 10), tbB = parseInt(s.tbB, 10);
        if (isNaN(tbA) || isNaN(tbB)) { showToast(`Сет ${i + 1}: введіть рахунок тай-брейку`, 'error'); return; }
        const hi = Math.max(tbA, tbB), lo = Math.min(tbA, tbB);
        if (hi < 7) { showToast(`Сет ${i + 1}: тай-брейк — переможець має набрати ≥7`, 'error'); return; }
        if (hi - lo < 2) { showToast(`Сет ${i + 1}: тай-брейк — перевага має бути ≥2`, 'error'); return; }
        const setWinA = gamesA > gamesB, tbWinA = tbA > tbB;
        if (setWinA !== tbWinA) { showToast(`Сет ${i + 1}: переможець тай-брейку має збігатися з переможцем сету`, 'error'); return; }
        entry.tiebreakA = tbA; entry.tiebreakB = tbB;
      }
      payload.push(entry);
    }

    btn.disabled = true;
    try {
      const fresh = await API.matches.submitSets(m.id, { sets: payload });
      mCacheUpdate(fresh);
      mSetEditor = null;
      renderMatchPage(fresh);
      renderMatches();
      showToast('Рахунок збережено ✓', 'success');
    } catch (e) {
      showToast(e.data?.message || e.message || 'Помилка', 'error');
    } finally {
      btn.disabled = false;
    }
  });
}

/* ── Create-match wizards: Announce (US 1) + Record (Phase 3) ───────
   Two separate flows sharing: rating-type chips, a Day/Time→scheduledAt
   converter, the locations cache, level chips and a companion/partner
   picker modal (#modal-match-picker). ─────────────────────────────── */

let mLocationsCache = null; // API.locations.list() cache, shared by both wizards
async function mGetLocations() {
  if (mLocationsCache) return mLocationsCache;
  try { mLocationsCache = await API.locations.list(); } catch { mLocationsCache = []; }
  return mLocationsCache;
}

const MATCH_LEVELS = [
  { key: 'D',        label: 'D'  },
  { key: 'D_PLUS',    label: 'D+' },
  { key: 'C_MINUS',   label: 'C−' },
  { key: 'C',         label: 'C'  },
  { key: 'C_PLUS',    label: 'C+' },
  { key: 'B_MINUS',   label: 'B−' },
];

const UK_WEEKDAY_ABBR = ['Нд','Пн','Вт','Ср','Чт','Пт','Сб'];

// Next 7 days (today first), labelled «Сьогодні»/«Завтра»/«Пн 28.07».
function mDayOptions() {
  const now = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const label = i === 0 ? 'Сьогодні' : i === 1 ? 'Завтра'
      : `${UK_WEEKDAY_ABBR[d.getDay()]} ${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`;
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    return { value, label };
  });
}

// 00:00–23:00, step 1h.
function mTimeOptions() {
  return Array.from({ length: 24 }, (_, h) => {
    const v = String(h).padStart(2, '0') + ':00';
    return { value: v, label: v };
  });
}

// Day (YYYY-MM-DD) + Time (HH:mm) are read as the player's own local wall-clock
// time — `new Date(y,m,d,h,min)` builds that instant in the *device's* timezone,
// then .toISOString() converts to UTC. Correct as long as the phone's timezone
// matches the player's (true for a Telegram Mini App opened on one's own phone
// in Odesa).
function mScheduledAtIso(dayValue, timeValue) {
  if (!dayValue || !timeValue) return null;
  const [y, mo, d] = dayValue.split('-').map(Number);
  const [hh, mm] = timeValue.split(':').map(Number);
  return new Date(y, mo - 1, d, hh, mm, 0, 0).toISOString();
}

function mLevelChipHtml(lvl, on) {
  const cls = on ? `mw-level-chip mw-level-chip-on level-badge level-badge-lg ${levelClass(lvl.label)}` : 'mw-level-chip';
  return `<button type="button" class="${cls}" data-level="${lvl.key}">${lvl.label}</button>`;
}

function mRenderLevelChips(containerId, selectedSet) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = MATCH_LEVELS.map(lvl => mLevelChipHtml(lvl, selectedSet.has(lvl.key))).join('');
  el.querySelectorAll('.mw-level-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.level;
      if (selectedSet.has(key)) selectedSet.delete(key); else selectedSet.add(key);
      mRenderLevelChips(containerId, selectedSet);
    });
  });
}

function mWizardChipHtml(u) {
  return `<span class="mw-chip" data-uid="${u.id}">
    <span class="mw-chip-av">${avatarHtml({ name: playerNameOf(u), photoUrl: u.photoUrl }, 'sm')}</span>
    <span class="mw-chip-name">${esc(playerNameOf(u))}</span>
    <button type="button" class="mw-chip-x" data-uid="${u.id}" aria-label="Прибрати">✕</button>
  </span>`;
}

function mRenderChosenChips(containerId, list, onRemove) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = list.map(mWizardChipHtml).join('');
  el.querySelectorAll('.mw-chip-x').forEach(btn => {
    btn.addEventListener('click', () => onRemove(btn.dataset.uid));
  });
}

/* ── Shared companion/partner picker (mirrors renderMatchPicker but has
   no match yet to attach into — the caller decides what to do on pick). ── */
let mwPickerState = null; // { excludeIds: Set<string>, onPick(user) }

function openMatchWizardPicker(title, excludeIds, onPick) {
  mwPickerState = { excludeIds, onPick };
  document.getElementById('mwp-title').textContent = title;
  document.getElementById('mwp-search').value = '';
  const listEl = document.getElementById('mwp-list');
  listEl.innerHTML = '<div class="am-empty">Завантаження...</div>';
  openModal('modal-match-picker');
  (async () => {
    try {
      if (!mDirectory) mDirectory = await API.users.directory();
      mRenderWizardPicker('');
    } catch (e) {
      listEl.innerHTML = `<div class="am-empty">Помилка: ${esc(e.message)}</div>`;
    }
  })();
}

function mRenderWizardPicker(query) {
  const listEl = document.getElementById('mwp-list');
  if (!mwPickerState) return;
  const q = query.trim().toLowerCase();
  const rows = (mDirectory || [])
    .filter(u => !mwPickerState.excludeIds.has(String(u.id)))
    .filter(u => !q || (u.displayName || '').toLowerCase().includes(q))
    .slice(0, 30);
  listEl.innerHTML = rows.length
    ? rows.map(u => `
        <div class="am-picker-row" data-uid="${u.id}">
          <span class="am-picker-av">${avatarHtml({ name: u.displayName, photoUrl: u.photoUrl }, 'sm')}</span>
          <span class="am-picker-name">${esc(u.displayName || '?')}</span>
          <span class="am-picker-pts">${u.ratingPoints || 0} pts</span>
        </div>`).join('')
    : '<div class="am-empty">Нікого не знайдено</div>';

  listEl.querySelectorAll('.am-picker-row').forEach(row => {
    row.addEventListener('click', () => {
      const u = (mDirectory || []).find(x => String(x.id) === row.dataset.uid);
      if (!u || !mwPickerState) return;
      const { onPick } = mwPickerState;
      closeModal('modal-match-picker');
      mwPickerState = null;
      onPick(u);
    });
  });
}

document.getElementById('mwp-search')?.addEventListener('input', e => mRenderWizardPicker(e.target.value));

/* ── Announce wizard ─────────────────────────────────────────────── */

let mAnnounceCompanions = [];
let mAnnounceLevels = new Set();

function mAnnounceNeeded() {
  const slots = parseInt(document.getElementById('cm-slots').value, 10);
  return 3 - slots;
}

function mAnnounceRemoveCompanion(uid) {
  mAnnounceCompanions = mAnnounceCompanions.filter(u => String(u.id) !== uid);
  mUpdateCompanionUi();
}

function mUpdateCompanionUi() {
  const needed = mAnnounceNeeded();
  const group = document.getElementById('cm-companions-group');
  const label = document.getElementById('cm-companions-label');
  if (needed === 0) {
    group.style.display = 'none';
    mAnnounceCompanions = [];
  } else {
    group.style.display = '';
    label.textContent = needed === 1 ? 'Напарник' : `Напарники (${needed})`;
    if (mAnnounceCompanions.length > needed) mAnnounceCompanions = mAnnounceCompanions.slice(0, needed);
  }
  mRenderChosenChips('cm-companions-chips', mAnnounceCompanions, mAnnounceRemoveCompanion);
  const addBtn = document.getElementById('cm-companions-add');
  if (addBtn) addBtn.style.display = mAnnounceCompanions.length >= needed ? 'none' : '';
}

document.getElementById('cm-slots')?.addEventListener('change', mUpdateCompanionUi);

document.getElementById('cm-companions-add')?.addEventListener('click', () => {
  const needed = mAnnounceNeeded();
  if (mAnnounceCompanions.length >= needed) return;
  const exclude = new Set([String(currentUser?.id), ...mAnnounceCompanions.map(u => String(u.id))]);
  openMatchWizardPicker(needed === 1 ? 'Обрати напарника' : 'Обрати напарника', exclude, u => {
    mAnnounceCompanions.push(u);
    mUpdateCompanionUi();
  });
});

document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

async function openAnnounceMatchModal() {
  mAnnounceCompanions = [];
  mAnnounceLevels = new Set();

  document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'true');
  });

  const daySel = document.getElementById('cm-day');
  daySel.innerHTML = mDayOptions().map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
  const timeSel = document.getElementById('cm-time');
  timeSel.innerHTML = mTimeOptions().map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  timeSel.value = '18:00';

  document.getElementById('cm-slots').value = '2';
  mUpdateCompanionUi();
  mRenderLevelChips('cm-levels', mAnnounceLevels);

  const locSel = document.getElementById('cm-location');
  locSel.innerHTML = '<option value="">Завантаження…</option>';

  openModal('modal-create-match');

  const locs = await mGetLocations();
  locSel.innerHTML = locs.length
    ? locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('')
    : '<option value="">Немає доступних локацій</option>';
}

document.getElementById('cm-submit')?.addEventListener('click', async () => {
  const btn = document.getElementById('cm-submit');
  const activeChip = document.querySelector('#cm-rating-toggle .claim-chip.active');
  const ratingEnabled = activeChip ? activeChip.dataset.val === 'true' : true;
  const day = document.getElementById('cm-day').value;
  const time = document.getElementById('cm-time').value;
  const locationId = document.getElementById('cm-location').value;
  const slotsNeeded = parseInt(document.getElementById('cm-slots').value, 10);
  const needed = mAnnounceNeeded();

  if (!day || !time) { showToast('Оберіть день і час', 'error'); return; }
  if (!locationId) { showToast('Оберіть локацію', 'error'); return; }
  if (mAnnounceCompanions.length !== needed) {
    showToast(`Оберіть ${needed} ${needed === 1 ? 'напарника' : 'напарники'}`, 'error');
    return;
  }

  const payload = {
    ratingEnabled,
    scheduledAt: mScheduledAtIso(day, time),
    locationId: parseInt(locationId, 10),
    slotsNeeded,
    desiredLevels: Array.from(mAnnounceLevels),
    companionUserIds: mAnnounceCompanions.map(u => u.id),
    mode: 'ANNOUNCE',
  };

  btn.disabled = true;
  try {
    const created = await API.matches.create(payload);
    mCacheUpdate(created);
    closeModal('modal-create-match');
    showToast('Гру анонсовано 📣', 'success');
    if (currentTab !== 'matches') switchTab('matches');
    renderMatches();
    openMatchPage(created.id);
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка створення матчу', 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ── Record wizard ───────────────────────────────────────────────── */

let mRecordPartners = [];

function mRecordRemovePartner(uid) {
  mRecordPartners = mRecordPartners.filter(u => String(u.id) !== uid);
  mRenderChosenChips('rm-partners-chips', mRecordPartners, mRecordRemovePartner);
  const addBtn = document.getElementById('rm-partners-add');
  if (addBtn) addBtn.style.display = mRecordPartners.length >= 3 ? 'none' : '';
}

document.getElementById('rm-partners-add')?.addEventListener('click', () => {
  if (mRecordPartners.length >= 3) return;
  const exclude = new Set([String(currentUser?.id), ...mRecordPartners.map(u => String(u.id))]);
  openMatchWizardPicker('Обрати партнера', exclude, u => {
    mRecordPartners.push(u);
    mRenderChosenChips('rm-partners-chips', mRecordPartners, mRecordRemovePartner);
    document.getElementById('rm-partners-add').style.display = mRecordPartners.length >= 3 ? 'none' : '';
  });
});

document.querySelectorAll('#rm-rating-toggle .claim-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#rm-rating-toggle .claim-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('rm-when-toggle')?.addEventListener('click', () => {
  const body = document.getElementById('rm-when-body');
  const opening = body.style.display === 'none';
  body.style.display = opening ? '' : 'none';
  document.getElementById('rm-when-chevron').textContent = opening ? '▴' : '▾';
});

function openRecordMatchModal() {
  mRecordPartners = [];

  document.querySelectorAll('#rm-rating-toggle .claim-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'true');
  });
  mRenderChosenChips('rm-partners-chips', mRecordPartners, mRecordRemovePartner);
  document.getElementById('rm-partners-add').style.display = '';

  document.getElementById('rm-when-body').style.display = 'none';
  document.getElementById('rm-when-chevron').textContent = '▾';

  const daySel = document.getElementById('rm-day');
  daySel.innerHTML = '<option value="">—</option>' + mDayOptions().map(o => `<option value="${o.value}">${esc(o.label)}</option>`).join('');
  const timeSel = document.getElementById('rm-time');
  timeSel.innerHTML = '<option value="">—</option>' + mTimeOptions().map(o => `<option value="${o.value}">${o.label}</option>`).join('');
  const locSel = document.getElementById('rm-location');
  locSel.innerHTML = '<option value="">—</option>';

  openModal('modal-record-match');

  mGetLocations().then(locs => {
    locSel.innerHTML = '<option value="">—</option>' + locs.map(l => `<option value="${l.id}">${esc(l.name)}</option>`).join('');
  });
}

document.getElementById('rm-submit')?.addEventListener('click', async () => {
  const btn = document.getElementById('rm-submit');
  const activeChip = document.querySelector('#rm-rating-toggle .claim-chip.active');
  const ratingEnabled = activeChip ? activeChip.dataset.val === 'true' : true;

  if (mRecordPartners.length !== 3) {
    showToast('Оберіть рівно 3 партнерів', 'error');
    return;
  }

  const day = document.getElementById('rm-day').value;
  const time = document.getElementById('rm-time').value;
  const locationId = document.getElementById('rm-location').value;

  const payload = {
    ratingEnabled,
    companionUserIds: mRecordPartners.map(u => u.id),
    mode: 'RECORD',
  };
  if (day && time) payload.scheduledAt = mScheduledAtIso(day, time);
  if (locationId) payload.locationId = parseInt(locationId, 10);

  btn.disabled = true;
  try {
    const created = await API.matches.create(payload);
    mCacheUpdate(created);
    closeModal('modal-record-match');
    showToast('Матч записано 🎾', 'success');
    if (currentTab !== 'matches') switchTab('matches');
    renderMatches();
    openMatchPage(created.id);
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка запису матчу', 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ── Add-player picker (roster management, mirrors the Americano add-picker) ── */

let mDirectory = null;        // cached /users/directory for the picker
let mAddPickerMatchId = null; // which match the picker is currently adding into

async function openMatchAddPicker(m) {
  mAddPickerMatchId = m.id;
  const titleEl = document.getElementById('mm-picker-title');
  if (titleEl) titleEl.textContent = currentUser?.role === 'ADMIN' ? 'Додати гравця' : 'Запросити гравця';
  const listEl = document.getElementById('mm-picker-list');
  listEl.innerHTML = '<div class="am-empty">Завантаження...</div>';
  document.getElementById('mm-picker-search').value = '';
  openModal('modal-match-add');
  try {
    if (!mDirectory) mDirectory = await API.users.directory();
    renderMatchPicker('');
  } catch (e) {
    listEl.innerHTML = `<div class="am-empty">Помилка: ${esc(e.message)}</div>`;
  }
}

function renderMatchPicker(query) {
  const listEl = document.getElementById('mm-picker-list');
  const m = (matchesData || []).find(x => String(x.id) === String(mAddPickerMatchId));
  const attached = new Set([...(m?.activePlayers || []), ...(m?.waitlist || [])].map(p => p.user.id));
  const q = query.trim().toLowerCase();
  const matches = (mDirectory || [])
    .filter(u => !attached.has(u.id))
    .filter(u => !q || (u.displayName || '').toLowerCase().includes(q))
    .slice(0, 30);
  listEl.innerHTML = matches.length
    ? matches.map(u => `
        <div class="am-picker-row" data-uid="${u.id}">
          <span class="am-picker-av">${avatarHtml({ name: u.displayName, photoUrl: u.photoUrl }, 'sm')}</span>
          <span class="am-picker-name">${esc(u.displayName || '?')}</span>
          <span class="am-picker-pts">${u.ratingPoints || 0} pts</span>
        </div>`).join('')
    : '<div class="am-empty">Нікого не знайдено</div>';

  listEl.querySelectorAll('.am-picker-row').forEach(row => {
    row.addEventListener('click', async () => {
      row.style.pointerEvents = 'none';
      try {
        const fresh = await API.matches.addPlayer(mAddPickerMatchId, row.dataset.uid);
        mCacheUpdate(fresh);
        closeModal('modal-match-add');
        showToast('Гравця додано 🎾', 'success');
        renderMatchPage(fresh);
        renderMatches();
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        row.style.pointerEvents = '';
      }
    });
  });
}

document.getElementById('mm-picker-search')?.addEventListener('input', e => renderMatchPicker(e.target.value));

/* ── Admin: Locations directory (list/create/edit/soft-delete) ──────
   Mirrors js/announcements.js's admin CRUD pattern. Wired from
   wireAdminPanel() in analysis-admin.js (Система → «Локації»). ──── */

let locationsAdminList = [];
let editingLocationId = null;

async function openAdminLocationsModal() {
  openModal('modal-admin-locations');
  await refreshLocationsAdminList();
}

async function refreshLocationsAdminList() {
  const list = document.getElementById('loc-admin-list');
  list.innerHTML = '<div style="color:var(--text-sec);font-size:13px;padding:12px 0">Завантаження...</div>';
  try {
    locationsAdminList = await API.locations.adminList();
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">Помилка: ${esc(e.message)}</div>`;
    return;
  }
  renderLocationsAdminList();
}

function renderLocationsAdminList() {
  const list = document.getElementById('loc-admin-list');
  if (!locationsAdminList.length) {
    list.innerHTML = '<div style="color:var(--text-sec);font-size:13px;padding:12px 0">Локацій ще немає</div>';
    return;
  }
  list.innerHTML = locationsAdminList.map(l => `
    <div class="ann-row" data-id="${l.id}">
      <div class="ann-row-placeholder">📍</div>
      <div class="ann-row-body">
        <div class="ann-row-title">${esc(l.name)}${l.active ? '' : ' (вимкнено)'}</div>
        ${l.address ? `<div class="ann-row-desc">${esc(l.address)}</div>` : ''}
      </div>
      <div class="ann-row-actions">
        <button class="ach-toggle-btn ${l.active ? 'on' : 'off'}" data-act="toggle">${l.active ? 'Увімк.' : 'Вимк.'}</button>
        <button class="ann-icon-btn" data-act="edit">✎</button>
        <button class="ann-icon-btn" data-act="delete">🗑</button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.ann-row').forEach(row => {
    const id = parseInt(row.dataset.id, 10);
    const l = locationsAdminList.find(x => x.id === id);
    row.querySelector('[data-act="toggle"]').addEventListener('click', () => toggleLocationActive(l));
    row.querySelector('[data-act="edit"]').addEventListener('click', () => openEditLocation(l));
    row.querySelector('[data-act="delete"]').addEventListener('click', () => deleteLocation(l));
  });
}

async function toggleLocationActive(l) {
  try {
    const updated = await API.locations.update(l.id, { name: l.name, address: l.address, active: !l.active, sortOrder: l.sortOrder });
    l.active = updated.active;
    renderLocationsAdminList();
    mLocationsCache = null; // invalidate the public list used by the wizards
  } catch (e) {
    showToast('Помилка: ' + (e.message || 'невідома'), 'error');
  }
}

async function deleteLocation(l) {
  if (!(await uiConfirm(`Видалити локацію «${l.name}»?`))) return;
  try {
    await API.locations.remove(l.id);
    locationsAdminList = locationsAdminList.filter(x => x.id !== l.id);
    renderLocationsAdminList();
    mLocationsCache = null;
  } catch (e) {
    showToast('Помилка видалення', 'error');
  }
}

function openCreateLocation() {
  editingLocationId = null;
  document.getElementById('loc-form-title').textContent = 'Нова локація';
  document.getElementById('loc-name').value = '';
  document.getElementById('loc-address').value = '';
  document.getElementById('loc-sort-order').value = '';
  document.getElementById('loc-active').checked = true;
  openModal('modal-location-form');
}

function openEditLocation(l) {
  editingLocationId = l.id;
  document.getElementById('loc-form-title').textContent = 'Редагувати локацію';
  document.getElementById('loc-name').value = l.name || '';
  document.getElementById('loc-address').value = l.address || '';
  document.getElementById('loc-sort-order').value = l.sortOrder ?? '';
  document.getElementById('loc-active').checked = l.active !== false;
  openModal('modal-location-form');
}

document.getElementById('loc-create-btn')?.addEventListener('click', openCreateLocation);

document.getElementById('loc-submit')?.addEventListener('click', async () => {
  const btn = document.getElementById('loc-submit');
  const name = document.getElementById('loc-name').value.trim();
  const address = document.getElementById('loc-address').value.trim() || null;
  const sortOrderRaw = document.getElementById('loc-sort-order').value;
  const sortOrder = sortOrderRaw === '' ? 0 : parseInt(sortOrderRaw, 10);
  const active = document.getElementById('loc-active').checked;

  if (!name) { showToast('Вкажіть назву локації', 'error'); return; }

  const payload = { name, address, active, sortOrder };
  btn.disabled = true;
  try {
    if (editingLocationId) {
      await API.locations.update(editingLocationId, payload);
    } else {
      await API.locations.create(payload);
    }
    closeModal('modal-location-form');
    showToast('Збережено', 'success');
    mLocationsCache = null;
    await refreshLocationsAdminList();
  } catch (e) {
    showToast('Помилка: ' + (e.message || 'невідома'), 'error');
  } finally {
    btn.disabled = false;
  }
});
