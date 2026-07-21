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

  const createRow = `
    <button class="t-create-row" onclick="openCreateMatchModal()">
      <span class="t-create-plus">＋</span>
      <span class="t-create-text">
        <strong>Створити матч</strong>
        <span>Товариська гра — збери гравців і внеси рахунок</span>
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

function buildMatchRow(m) {
  const stLabel = M_STATUS_LABEL[m.status] || m.status;
  const stCls   = M_STATUS_CLS[m.status] || 't-status-done';
  const activeN = (m.activePlayers || []).length;
  const waitN   = (m.waitlist || []).length;
  const meta = [
    `${activeN}/4 гравці`,
    waitN ? `${waitN} у черзі` : null,
    fmt(m.createdAt),
  ].filter(Boolean).join(' · ');
  const myTag = m.myState === 'ACTIVE'
    ? `<span class="t-row-state st-ok">У складі</span>`
    : m.myState === 'WAITLIST'
      ? `<span class="t-row-state st-wait">У черзі</span>`
      : '';
  return `
    <button class="t-row m-row" data-id="${m.id}">
      <div class="m-row-icon${m.ratingEnabled ? '' : ' m-row-icon-friendly'}">${m.ratingEnabled ? '⚡' : '🎾'}</div>
      <div class="t-row-main">
        <div class="t-row-name">${esc(mMatchTitle(m))}</div>
        <div class="t-row-meta">${esc(meta)}</div>
        <div class="t-row-tags">
          <span class="${stCls}">${stLabel}</span>
          <span class="m-badge ${m.ratingEnabled ? 'm-badge-rating' : 'm-badge-friendly'}">${m.ratingEnabled ? '⚡ Рейтинговий' : '🎾 Дружній'}</span>
          ${myTag}
        </div>
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

/* ── Create match sheet ──────────────────────────────────────────── */

function openCreateMatchModal() {
  const titleInp = document.getElementById('cm-title');
  if (titleInp) titleInp.value = '';
  document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(b => {
    b.classList.toggle('active', b.dataset.val === 'true');
  });
  openModal('modal-create-match');
}

document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#cm-rating-toggle .claim-chip').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

document.getElementById('cm-submit')?.addEventListener('click', async () => {
  const btn = document.getElementById('cm-submit');
  const title = (document.getElementById('cm-title')?.value || '').trim();
  const activeChip = document.querySelector('#cm-rating-toggle .claim-chip.active');
  const ratingEnabled = activeChip ? activeChip.dataset.val === 'true' : true;

  btn.disabled = true;
  try {
    const created = await API.matches.create({ title: title || null, ratingEnabled });
    mCacheUpdate(created);
    closeModal('modal-create-match');
    showToast('Матч створено 🎾', 'success');
    if (currentTab !== 'matches') switchTab('matches');
    renderMatches();
    openMatchPage(created.id);
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка створення матчу', 'error');
  } finally {
    btn.disabled = false;
  }
});
