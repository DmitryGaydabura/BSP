/* ════════════════════════════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════════════════════════════ */

const TABS = {
  results:  'tab-results',
  ratings:  'tab-ratings',
  profile:  'tab-profile',
  activity: 'tab-activity',
};
let currentTab = 'ratings';
let rendered = { results: false, ratings: true, profile: false, activity: false };

function switchTab(tab) {
  if (tab === currentTab) return;

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(TABS[tab]).classList.add('active');

  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${tab}"]`).classList.add('active');

  document.getElementById('content').scrollTop = 0;

  if (!rendered[tab]) {
    if (tab === 'results')  renderResults();
    if (tab === 'ratings')  renderRatings();
    if (tab === 'profile')  renderProfile();
    if (tab === 'activity') renderActivity();
    rendered[tab] = true;
  } else if (tab === 'profile') {
    renderProfile();
  } else if (tab === 'results') {
    tournamentsData = null; // always re-fetch so pair changes from bot are visible
    renderResults();
  }

  currentTab = tab;
  updateNavIcons();
}

function updateNavIcons() {
  document.querySelectorAll('.nav-tab').forEach(btn => {
    const active = btn.classList.contains('active');
    btn.querySelectorAll('svg').forEach(svg => {
      svg.style.stroke = active ? '#C9A84C' : '#4A6070';
    });
  });
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

updateNavIcons();

/* ════════════════════════════════════════════════════════════════
   TELEGRAM BACK BUTTON
════════════════════════════════════════════════════════════════ */
if (tg) {
  tg.BackButton.onClick(() => {
    if (currentTab !== 'ratings') {
      switchTab('ratings');
      tg.BackButton.hide();
    } else {
      tg.close();
    }
  });

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab !== 'ratings') tg.BackButton.show();
      else tg.BackButton.hide();
    });
  });
}

/* ════════════════════════════════════════════════════════════════
   REGISTRATION CONFIRM SCREEN
════════════════════════════════════════════════════════════════ */
const DAYS_UK_LONG = ['неділя','понеділок','вівторок','середа','четвер','п\'ятниця','субота'];
const MONTHS_UK_LONG = ['січня','лютого','березня','квітня','травня','червня','липня','серпня','вересня','жовтня','листопада','грудня'];

let pendingJoinTournamentId = null;
let pendingJoinAsReserve = false;
let pendingPairJoin = null; // { tournamentId, targetParticipantId, targetName }
let confirmBtnLabel = 'Зареєструватися';

function showRegistrationConfirm(tournament, alreadyEnrolled = false, asReserve = false) {
  pendingJoinTournamentId = alreadyEnrolled ? null : tournament.id;
  pendingJoinAsReserve = asReserve;
  pendingPairJoin = null;
  const isFull = tournament.maxParticipants && (tournament.participantCount || 0) >= tournament.maxParticipants;

  // Tournament card
  const dateObj = new Date(tournament.date);
  const dateStr = `${dateObj.getDate()} ${MONTHS_UK_LONG[dateObj.getMonth()]} ${dateObj.getFullYear()}, ${DAYS_UK_LONG[dateObj.getDay()]}`;

  let html = `<div class="rc-name">${esc(tournament.name)}</div>`;
  html += `<div class="rc-detail"><span class="rc-detail-icon">📅</span>${dateStr}</div>`;
  if (tournament.time) html += `<div class="rc-detail"><span class="rc-detail-icon">⏰</span>${tournament.time.slice(0, 5)}</div>`;
  if (tournament.location) html += `<div class="rc-detail"><span class="rc-detail-icon">📍</span>${esc(tournament.location)}</div>`;

  const tags = [];
  if (tournament.minRating != null || tournament.maxRating != null) {
    const lo = tournament.minRating ?? 0;
    const hi = tournament.maxRating != null ? tournament.maxRating : '∞';
    tags.push(`<span class="rc-tag rc-tag-gold">⚡ ${lo} – ${hi}</span>`);
  }
  if (tournament.levelLabel) tags.push(`<span class="rc-tag">${tournament.levelLabel}</span>`);
  tags.push(`<span class="rc-tag">${tournament.type === 'SINGLE' ? 'Одиночний' : tournament.type === 'CUP' ? '🏆 Кубок' : 'Парний'}</span>`);
  html += `<div class="rc-tags">${tags.join('')}</div>`;
  if (tournament.description) html += `<div class="t-description" style="margin-top:8px">${esc(tournament.description)}</div>`;
  document.getElementById('reg-confirm-card').innerHTML = html;

  // Price section
  const priceSection = document.getElementById('reg-confirm-price');
  if (tournament.price && tournament.price > 0) {
    document.getElementById('reg-confirm-price-amount').textContent = `${tournament.price} грн`;
    priceSection.classList.remove('hidden');
  } else {
    priceSection.classList.add('hidden');
  }

  // Pair-based registration (PAIR, and CUP while in DRAFT): show both options
  // (solo + join a waiting player) in the body
  const pairOptsEl = document.getElementById('reg-confirm-pair-options');
  const submitBtn = document.getElementById('reg-confirm-submit');
  const isPairReg = tournament.type === 'PAIR'
    || (tournament.type === 'CUP' && tournament.status === 'DRAFT');

  if (isPairReg && !alreadyEnrolled) {
    const pool = asReserve
      ? (tournament.pairReserveRegistrations || [])
      : (tournament.pairRegistrations || []);
    const solos = pool.filter(pr => !pr.player2 && pr.player1?.id !== currentUser?.id);

    let optsHtml = '';
    const reserveNotice = asReserve
      ? `<div class="pair-opt-reserve-notice">⏳ Ви вступаєте до резерву. Вас буде переведено у підтверджений список, коли звільниться місце.</div>`
      : '';

    const canSoloRegister = asReserve ? true : tournament.canRegisterSolo;

    if (canSoloRegister) {
      optsHtml += reserveNotice;
      optsHtml += `<div class="pair-opt-label">${asReserve ? 'Резерв без пари' : 'Без пари'}</div>
        <div class="pair-opt-player-row">
          <span class="pair-opt-player-name">${asReserve ? 'Зареєструватись до резерву і чекати на партнера' : 'Зареєструватись і чекати на партнера'}</span>
        </div>`;
    }

    if (solos.length > 0) {
      if (canSoloRegister) {
        optsHtml += `<div class="pair-opt-sep"><span>або приєднатись до</span></div>`;
      } else {
        optsHtml += reserveNotice;
        optsHtml += `<div class="pair-opt-label">${asReserve ? 'Приєднатись до гравця в резерві' : 'Приєднатись до гравця'}</div>`;
      }
      optsHtml += solos.map(pr => {
        const name = playerNameOf(pr.player1);
        const safeName = esc(name);
        return `<div class="pair-opt-player-row">
          <span class="pair-opt-player-name">${esc(name)}</span>
          <button class="pair-opt-join-btn rc-pair-join-btn" data-tid="${tournament.id}" data-pid="${pr.participant1Id}" data-name="${safeName}"${asReserve ? ' data-reserve="1"' : ''}>Грати разом</button>
        </div>`;
      }).join('');
    }

    pairOptsEl.innerHTML = optsHtml;
    pairOptsEl.classList.remove('hidden');

    // Wire inline join buttons
    pairOptsEl.querySelectorAll('.rc-pair-join-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const pid = parseInt(btn.dataset.pid, 10);
        const isRes = btn.dataset.reserve === '1';
        const entryPool = isRes ? (tournament.pairReserveRegistrations || []) : (tournament.pairRegistrations || []);
        const soloEntry = entryPool.find(pr => pr.participant1Id === pid);
        if (soloEntry) showPairJoinConfirm(tournament, soloEntry, isRes);
      });
    });

    // Main submit button: solo registration or hidden
    if (canSoloRegister) {
      confirmBtnLabel = asReserve ? 'У резерв без пари' : 'Зареєструватись без пари';
      submitBtn.textContent = confirmBtnLabel;
      submitBtn.disabled = false;
      submitBtn.style.display = '';
    } else {
      submitBtn.style.display = 'none';
    }
  } else {
    pairOptsEl.innerHTML = '';
    pairOptsEl.classList.add('hidden');
    submitBtn.style.display = '';
    confirmBtnLabel = alreadyEnrolled ? 'Вже зареєстровані'
      : (isFull ? 'Перейти до резерву' : 'Зареєструватися');
    submitBtn.textContent = confirmBtnLabel;
    submitBtn.disabled = alreadyEnrolled;
  }

  document.getElementById('reg-confirm').classList.add('reg-confirm-visible');
}

