/* ════════════════════════════════════════════════════════════════
   WINNER'S COURT — драбина кортів: переможці підіймаються, переможені
   опускаються; партнер попереднього раунду завжди стає суперником.
   Rounds are generated one at a time (each depends on the previous
   round's results) — the creation modal is shared with americano.js.
════════════════════════════════════════════════════════════════ */

let wcState = null;              // WinnersCourtDto from the backend
let wcTournamentId = null;
let wcDirectory = null;          // cached /users/directory for the add-picker

/* ── Detail modal: round history, current round, standings ───────── */

async function openWinnersCourtModal(tournamentId) {
  wcTournamentId = tournamentId;
  const body  = document.getElementById('wc-modal-body');
  const title = document.getElementById('wc-modal-title');
  const t = (tournamentsData || []).find(x => String(x.id) === String(tournamentId));
  title.textContent = t ? t.name : "Winner's Court";
  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Завантаження...</div>';
  openModal('modal-winners-court');
  try {
    wcState = await API.winnersCourt.get(tournamentId);
    renderWinnersCourtModal();
  } catch (e) {
    body.innerHTML = `<div style="color:var(--error);padding:20px;text-align:center">Помилка: ${esc(e.data?.message || e.message)}</div>`;
  }
}

function wcTeamNames(team) {
  return team.map(p => `<span class="tp-name-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${jsq(p.displayName || '?')}')">${esc(p.displayName || '?')}</span>`)
             .join('<span class="am-team-sep"> / </span>');
}