function hideRegistrationConfirm() {
  document.getElementById('reg-confirm').classList.remove('reg-confirm-visible');
  document.getElementById('reg-confirm-submit').style.display = '';
  document.getElementById('reg-confirm-pair-options').classList.add('hidden');
  pendingJoinTournamentId = null;
  pendingJoinAsReserve = false;
  pendingPairJoin = null;
}

function showPairJoinConfirm(tournament, soloEntry, asReserve = false) {
  const targetName = playerNameOf(soloEntry.player1);
  pendingPairJoin = { tournamentId: tournament.id, targetParticipantId: soloEntry.participant1Id, targetName };
  pendingJoinTournamentId = null;
  confirmBtnLabel = `Грати з ${targetName}`;

  const dateObj = new Date(tournament.date);
  const dateStr = `${dateObj.getDate()} ${MONTHS_UK_LONG[dateObj.getMonth()]} ${dateObj.getFullYear()}, ${DAYS_UK_LONG[dateObj.getDay()]}`;
  let html = `<div class="rc-name">${esc(tournament.name)}</div>`;
  html += `<div class="rc-detail"><span class="rc-detail-icon">📅</span>${dateStr}</div>`;
  if (tournament.time) html += `<div class="rc-detail"><span class="rc-detail-icon">⏰</span>${tournament.time.slice(0, 5)}</div>`;
  if (tournament.location) html += `<div class="rc-detail"><span class="rc-detail-icon">📍</span>${esc(tournament.location)}</div>`;
  html += `<div class="rc-detail"><span class="rc-detail-icon">🤝</span>Грати в парі з <b>${esc(targetName)}</b></div>`;
  if (asReserve) {
    html += `<div class="rc-detail" style="color:var(--text-muted);font-size:12px"><span class="rc-detail-icon">⏳</span>Це місце в резерві — пара буде підтверджена, коли звільниться місце</div>`;
  }
  const tags = [];
  if (tournament.levelLabel) tags.push(`<span class="rc-tag">${tournament.levelLabel}</span>`);
  tags.push(`<span class="rc-tag">${tournament.type === 'CUP' ? '🏆 Кубок' : 'Парний'}</span>`);
  if (asReserve) tags.push(`<span class="rc-tag" style="color:var(--text-muted)">Резерв</span>`);
  html += `<div class="rc-tags">${tags.join('')}</div>`;
  document.getElementById('reg-confirm-card').innerHTML = html;
  document.getElementById('reg-confirm-price').classList.add('hidden');

  const btn = document.getElementById('reg-confirm-submit');
  btn.textContent = confirmBtnLabel;
  btn.disabled = false;
  document.getElementById('reg-confirm').classList.add('reg-confirm-visible');
}

document.getElementById('reg-confirm-back').addEventListener('click', hideRegistrationConfirm);

document.getElementById('reg-confirm-submit').addEventListener('click', async () => {
  const btn = document.getElementById('reg-confirm-submit');
  btn.disabled = true;
  btn.textContent = '...';

  if (pendingPairJoin) {
    try {
      await API.tournaments.sendPairRequest(pendingPairJoin.tournamentId, pendingPairJoin.targetParticipantId);
      const targetName = pendingPairJoin.targetName;
      hideRegistrationConfirm();
      tournamentsData = null;
      showToast(`Заявку надіслано! ${targetName} отримає сповіщення 🤝`, 'success');
      switchTab('results');
      await renderResults();
    } catch (e) {
      btn.disabled = false;
      btn.textContent = confirmBtnLabel;
      showToast(e.message || 'Помилка відправки заявки', 'error');
    }
    return;
  }

  if (!pendingJoinTournamentId) return;
  try {
    const res = await API.tournaments.join(pendingJoinTournamentId);
    hideRegistrationConfirm();
    tournamentsData = null;
    if (res && res.reserved) {
      showToast('Ви додані до резерву турніру. Очікуйте підтвердження місця 🎾', 'info');
    } else {
      showToast('Ви успішно зареєстровані! 🎾', 'success');
    }
    switchTab('results');
    await renderResults();
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already enrolled') || msg.includes('вже зареєстровані')) {
      hideRegistrationConfirm();
      showToast('Ви вже зареєстровані на цей турнір', 'info');
      switchTab('results');
    } else {
      btn.disabled = false;
      btn.textContent = confirmBtnLabel;
      showToast('Помилка: ' + msg, 'error');
    }
  }
});

/* ════════════════════════════════════════════════════════════════
   TOAST
════════════════════════════════════════════════════════════════ */
let toastTimer = null;
function showToast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer) { clearTimeout(toastTimer); el.classList.remove('toast-visible'); }
  el.textContent = message;
  el.className = `toast-${type}`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => el.classList.add('toast-visible'));
  });
  toastTimer = setTimeout(() => {
    el.classList.remove('toast-visible');
    toastTimer = null;
  }, 4000);
}

/* ════════════════════════════════════════════════════════════════
   CUP FEATURE
════════════════════════════════════════════════════════════════ */

let cupState       = null; // current cup data from API
let cupTournamentId = null;
let cupScoreCtx    = null; // { type: 'group'|'playoff', matchId, pair1Name, pair2Name }

// ── Open Cup Detail Modal ────────────────────────────────────────

async function openCupModal(tournamentId) {
  cupTournamentId = tournamentId;
  const modal = document.getElementById('modal-cup');
  const body  = document.getElementById('cup-modal-body');
  const title = document.getElementById('cup-modal-title');

  const t = (tournamentsData || []).find(x => String(x.id) === String(tournamentId));
  title.textContent = t ? t.name : 'Кубок';

  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Завантаження...</div>';
  openModal('modal-cup');

  try {
    cupState = await API.cup.get(tournamentId);
    renderCupModal();
  } catch (e) {
    body.innerHTML = `<div style="color:#e05252;padding:20px;text-align:center">Помилка: ${esc(e.data?.message || e.message)}</div>`;
  }
}

function renderCupModal() {
  if (!cupState) return;
  const body = document.getElementById('cup-modal-body');
  const isAdmin = currentUser?.role === 'ADMIN';
  const status = cupState.status;

  let html = '';

  // ── Group Stage ──────────────────────────────────────────────

  if (cupState.groups && cupState.groups.length > 0) {
    html += `<div class="cup-section-title">Груповий етап</div>`;
    cupState.groups.forEach(group => {
      html += renderCupGroup(group, isAdmin && status === 'GROUP_STAGE');
    });

    if (isAdmin && status === 'GROUP_STAGE') {
      const allPlayed = cupState.groups.every(g => g.matches.every(m => m.played));
      html += `<button class="btn-primary cup-confirm-groups-btn" style="width:100%;margin-top:8px" ${allPlayed ? '' : 'disabled'}>
        ✓ Підтвердити груповий етап${allPlayed ? '' : ' (не всі матчі зіграні)'}
      </button>`;
    }
  }

  // ── Playoff Bracket ──────────────────────────────────────────

  if (status === 'PLAYOFF' || status === 'FINISHED') {
    html += `<div class="cup-section-title" style="margin-top:18px">Плей-офф</div>`;

    // Explain the bye rule when the main bracket actually has byes (first-round match with
    // a single real pair). Keeps it clear that the direct slot to the semifinal is earned.
    const mainHasBye = (cupState.mainBracket || []).some(m =>
      m.roundOrder === 1 && (!!m.pair1Name !== !!m.pair2Name));
    if (mainHasBye) {
      html += `<div class="cup-bracket-note">Найкращі переможці груп (за очками, потім різницею сетів) проходять одразу до півфіналу — без чвертьфіналу.</div>`;
    }

    if (cupState.mainBracket && cupState.mainBracket.length > 0) {
      html += renderPlayoffBracket(cupState.mainBracket, isAdmin && status === 'PLAYOFF', false);
    }

    if (cupState.consolationBracket && cupState.consolationBracket.length > 0) {
      html += `<div class="cup-section-title" style="margin-top:14px;font-size:13px;opacity:0.8">Втішний кубок</div>`;
      html += renderPlayoffBracket(cupState.consolationBracket, isAdmin && status === 'PLAYOFF', true);
    }

    if (isAdmin && status === 'PLAYOFF') {
      html += `<button class="btn-primary" id="cup-modal-finalize-btn" style="width:100%;margin-top:12px;background:linear-gradient(135deg,var(--success),#2a8a55)">✓ Завершити кубок та нарахувати рейтинг</button>`;
    }
  }

  body.innerHTML = html;

  // Wire group match buttons
  body.querySelectorAll('.cup-group-match-enter').forEach(btn => {
    btn.addEventListener('click', () => openCupScoreModal('group', btn.dataset));
  });

  // Wire playoff match buttons
  body.querySelectorAll('.cup-playoff-match-enter').forEach(btn => {
    btn.addEventListener('click', () => openCupScoreModal('playoff', btn.dataset));
  });

  // Wire confirm groups
  const confirmBtn = body.querySelector('.cup-confirm-groups-btn');
  if (confirmBtn) {
    confirmBtn.addEventListener('click', async () => {
      // If group winners are tied so it's impossible to decide who earns the bye to the
      // semifinal, let the admin choose. Otherwise seeding is automatic (best winners get byes).
      const tie = detectWinnerByeTie();
      if (tie) { openByeChoiceModal(tie); return; }

      if (!confirm('Підтвердити груповий етап і згенерувати плей-офф сітку?')) return;
      confirmBtn.disabled = true;
      const ok = await cupConfirmGroups(null);
      if (!ok) confirmBtn.disabled = false;
    });
  }

  // Wire finalize
  const finalizeBtn = body.querySelector('#cup-modal-finalize-btn');
  if (finalizeBtn) {
    finalizeBtn.addEventListener('click', async () => {
      if (!confirm('Завершити кубок та нарахувати рейтинг?')) return;
      finalizeBtn.disabled = true;
      try {
        cupState = await API.cup.finalize(cupTournamentId);
        tournamentsData = null;
        renderCupModal();
        showToast('Кубок завершено! Рейтинг нараховано 🏆');
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        finalizeBtn.disabled = false;
      }
    });
  }
}

// ── Confirm groups / bye tie-break ────────────────────────────────

let cupByeCtx = null; // { byeCount }