function renderWinnersCourtModal() {
  const st = wcState;
  if (!st) return;
  const body = document.getElementById('wc-modal-body');
  const t = (tournamentsData || []).find(x => String(x.id) === String(wcTournamentId));

  let html = '';

  // Config summary
  html += `<div class="am-config">
    ${st.friendly ? '<span class="friendly-badge">Дружній · без рейтингу</span>' : '<span class="friendly-badge fb-official">Офіційний · з рейтингом</span>'}
    ${st.isPrivate ? '<span class="friendly-badge fb-private">🔒 Приватний</span>' : ''}
    <span class="am-config-chip">🎯 ${st.pointsPerMatch} очок/матч</span>
    <span class="am-config-chip">🪜 раунд ${st.currentRound || 0}/${st.roundsCount}</span>
    <span class="am-config-chip">${st.resultEntryMode === 'ALL_PARTICIPANTS' ? '✍️ рахунок вносять всі' : '✍️ рахунок вносить організатор'}</span>
  </div>`;

  // DRAFT: roster management before the start
  if (st.status === 'DRAFT') {
    const parts = t ? [...(t.participants || []), ...(t.reserveParticipants || [])] : [];
    const max = t?.maxParticipants || 0;
    html += `<div class="cup-section-title">Учасники ${max ? `(${parts.length}/${max})` : `(${parts.length})`}</div>`;
    html += `<div class="am-participants">` + (parts.length
        ? parts.map(p => `
            <div class="am-part-row">
              <span class="tp-name-tap" onclick="_tournamentPlayerTap('${p.id}','${jsq(p.displayName || '?')}')">${esc(p.displayName || '?')}</span>
              ${st.canManage ? `<button class="am-part-remove" data-uid="${p.id}">✕</button>` : ''}
            </div>`).join('')
        : '<div class="am-empty">Поки нікого немає</div>') + `</div>`;

    if (st.canManage) {
      html += `<button class="btn-secondary" id="wc-add-participant-btn" style="width:100%;margin-top:8px">+ Додати учасника</button>`;
      const okCount = parts.length >= 4 && parts.length % 4 === 0;
      html += `<button class="btn-primary" id="wc-start-btn" style="width:100%;margin-top:8px" ${okCount ? '' : 'disabled'}>
        ▶ Запустити Winner's Court${okCount ? '' : ` (потрібна кількість гравців, кратна 4)`}
      </button>`;
    } else {
      html += `<div class="am-empty" style="margin-top:8px">Драбина з'явиться після старту</div>`;
    }
  }

  // Round history: earlier rounds read-only, the latest round is where scores get entered
  if (st.rounds && st.rounds.length) {
    const lastRoundNumber = st.rounds[st.rounds.length - 1].roundNumber;
    st.rounds.forEach(r => {
      const isCurrent = r.roundNumber === lastRoundNumber;
      html += `<div class="am-round${isCurrent ? '' : ' wc-round-history'}">
        <div class="am-round-title">${isCurrent ? `Раунд ${r.roundNumber} · поточний` : `Раунд ${r.roundNumber}`}</div>
        ${r.matches.map(m => {
          const canEnter = isCurrent && st.canEnterResults && st.status === 'ACTIVE';
          const score = m.played
              ? `<span class="am-score ${m.score1 > m.score2 ? 'am-score-a' : 'am-score-b'}">${m.score1}:${m.score2}</span>`
              : '<span class="am-score am-score-empty">—:—</span>';
          return `<div class="am-match-row">
            <span class="am-court">Корт ${m.court}</span>
            <div class="am-teams">
              <div class="am-team${m.played && m.score1 > m.score2 ? ' am-team-won' : ''}">${wcTeamNames(m.teamA)}</div>
              <div class="am-vs">проти</div>
              <div class="am-team${m.played && m.score2 > m.score1 ? ' am-team-won' : ''}">${wcTeamNames(m.teamB)}</div>
            </div>
            <div class="am-match-right">
              <span class="wc-ladder-pts">+${m.pointsPerWin}/перемога</span>
              ${score}
              ${canEnter ? `<button class="am-enter-btn" data-mid="${m.id}" data-s1="${m.score1 ?? ''}" data-s2="${m.score2 ?? ''}"
                  data-ta="${esc(m.teamA.map(p => p.displayName || '?').join(' / '))}"
                  data-tb="${esc(m.teamB.map(p => p.displayName || '?').join(' / '))}">${m.played ? '✎' : 'Внести'}</button>` : ''}
            </div>
          </div>`;
        }).join('')}
      </div>`;
    });
  }

  // Standings
  if (st.standings && st.standings.length) {
    const anyPlayed = st.standings.some(s => s.matchesPlayed > 0);
    html += `<div class="cup-section-title" style="margin-top:14px">Таблиця${anyPlayed ? '' : ' (матчі ще не зіграні)'}</div>`;
    html += `<div class="am-standings">
      <div class="am-st-head"><span></span><span>Гравець</span><span>В–П</span><span>Очки</span></div>
      ${st.standings.map(s => `
        <div class="am-st-row${currentUser && s.user.id === currentUser.id ? ' am-st-me' : ''}">
          <span class="am-st-pos pos-${s.position}">${s.position}</span>
          <span class="am-st-name tp-name-tap" onclick="_tournamentPlayerTap('${s.user.id}','${jsq(s.user.displayName || '?')}')">${esc(s.user.displayName || '?')}</span>
          <span class="am-st-wl">${s.wins}–${s.losses}</span>
          <span class="am-st-pts">${s.points}</span>
        </div>`).join('')}
    </div>`;
  }

  // Manager actions
  if (st.canManage && st.status === 'ACTIVE') {
    if (st.canAdvanceRound) {
      html += `<button class="btn-primary wc-advance-btn" id="wc-advance-btn">Наступний раунд ▶</button>`;
    } else if (!st.canFinalize && st.currentRound > 0) {
      html += `<div class="am-empty" style="margin-top:8px">Спочатку внесіть результати поточного раунду</div>`;
    }
    if (st.canFinalize) {
      html += `<button class="btn-primary wc-finalize-btn" id="wc-finalize-btn" style="background:linear-gradient(135deg,var(--success),#2a8a55)">
        ✓ ${st.friendly ? 'Завершити турнір' : 'Завершити та нарахувати рейтинг'}
      </button>`;
    }
  }

  body.innerHTML = html;

  // Wire score entry
  body.querySelectorAll('.am-enter-btn').forEach(btn => {
    btn.addEventListener('click', () => openWinnersCourtScoreModal(btn.dataset));
  });

  // Wire roster management
  body.querySelectorAll('.am-part-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Прибрати гравця з турніру?'))) return;
      btn.disabled = true;
      try {
        await API.winnersCourt.removeParticipant(wcTournamentId, btn.dataset.uid);
        await wcRefresh();
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        btn.disabled = false;
      }
    });
  });
  const addBtn = body.querySelector('#wc-add-participant-btn');
  if (addBtn) addBtn.addEventListener('click', openWinnersCourtAddPicker);

  // Wire start
  const startBtn = body.querySelector('#wc-start-btn');
  if (startBtn) startBtn.addEventListener('click', () => wcStart(startBtn));

  // Wire advance round
  const advanceBtn = body.querySelector('#wc-advance-btn');
  if (advanceBtn) advanceBtn.addEventListener('click', async () => {
    advanceBtn.disabled = true;
    try {
      wcState = await API.winnersCourt.advanceRound(wcTournamentId);
      renderWinnersCourtModal();
      showToast('Наступний раунд згенеровано! 🎾', 'success');
    } catch (e) {
      showToast(e.data?.message || e.message || 'Помилка', 'error');
      advanceBtn.disabled = false;
    }
  });

  // Wire finalize
  const finalizeBtn = body.querySelector('#wc-finalize-btn');
  if (finalizeBtn) finalizeBtn.addEventListener('click', async () => {
    const msg = wcState.friendly
        ? 'Завершити турнір? Результати буде зафіксовано (рейтинг не зміниться).'
        : 'Завершити турнір та нарахувати рейтинг?';
    if (!(await uiConfirm(msg))) return;
    finalizeBtn.disabled = true;
    try {
      wcState = await API.winnersCourt.finalize(wcTournamentId);
      tournamentsData = null;
      renderWinnersCourtModal();
      showToast(wcState.friendly ? 'Турнір завершено! 🎾' : 'Турнір завершено! Рейтинг нараховано 🏆', 'success');
    } catch (e) {
      showToast(e.data?.message || e.message || 'Помилка', 'error');
      finalizeBtn.disabled = false;
    }
  });
}