/** POST confirm-groups (optionally with a bye tie-break override). Returns true on success. */
async function cupConfirmGroups(payload) {
  try {
    cupState = await API.cup.confirmGroups(cupTournamentId, payload);
    tournamentsData = null; // refresh card list
    renderCupModal();
    showToast('Плей-офф сітка створена! 🏆');
    return true;
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
    return false;
  }
}

function cupNextPow2(n) { let p = 1; while (p < n) p <<= 1; return Math.max(2, p); }

/**
 * Detect whether the group winners are tied at the bye cut-off, making it impossible to decide
 * automatically which winners advance straight to the semifinal. Returns { winners, byeCount }
 * when admin input is needed, otherwise null (seeding is unambiguous → fully automatic).
 */
function detectWinnerByeTie() {
  if (!cupState || !cupState.groups || cupState.groups.length === 0) return null;
  const advancing = cupState.pairsAdvancing || 1;

  const winners = cupState.groups
    .map(g => (g.standings && g.standings[0]) ? { ...g.standings[0], groupName: g.name } : null)
    .filter(Boolean);
  if (winners.length < 2) return null;

  // Number of qualifiers feeding the main bracket, and how many byes its padding creates.
  const mainSeedCount = cupState.groups.reduce(
    (sum, g) => sum + Math.min(advancing, g.pairs ? g.pairs.length : 0), 0);
  const byeCount = cupNextPow2(mainSeedCount) - mainSeedCount;
  if (byeCount <= 0) return null;              // no byes at all
  if (byeCount >= winners.length) return null; // every winner already gets a bye

  const sorted = [...winners].sort((a, b) =>
    b.points - a.points || b.setDiff - a.setDiff || b.setsWon - a.setsWon);

  const lastBye  = sorted[byeCount - 1];
  const firstOut = sorted[byeCount];
  const tied = lastBye.points === firstOut.points
    && lastBye.setDiff === firstOut.setDiff
    && lastBye.setsWon === firstOut.setsWon;
  if (!tied) return null;

  return { winners: sorted, byeCount };
}

function openByeChoiceModal(tie) {
  cupByeCtx = { byeCount: tie.byeCount };
  document.getElementById('cup-bye-count').textContent = tie.byeCount;
  document.getElementById('cup-bye-options').innerHTML = tie.winners.map((w, idx) => {
    const checked = idx < tie.byeCount ? 'checked' : '';
    const diff = `${w.setDiff >= 0 ? '+' : ''}${w.setDiff}`;
    return `<label class="cup-bye-option">
      <input type="checkbox" class="cup-bye-cb" value="${w.pairId}" ${checked}>
      <span class="cup-bye-info">
        <span class="cup-bye-name">Група ${esc(w.groupName)}: ${esc(w.pairName)}</span>
        <span class="cup-bye-stats">${w.points} очк · різниця сетів ${diff}</span>
      </span>
    </label>`;
  }).join('');
  openModal('modal-cup-bye');
}

document.getElementById('cup-bye-confirm').addEventListener('click', async () => {
  if (!cupByeCtx) return;
  const chosen = [...document.querySelectorAll('.cup-bye-cb:checked')].map(cb => Number(cb.value));
  if (chosen.length !== cupByeCtx.byeCount) {
    showToast(`Оберіть рівно ${cupByeCtx.byeCount} пар(и), що проходять до півфіналу`, 'error');
    return;
  }
  const btn = document.getElementById('cup-bye-confirm');
  btn.disabled = true;
  const ok = await cupConfirmGroups({ byeSeedPairIds: chosen });
  btn.disabled = false;
  if (ok) closeModal('modal-cup-bye');
});

// ── Render Group ─────────────────────────────────────────────────

function renderCupGroup(group, allowEntry) {
  const standings = group.standings || [];
  const matches   = group.matches   || [];

  const advanceCount = cupState?.pairsAdvancing ?? 2;
  const standingRows = standings.map((s, i) => `
    <tr class="${i < advanceCount ? 'cup-standing-advance' : ''}">
      <td class="cup-st-pos">${i + 1}</td>
      <td class="cup-st-name">${esc(s.pairName)}</td>
      <td class="cup-st-num">${s.played}</td>
      <td class="cup-st-num">${s.won}</td>
      <td class="cup-st-num">${s.lost}</td>
      <td class="cup-st-num">${s.setDiff > 0 ? '+' + s.setDiff : s.setDiff}</td>
      <td class="cup-st-pts"><strong>${s.points}</strong></td>
    </tr>`).join('');

  const matchRows = matches.map(m => {
    const hasTb = m.tiebreak1 != null;
    const tbSuffix = hasTb ? `<span class="cup-match-tb"> (${m.tiebreak1}:${m.tiebreak2})</span>` : '';
    const score = m.played
      ? `<span class="cup-match-score">${m.score1}:${m.score2}${tbSuffix}</span>`
      : '<span class="cup-match-score-pending">—</span>';
    const enterBtn = allowEntry
      ? `<button class="cup-group-match-enter" data-match-id="${m.id}" data-pair1-name="${esc(m.pair1Name)}" data-pair2-name="${esc(m.pair2Name)}" data-score1="${m.score1 ?? ''}" data-score2="${m.score2 ?? ''}" data-tiebreak1="${m.tiebreak1 ?? ''}" data-tiebreak2="${m.tiebreak2 ?? ''}">${m.played ? '✏️' : '+ Рахунок'}</button>`
      : '';
    return `<div class="cup-match-row${m.played ? ' cup-match-played' : ''}">
      <span class="cup-match-team">${esc(m.pair1Name)}</span>
      ${score}
      <span class="cup-match-team cup-match-team-right">${esc(m.pair2Name)}</span>
      ${enterBtn}
    </div>`;
  }).join('');

  return `
    <div class="cup-group-block">
      <div class="cup-group-header">Група ${esc(group.name)}</div>
      <div class="cup-group-table-wrap">
        <table class="cup-standings-table">
          <thead>
            <tr><th>№</th><th>Пара</th><th>І</th><th>В</th><th>П</th><th>±</th><th>О</th></tr>
          </thead>
          <tbody>${standingRows}</tbody>
        </table>
      </div>
      <div class="cup-group-matches">${matchRows}</div>
    </div>`;
}

// ── Render Playoff Bracket ────────────────────────────────────────

function renderPlayoffBracket(matches, allowEntry, isConsolation) {
  // Group by roundOrder
  const allRounds = {};
  matches.forEach(m => {
    if (!allRounds[m.roundOrder]) allRounds[m.roundOrder] = [];
    allRounds[m.roundOrder].push(m);
  });

  const sortedAllRounds = Object.keys(allRounds).map(Number).sort((a, b) => a - b);
  const maxRound = sortedAllRounds[sortedAllRounds.length - 1];

  // Filter: only keep matches that have at least one real pair or seed.
  // Phantom matches (both pairs null, no seeds) are hidden — they exist only
  // as cascade placeholders for brackets padded with byes (e.g. 12 pairs → 16-bracket).
  const isVisible = m => m.pair1Name || m.pair2Name || m.seed1 || m.seed2;

  // Build filtered round map; skip rounds that become entirely empty
  const rounds = {};
  sortedAllRounds.forEach(r => {
    const visible = allRounds[r].filter(isVisible);
    if (visible.length > 0) rounds[r] = visible;
  });

  const sortedRounds = Object.keys(rounds).map(Number).sort((a, b) => a - b);
  const totalRounds  = sortedRounds.length;

  let html = `<div class="cup-bracket">`;

  sortedRounds.forEach((r, roundIdx) => {
    const roundMatches = rounds[r].sort((a, b) => a.matchOrder - b.matchOrder);
    const isFinalRound = r === maxRound;
    const isLastRound  = roundIdx === totalRounds - 1;

    // Column header: use the top-seeded match's round label
    const firstLabel = roundMatches[0]?.roundLabel || '';
    const colLabel   = isFinalRound ? (firstLabel || 'Фінал') : (firstLabel || '');
    const headerClass = (isFinalRound && !isConsolation) ? ' is-final' : '';

    html += `<div class="cup-bracket-round">`;
    html += `<div class="cup-round-header${headerClass}">${colLabel}</div>`;

    // Group consecutive pairs of matches for bracket-connector CSS.
    // Each pair of adjacent matches feeds one match in the next round.
    let i = 0;
    while (i < roundMatches.length) {
      const m1 = roundMatches[i];
      const m2 = roundMatches[i + 1];
      const hasPair = m2 != null && !isLastRound;

      // Upper-to-lower track divider
      if (i > 0 && !isFinalRound
          && (m1.roundLabel || '').startsWith('За')
          && !(roundMatches[i - 1].roundLabel || '').startsWith('За')) {
        html += `<div class="cup-bracket-divider">↓ За місця</div>`;
      }

      if (hasPair) {
        // Lower-track pairs (losers going to consolation rounds) get a CSS class
        // so arrows can be suppressed — user wants arrows only on the winner flow.
        const isLowerPair = !isFinalRound && (m1.roundLabel || '').startsWith('За');
        html += `<div class="cup-bracket-pair${isLowerPair ? ' cup-bracket-pair-lower' : ''}">`;
        html += renderBracketMatch(m1, allowEntry, isFinalRound, isConsolation);
        html += renderBracketMatch(m2, allowEntry, isFinalRound, isConsolation);
        html += `</div>`;
        i += 2;
      } else {
        html += `<div class="cup-bracket-solo">`;
        html += renderBracketMatch(m1, allowEntry, isFinalRound, isConsolation);
        html += `</div>`;
        i += 1;
      }
    }

    html += `</div>`;
  });

  html += `</div>`;
  return html;
}

function renderBracketMatch(m, allowEntry, isFinalRound, isConsolation) {
  // Single-place slot: a collapsed phantom match (e.g. lone 9th place with no real opponent).
  // Just state the place and the team that holds it — no match box, no score entry.
  const isSinglePlace = m.placeLabel && !m.placeLabel.includes('-');
  if (isSinglePlace) {
    const soleName = m.pair1Name || m.pair2Name || 'TBD';
    const isTbd = !m.pair1Name && !m.pair2Name;
    return `<div class="cup-bracket-match cup-bracket-match-place">
      <div class="cup-bm-place">${placeLabelUa(m.placeLabel)}</div>
      <div class="cup-bm-pair cup-bm-winner">
        <span class="cup-bm-name${isTbd ? ' tbd' : ''}">${esc(soleName)}</span>
      </div>
    </div>`;
  }

  const hasResult = m.score1 != null;
  const p1Win = hasResult && m.score1 > m.score2;
  const p2Win = hasResult && m.score2 > m.score1;
  const p1Name = m.pair1Name || (m.seed1 ? `Нас. ${m.seed1}` : 'TBD');
  const p2Name = m.pair2Name || (m.seed2 ? `Нас. ${m.seed2}` : 'TBD');
  const isTbd1 = !m.pair1Name;
  const isTbd2 = !m.pair2Name;
  const isFinalMatch = isFinalRound && m.placeLabel === '1-2';
  const isLower = !isFinalRound && (m.roundLabel || '').startsWith('За');

  // Score display: for score >= 0 show it, for TBD show nothing
  const score1Display = hasResult ? m.score1 : '';
  const score2Display = hasResult ? m.score2 : '';
  const hasTb = m.tiebreak1 != null;

  const enterBtn = allowEntry && m.pair1Name && m.pair2Name && !hasResult
    ? `<button class="cup-playoff-match-enter" data-match-id="${m.id}" data-pair1-name="${esc(p1Name)}" data-pair2-name="${esc(p2Name)}">+ Рахунок</button>`
    : (allowEntry && hasResult && m.pair1Name
        ? `<button class="cup-playoff-match-enter" data-match-id="${m.id}" data-pair1-name="${esc(p1Name)}" data-pair2-name="${esc(p2Name)}" data-score1="${m.score1}" data-score2="${m.score2}" data-tiebreak1="${m.tiebreak1 ?? ''}" data-tiebreak2="${m.tiebreak2 ?? ''}">✏️ Редагувати</button>`
        : '');

  // Tiebreak badge — shown only when the set ended 7:6
  const tbFooter = hasTb
    ? `<div class="cup-bm-tb-footer">Т/Б ${m.tiebreak1}:${m.tiebreak2}</div>`
    : '';

  return `<div class="cup-bracket-match${isFinalMatch ? ' cup-bracket-match-final' : ''}${isLower ? ' cup-bracket-match-lower' : ''}">
    ${m.placeLabel ? `<div class="cup-bm-place">${placeLabelUa(m.placeLabel)}</div>` : ''}
    <div class="cup-bm-pair${p1Win ? ' cup-bm-winner' : p2Win ? ' cup-bm-loser' : ''}">
      <span class="cup-bm-name${isTbd1 ? ' tbd' : ''}">${esc(p1Name)}</span>
      <span class="cup-bm-score">${score1Display}</span>
    </div>
    <div class="cup-bm-pair${p2Win ? ' cup-bm-winner' : p1Win ? ' cup-bm-loser' : ''}">
      <span class="cup-bm-name${isTbd2 ? ' tbd' : ''}">${esc(p2Name)}</span>
      <span class="cup-bm-score">${score2Display}</span>
    </div>
    ${tbFooter}
    ${enterBtn}
  </div>`;
}