async function wcStart(btn) {
  btn.disabled = true;
  try {
    wcState = await API.winnersCourt.start(wcTournamentId);
    tournamentsData = null;
    renderResults();
    renderWinnersCourtModal();
    showToast('Раунд 1 згенеровано! 🎾', 'success');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
    btn.disabled = false;
  }
}

/** Refetch both the tournament list (roster) and the winners-court state, then re-render. */
async function wcRefresh() {
  tournamentsData = null;
  await renderResults();
  wcState = await API.winnersCourt.get(wcTournamentId);
  renderWinnersCourtModal();
}

/* ── Score entry modal ───────────────────────────────────────────── */

let wcScoreMatchId = null;

function openWinnersCourtScoreModal(ds) {
  wcScoreMatchId = ds.mid;
  const total = wcState.pointsPerMatch;
  document.getElementById('wc-score-teama').textContent = ds.ta;
  document.getElementById('wc-score-teamb').textContent = ds.tb;
  document.getElementById('wc-score-hint').textContent = `Сума очок має дорівнювати ${total}. Нічия неможлива.`;
  const in1 = document.getElementById('wc-score-1');
  const in2 = document.getElementById('wc-score-2');
  in1.max = total; in2.max = total;
  in1.value = ds.s1 || '';
  in2.value = ds.s2 || '';
  openModal('modal-winners-court-score');
  setTimeout(() => in1.focus(), 150);
}

// Auto-complete the second score: teams always split pointsPerMatch between them
document.getElementById('wc-score-1').addEventListener('input', () => {
  const total = wcState?.pointsPerMatch || 0;
  const v = parseInt(document.getElementById('wc-score-1').value, 10);
  if (!isNaN(v) && v >= 0 && v <= total) {
    document.getElementById('wc-score-2').value = total - v;
  }
});

document.getElementById('wc-score-submit').addEventListener('click', async () => {
  const s1 = parseInt(document.getElementById('wc-score-1').value, 10);
  const s2 = parseInt(document.getElementById('wc-score-2').value, 10);
  const total = wcState?.pointsPerMatch || 0;
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 + s2 !== total) {
    showToast(`Сума очок має дорівнювати ${total}`, 'error');
    return;
  }
  if (s1 === s2) {
    showToast('Нічия неможлива — потрібен переможець', 'error');
    return;
  }
  const btn = document.getElementById('wc-score-submit');
  btn.disabled = true;
  try {
    wcState = await API.winnersCourt.submitMatch(wcTournamentId, wcScoreMatchId, { score1: s1, score2: s2 });
    closeModal('modal-winners-court-score');
    renderWinnersCourtModal();
    showToast('Рахунок збережено', 'success');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ── Add-participant picker (creator-managed roster) ─────────────── */

async function openWinnersCourtAddPicker() {
  const listEl = document.getElementById('wc-picker-list');
  listEl.innerHTML = '<div class="am-empty">Завантаження...</div>';
  document.getElementById('wc-picker-search').value = '';
  openModal('modal-winners-court-add');
  try {
    if (!wcDirectory) wcDirectory = await API.users.directory();
    renderWinnersCourtPicker('');
  } catch (e) {
    listEl.innerHTML = `<div class="am-empty">Помилка: ${esc(e.message)}</div>`;
  }
}

function renderWinnersCourtPicker(query) {
  const listEl = document.getElementById('wc-picker-list');
  const t = (tournamentsData || []).find(x => String(x.id) === String(wcTournamentId));
  const enrolled = new Set([...(t?.participants || []), ...(t?.reserveParticipants || [])].map(p => p.id));
  const q = query.trim().toLowerCase();
  const matches = (wcDirectory || [])
      .filter(u => !enrolled.has(u.id))
      .filter(u => !q || (u.displayName || '').toLowerCase().includes(q))
      .slice(0, 30);
  listEl.innerHTML = matches.length
      ? matches.map(u => `
          <div class="am-picker-row" data-uid="${u.id}">
            <span>${esc(u.displayName || '?')}</span>
            <span class="am-picker-pts">${u.ratingPoints || 0} pts</span>
          </div>`).join('')
      : '<div class="am-empty">Нікого не знайдено</div>';

  listEl.querySelectorAll('.am-picker-row').forEach(row => {
    row.addEventListener('click', async () => {
      row.style.pointerEvents = 'none';
      try {
        await API.winnersCourt.addParticipant(wcTournamentId, row.dataset.uid);
        closeModal('modal-winners-court-add');
        showToast('Гравця додано', 'success');
        await wcRefresh();
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        row.style.pointerEvents = '';
      }
    });
  });
}

document.getElementById('wc-picker-search').addEventListener('input', e => renderWinnersCourtPicker(e.target.value));