function placeLabelUa(label) {
  if (!label) return '';
  const parts = label.split('-').map(Number);
  const p1 = parts[0];
  const medal = p1 === 1 ? '🥇 ' : p1 === 3 ? '🥉 ' : '';
  // Single place (collapsed phantom match — no opponent exists for this slot)
  if (parts.length === 1) return `${medal}${p1} місце`;
  return `${medal}${p1}–${parts[1]} місце`;
}

// (legacy cup escaper removed — uses the strict shared esc() from analysis-admin.js)

// ── Cup Score Modal ───────────────────────────────────────────────

function openCupScoreModal(type, data) {
  const matchId  = data.matchId;
  const p1       = data.pair1Name  || '';
  const p2       = data.pair2Name  || '';
  const score1   = data.score1     || '';
  const score2   = data.score2     || '';
  const tb1      = data.tiebreak1  || '';
  const tb2      = data.tiebreak2  || '';

  cupScoreCtx = { type, matchId };

  document.getElementById('cup-score-title').textContent =
    type === 'group' ? 'Груповий матч' : 'Матч плей-офф';
  document.getElementById('cup-score-p1-name').textContent = p1;
  document.getElementById('cup-score-p2-name').textContent = p2;
  document.getElementById('cup-score-1').value = score1;
  document.getElementById('cup-score-2').value = score2;
  document.getElementById('cup-tb-1').value = tb1;
  document.getElementById('cup-tb-2').value = tb2;

  // Show/hide tiebreak section based on initial values
  cupCheckTiebreak();

  openModal('modal-cup-score');
  setTimeout(() => document.getElementById('cup-score-1').focus(), 150);
}

function cupCheckTiebreak() {
  const s1 = parseInt(document.getElementById('cup-score-1').value, 10);
  const s2 = parseInt(document.getElementById('cup-score-2').value, 10);
  const needsTb = !isNaN(s1) && !isNaN(s2) && ((s1 === 7 && s2 === 6) || (s1 === 6 && s2 === 7));
  document.getElementById('cup-tiebreak-section').style.display = needsTb ? '' : 'none';
  if (!needsTb) {
    document.getElementById('cup-tb-1').value = '';
    document.getElementById('cup-tb-2').value = '';
  }
}

// Live show/hide tiebreak as score is typed
document.getElementById('cup-score-1').addEventListener('input', cupCheckTiebreak);
document.getElementById('cup-score-2').addEventListener('input', cupCheckTiebreak);

document.getElementById('cup-score-submit').addEventListener('click', async () => {
  if (!cupScoreCtx) return;
  const s1 = parseInt(document.getElementById('cup-score-1').value, 10);
  const s2 = parseInt(document.getElementById('cup-score-2').value, 10);
  if (isNaN(s1) || isNaN(s2)) { showToast('Введіть рахунок', 'error'); return; }

  const needsTb = (s1 === 7 && s2 === 6) || (s1 === 6 && s2 === 7);
  const payload = { score1: s1, score2: s2 };

  if (needsTb) {
    const tb1 = parseInt(document.getElementById('cup-tb-1').value, 10);
    const tb2 = parseInt(document.getElementById('cup-tb-2').value, 10);
    if (isNaN(tb1) || isNaN(tb2)) { showToast('Введіть рахунок тай-брейку', 'error'); return; }
    // Client-side validation
    const tbHi = Math.max(tb1, tb2), tbLo = Math.min(tb1, tb2);
    if (tbHi < 7) { showToast('Тай-брейк: переможець повинен набрати ≥7 очок', 'error'); return; }
    if (tbHi - tbLo < 2) { showToast('Тай-брейк: перевага повинна бути ≥2 очки', 'error'); return; }
    const setW1 = s1 > s2, tbW1 = tb1 > tb2;
    if (setW1 !== tbW1) { showToast('Переможець тай-брейку має збігатися з переможцем сету', 'error'); return; }
    payload.tiebreak1 = tb1;
    payload.tiebreak2 = tb2;
  }

  const btn = document.getElementById('cup-score-submit');
  btn.disabled = true;
  try {
    if (cupScoreCtx.type === 'group') {
      cupState = await API.cup.submitGroupMatch(cupTournamentId, cupScoreCtx.matchId, payload);
    } else {
      cupState = await API.cup.submitPlayoff(cupTournamentId, cupScoreCtx.matchId, payload);
    }
    closeModal('modal-cup-score');
    renderCupModal();
    showToast('Рахунок збережено ✓');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
  } finally {
    btn.disabled = false;
  }
});

// ── Cup Start Modal (Admin) ───────────────────────────────────────

let cupStartTournamentId = null;
let cupManualPairs = [];

function openCupStartModal(tournamentId) {
  cupStartTournamentId = tournamentId;
  const t = (tournamentsData || []).find(x => String(x.id) === String(tournamentId));

  document.getElementById('cup-group-count').value = '2';
  document.getElementById('cup-pairs-advancing').value = '2';
  document.getElementById('cup-pair-mode').value = 'registration';
  document.getElementById('cup-pairs-manual-section').style.display = 'none';
  cupManualPairs = [];
  renderManualPairs(t);
  renderCupRegistrationInfo(t);

  openModal('modal-cup-start');
}

// Pairs/solos formed during cup registration (partner-invite flow), from the DTO.
function cupRegistrationPairs(t) {
  const regs = (t && t.pairRegistrations) || [];
  return { pairs: regs.filter(pr => pr.player2), solos: regs.filter(pr => !pr.player2) };
}

function renderCupRegistrationInfo(t) {
  const el = document.getElementById('cup-registration-info');
  if (!el) return;
  if (document.getElementById('cup-pair-mode').value !== 'registration') { el.textContent = ''; return; }
  const { pairs, solos } = cupRegistrationPairs(t);
  if (solos.length) {
    el.style.color = 'var(--error)';
    el.innerHTML = `⚠️ ${solos.length} без пари: ${esc(solos.map(pr => nameOf(pr.player1)).join(', '))}. Допаруйте або видаліть перед запуском.`;
  } else {
    el.style.color = 'var(--text-muted)';
    el.textContent = `${pairs.length} пар із заявок готові до запуску.`;
  }
}

document.getElementById('cup-pair-mode').addEventListener('change', function() {
  const t = (tournamentsData || []).find(x => String(x.id) === String(cupStartTournamentId));
  const manual = this.value === 'manual';
  document.getElementById('cup-pairs-manual-section').style.display = manual ? '' : 'none';
  if (manual) buildManualPairsFromRegistration(t);
  renderCupRegistrationInfo(t);
});

// Pre-fill the manual editor from the registration pairs (solos become single editable rows).
function buildManualPairsFromRegistration(t) {
  const { pairs, solos } = cupRegistrationPairs(t);
  cupManualPairs = pairs.map(pr => ({
    p1: pr.player1.id, p2: pr.player2.id, p1Name: nameOf(pr.player1), p2Name: nameOf(pr.player2),
  }));
  solos.forEach(pr => cupManualPairs.push({
    p1: pr.player1.id, p2: null, p1Name: nameOf(pr.player1), p2Name: '',
  }));
  renderManualPairs(t);
}

function buildManualPairsFromParticipants(t) {
  const participants = t.participants || [];
  cupManualPairs = [];
  for (let i = 0; i < participants.length - 1; i += 2) {
    cupManualPairs.push({ p1: participants[i].id, p2: participants[i+1].id,
      p1Name: nameOf(participants[i]), p2Name: nameOf(participants[i+1]) });
  }
  if (participants.length % 2 === 1) {
    const last = participants[participants.length - 1];
    cupManualPairs.push({ p1: last.id, p2: null, p1Name: nameOf(last), p2Name: '' });
  }
  renderManualPairs(t);
}

function renderManualPairs(t) {
  const container = document.getElementById('cup-manual-pairs-container');
  const participants = t ? (t.participants || []) : [];
  container.innerHTML = cupManualPairs.map((pair, i) => `
    <div class="cup-manual-pair" data-index="${i}">
      <select class="form-select cup-manual-p1" data-index="${i}" style="flex:1">
        ${participants.map(p => `<option value="${p.id}" ${String(p.id) === String(pair.p1) ? 'selected' : ''}>${esc(nameOf(p))}</option>`).join('')}
      </select>
      <span style="color:var(--text-muted)"> / </span>
      <select class="form-select cup-manual-p2" data-index="${i}" style="flex:1">
        <option value="">—</option>
        ${participants.map(p => `<option value="${p.id}" ${String(p.id) === String(pair.p2) ? 'selected' : ''}>${esc(nameOf(p))}</option>`).join('')}
      </select>
      <button class="cup-remove-pair-btn" data-index="${i}" style="flex:0 0 30px;background:none;border:none;color:var(--error);font-size:16px;cursor:pointer">✕</button>
    </div>`).join('');

  container.querySelectorAll('.cup-remove-pair-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      cupManualPairs.splice(parseInt(btn.dataset.index, 10), 1);
      renderManualPairs(t);
    });
  });
}

document.getElementById('cup-add-pair-btn').addEventListener('click', () => {
  const t = (tournamentsData || []).find(x => String(x.id) === String(cupStartTournamentId));
  const participants = t ? (t.participants || []) : [];
  if (participants.length > 0) {
    cupManualPairs.push({ p1: participants[0].id, p2: null, p1Name: nameOf(participants[0]), p2Name: '' });
    renderManualPairs(t);
  }
});

document.getElementById('cup-start-btn').addEventListener('click', async () => {
  const btn = document.getElementById('cup-start-btn');
  const groupCount = parseInt(document.getElementById('cup-group-count').value, 10);
  const pairsAdvancing = parseInt(document.getElementById('cup-pairs-advancing').value, 10);
  const mode = document.getElementById('cup-pair-mode').value;

  if (isNaN(groupCount) || groupCount < 2) { showToast('Мінімум 2 групи', 'error'); return; }
  if (isNaN(pairsAdvancing) || pairsAdvancing < 1) { showToast('Мінімум 1 пара виходить', 'error'); return; }

  const t = (tournamentsData || []).find(x => String(x.id) === String(cupStartTournamentId));
  let payload = { groupCount, pairsAdvancing };

  if (mode === 'random') {
    payload.randomizePairs = true;
  } else if (mode === 'manual') {
    const pairDivs = document.getElementById('cup-manual-pairs-container').querySelectorAll('.cup-manual-pair');
    const assignments = Array.from(pairDivs).map(div => {
      const p1 = div.querySelector('.cup-manual-p1')?.value;
      const p2 = div.querySelector('.cup-manual-p2')?.value;
      return { player1Id: parseInt(p1, 10), player2Id: p2 ? parseInt(p2, 10) : null };
    }).filter(a => a.player1Id);
    if (assignments.some(a => !a.player2Id)) {
      showToast('Кожна пара має складатися з двох гравців', 'error'); return;
    }
    payload.pairAssignments = assignments;
  } else {
    // registration mode: use pairs from invites; block if anyone is still unpaired
    const { solos } = cupRegistrationPairs(t);
    if (solos.length) { showToast(`${solos.length} гравців без пари. Допаруйте або видаліть.`, 'error'); return; }
    // no randomize / no assignments → backend uses registration pairs
  }

  btn.disabled = true;
  btn.textContent = '⏳ Запуск...';
  try {
    cupState = await API.cup.start(cupStartTournamentId, payload);
    cupTournamentId = cupStartTournamentId;
    closeModal('modal-cup-start');
    tournamentsData = null;
    await renderResults(); // refresh card list to show GROUP_STAGE status

    // Open the cup detail modal
    const title = document.getElementById('cup-modal-title');
    const allT = tournamentsData || [];
    const t = allT.find(x => String(x.id) === String(cupTournamentId));
    if (title && t) title.textContent = t.name;
    openModal('modal-cup');
    renderCupModal();

    showToast('Кубок розпочато! 🏆');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка запуску', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = '🏆 Запустити Кубок';
  }
});

function nameOf(p) {
  return [p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || p.username || 'Гравець';
}

/* ════════════════════════════════════════════════════════════════
   TOURNAMENT DEEP LINK
════════════════════════════════════════════════════════════════ */
async function handleTournamentDeepLink(tournamentId) {
  try {
    const tournament = await API.tournaments.get(tournamentId);
    if (tournament.status === 'FINISHED') {
      activeResultsSubTab = 'finished';
      document.querySelectorAll('#results-subtabs .results-subtab').forEach(b => {
        b.classList.toggle('active', b.dataset.subtab === 'finished');
      });
      switchTab('results');
      return;
    }
    const allParts = [...(tournament.participants || []), ...(tournament.reserveParticipants || [])];
    const alreadyEnrolled = currentUser && allParts.some(p => p.id === currentUser.id);
    switchTab('results');
    showRegistrationConfirm(tournament, alreadyEnrolled);
  } catch {
    showToast('Не вдалося завантажити турнір', 'error');
    renderRatings();
  }
}

async function handlePairJoinDeepLink(tournamentId, targetParticipantId) {
  try {
    const tournament = await API.tournaments.get(tournamentId);
    // CUP uses the same partner-invite flow as PAIR while in DRAFT
    const isPairReg = tournament && (tournament.type === 'PAIR'
      || (tournament.type === 'CUP' && tournament.status === 'DRAFT'));
    if (!isPairReg || tournament.status === 'FINISHED') return;
    const pairRegs = tournament.pairRegistrations || [];
    const soloEntry = pairRegs.find(pr => String(pr.participant1Id) === String(targetParticipantId));
    if (!soloEntry || soloEntry.player2) {
      switchTab('results');
      showToast('Цей гравець вже знайшов партнера', 'info');
      return;
    }
    if (currentUser && soloEntry.player1?.id === currentUser.id) {
      switchTab('results');
      return;
    }
    switchTab('results');
    showPairJoinConfirm(tournament, soloEntry);
  } catch {
    showToast('Не вдалося завантажити турнір', 'error');
  }
}

/* ════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════ */

// Render default tab immediately with fallback data — page is usable before API responds
/* ════════════════════════════════════════════════════════════════
   HOME SCREEN BANNER
════════════════════════════════════════════════════════════════ */

function initRaketoLinkBanner() {
  // Only show when the user is logged in but hasn't linked Raketo yet
  if (!currentUser || currentUser.raketoDocId) return;

  const banner = document.getElementById('raketo-link-banner');
  if (!banner) return;

  // Fill in the user's actual Telegram @handle
  const usernameEl = document.getElementById('rlb-username');
  if (usernameEl && currentUser.username) {
    usernameEl.textContent = '@' + currentUser.username;
  }

  function show() {
    banner.removeAttribute('aria-hidden');
    requestAnimationFrame(() => banner.classList.add('rlb-visible'));
  }
  function hide() {
    banner.classList.remove('rlb-visible');
    banner.setAttribute('aria-hidden', 'true');
  }

  // Use replaceEventListener pattern so reopening the app doesn't stack listeners
  const connectBtn = document.getElementById('rlb-connect-btn');
  const laterBtn   = document.getElementById('rlb-later-btn');
  const newConnect = connectBtn.cloneNode(true);
  const newLater   = laterBtn.cloneNode(true);
  connectBtn.replaceWith(newConnect);
  laterBtn.replaceWith(newLater);

  newConnect.addEventListener('click', () => { hide(); switchTab('profile'); });
  newLater.addEventListener('click', hide);

  setTimeout(show, 600);
}

function initHomescreenBanner() {
  // Only inside Telegram Mini App
  if (!tg) return;
  if (localStorage.getItem('bsp_hs_added')) return;

  const dismissed = localStorage.getItem('bsp_hs_dismissed');
  if (dismissed && Date.now() - parseInt(dismissed, 10) < 3 * 24 * 60 * 60 * 1000) return;

  function showBanner() {
    const banner = document.getElementById('homescreen-banner');
    if (!banner) return;

    setTimeout(() => {
      banner.classList.add('hs-visible');
      banner.removeAttribute('aria-hidden');
    }, 1800);

    document.getElementById('hs-add-btn').addEventListener('click', () => {
      try {
        if (typeof tg.addToHomeScreen === 'function') tg.addToHomeScreen();
      } catch { /* old client without home-screen support */ }
      banner.classList.remove('hs-visible');
      localStorage.setItem('bsp_hs_added', '1');
    });

    document.getElementById('hs-dismiss-btn').addEventListener('click', () => {
      banner.classList.remove('hs-visible');
      localStorage.setItem('bsp_hs_dismissed', Date.now().toString());
    });
  }

  // Home-screen methods exist on the WebApp object even on old clients but
  // throw WebAppMethodUnsupported when called (requires Bot API 8.0+).
  if (typeof tg.isVersionAtLeast === 'function' && !tg.isVersionAtLeast('8.0')) return;

  if (typeof tg.checkHomeScreenStatus === 'function') {
    try {
      tg.checkHomeScreenStatus(status => {
        if (status === 'added') { localStorage.setItem('bsp_hs_added', '1'); return; }
        if (status === 'unsupported') return;
        showBanner();
      });
    } catch { /* unsupported despite version check — skip the banner */ }
  } else {
    showBanner();
  }
}

renderRatings();

apiBootstrap().then(async () => {
  apiLoading = false;
  if (apiAvailable) {
    ratingsData = null;
    guestsData = null;
    try { achievementsConfig = await API.achievements.getConfig(); } catch { achievementsConfig = []; }
  } else {
    achievementsConfig = [];
  }
  renderRatings(); // replace skeleton with real data or offline state

  // Re-render results if visible (bootstrap may have completed while user was on that tab)
  if (currentTab === 'results') {
    tournamentsData = null;
    renderResults();
  }

  updateMemberCount();

  const startParam = tg?.initDataUnsafe?.start_param;
  if (startParam && startParam.startsWith('tournament_')) {
    await handleTournamentDeepLink(startParam.replace('tournament_', ''));
  } else if (startParam && startParam.startsWith('join_')) {
    const parts = startParam.replace('join_', '').split('_');
    if (parts.length === 2) await handlePairJoinDeepLink(parts[0], parts[1]);
  }

  if (!localStorage.getItem('bsp_intro_seen')) {
    initOnboarding();
  }
  // Show Raketo link banner on every app open until the user links their account
  initRaketoLinkBanner();

  initHomescreenBanner();
});
