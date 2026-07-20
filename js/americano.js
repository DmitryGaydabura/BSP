/* ════════════════════════════════════════════════════════════════
   AMERICANO — дружні та офіційні турніри-американо
   Створення відкрите всім користувачам; дружні не впливають на рейтинг.
════════════════════════════════════════════════════════════════ */

let americanoState = null;        // AmericanoDto from the backend
let americanoTournamentId = null;
let editingAmericanoId = null;
let americanoDirectory = null;    // cached /users/directory for the add-picker
let amSelectedFormat = 'CLASSIC'; // 'CLASSIC' | 'TEAM_AMERICANO' | 'WINNERS_COURT' — selected in the shared create/edit modal

const AM_SIZES  = [4, 8, 12, 16];
const AM_POINTS_CLASSIC = [16, 21, 24, 32];
// Winner's Court needs a decisive winner every match — an even total allows an exact-half tie.
const AM_POINTS_WC = [15, 21, 25, 31];

function isAmericanoManager(t) {
  return !!(currentUser && (currentUser.role === 'ADMIN'
      || t.createdById === currentUser.id));
}

/* ── Create / edit modal ─────────────────────────────────────────── */

function populateAmTimeSelect() {
  const sel = document.getElementById('am-time');
  if (!sel || sel.options.length > 1) return;
  let opts = '<option value="">—</option>';
  for (let h = 0; h < 24; h++) {
    const hh = String(h).padStart(2, '0') + ':00';
    opts += `<option value="${hh}">${hh}</option>`;
  }
  sel.innerHTML = opts;
}

function amToggleAdminSection() {
  const isAdmin = currentUser?.role === 'ADMIN';
  document.getElementById('am-admin-section').style.display = isAdmin ? '' : 'none';
  amToggleRatingInputs();
}

/** "Official" (admin-only) and "affects rating" are independent — official always affects
    rating, so the separate rating-choice checkbox only makes sense for friendly tournaments. */
function amToggleRatingInputs() {
  const isAdmin = currentUser?.role === 'ADMIN';
  const official = isAdmin && document.getElementById('am-official').checked;
  document.getElementById('am-rating-row').style.display = official ? 'flex' : 'none';
  document.getElementById('am-rating-toggle-row').style.display = official ? 'none' : '';
}

/** Winner's Court needs an odd points-per-match total so an exact-half tie is impossible. */
function amPopulatePointsOptions() {
  const sel = document.getElementById('am-points');
  const opts = amSelectedFormat === 'WINNERS_COURT' ? AM_POINTS_WC : AM_POINTS_CLASSIC;
  const current = parseInt(sel.value, 10);
  sel.innerHTML = opts.map(p => `<option value="${p}">${p}</option>`).join('');
  sel.value = opts.includes(current) ? String(current) : String(opts[1]);
}

function amUpdateRoundsHint() {
  const n = parseInt(document.getElementById('am-max-participants').value, 10);
  const input = document.getElementById('am-rounds');
  const hint = document.getElementById('am-rounds-hint');
  if (amSelectedFormat === 'WINNERS_COURT') {
    const courts = n / 4;
    input.placeholder = "обов'язково";
    hint.textContent = `Драбина з ${courts} корт${courts === 1 ? 'ом' : 'ами'} — переможці підіймаються на вищий корт, переможені опускаються.`;
  } else if (amSelectedFormat === 'TEAM_AMERICANO') {
    const teams = n / 2;
    input.placeholder = `авто (${teams - 1})`;
    hint.textContent = `${teams} команди по 2 гравці. За замовчуванням ${teams - 1} раунд${teams - 1 === 1 ? '' : 'ів'} — кожна команда грає з кожною рівно 1 раз.`;
  } else {
    input.placeholder = `авто (${n - 1})`;
    hint.textContent = `За замовчуванням ${n - 1} раундів — кожен гравець у парі з кожним рівно 1 раз.`;
  }
}

const AM_FORMAT_HINTS = {
  CLASSIC: 'Класичний американо: кожен гравець грає в парі з кожним іншим рівно по одному разу.',
  TEAM_AMERICANO: 'Командний американо: фіксовані пари на весь турнір; команди грають одна проти одної (реєстрація через запрошення партнера, як у парному).',
  WINNERS_COURT: "Winner's Court: переможці рухаються на вищий корт, переможені — на нижчий; партнер попереднього раунду стає суперником.",
};

/** Switch the shared create/edit modal between the three americano formats. */
function amSetFormat(format) {
  amSelectedFormat = format;
  document.getElementById('am-format-classic').classList.toggle('am-format-active', format === 'CLASSIC');
  document.getElementById('am-format-team').classList.toggle('am-format-active', format === 'TEAM_AMERICANO');
  document.getElementById('am-format-wc').classList.toggle('am-format-active', format === 'WINNERS_COURT');
  document.getElementById('am-format-hint').textContent = AM_FORMAT_HINTS[format] || AM_FORMAT_HINTS.CLASSIC;
  amPopulatePointsOptions();
  amUpdateRoundsHint();
}

/** Format can't change once a tournament exists — lock the toggle while editing. */
function amLockFormatToggle(locked) {
  document.getElementById('am-format-classic').disabled = locked;
  document.getElementById('am-format-team').disabled = locked;
  document.getElementById('am-format-wc').disabled = locked;
  document.getElementById('am-format-row').style.opacity = locked ? '0.55' : '';
}

document.getElementById('am-format-classic').addEventListener('click', () => amSetFormat('CLASSIC'));
document.getElementById('am-format-team').addEventListener('click', () => amSetFormat('TEAM_AMERICANO'));
document.getElementById('am-format-wc').addEventListener('click', () => amSetFormat('WINNERS_COURT'));

// Fill the americano level selects from the shared levels cache (analysis-admin.js)
async function amPopulateLevelSelects() {
  await loadTournamentLevels();
  const opts = tournamentLevels.map(l =>
    `<option value="${l.value}">${l.label}</option>`).join('');
  document.getElementById('am-level').innerHTML = opts;
  document.getElementById('am-level-max').innerHTML = opts;
}

async function openCreateAmericano() {
  if (!currentUser) { showToast('Увійдіть через Telegram, щоб створити турнір', 'error'); return; }
  editingAmericanoId = null;
  amLockFormatToggle(false);
  amSetFormat('CLASSIC');
  document.querySelector('#modal-create-americano .modal-title').textContent = 'Новий турнір';
  document.getElementById('am-submit').textContent = 'Створити';
  document.getElementById('am-name').value = '';
  document.getElementById('am-date').value = '';
  populateAmTimeSelect();
  document.getElementById('am-time').value = '';
  document.getElementById('am-location').value = '';
  document.getElementById('am-price').value = '';
  document.getElementById('am-max-participants').value = '8';
  document.getElementById('am-points').value = '24';
  document.getElementById('am-rounds').value = '';
  document.getElementById('am-private').checked = false;
  document.getElementById('am-entry-all').checked = false;
  document.getElementById('am-rating-enabled').checked = false;
  document.getElementById('am-official').checked = false;
  document.getElementById('am-min-rating').value = '';
  document.getElementById('am-max-rating').value = '';
  document.getElementById('am-description').value = '';
  amToggleAdminSection();
  amUpdateRoundsHint();
  openModal('modal-create-americano');
  await amPopulateLevelSelects();
  document.getElementById('am-level').value = 'D';
  document.getElementById('am-level-max').value = 'D';
}

async function openEditAmericano(t) {
  editingAmericanoId = t.id;
  const fmtType = t.type === 'WINNERS_COURT' ? 'WINNERS_COURT'
                : t.type === 'TEAM_AMERICANO' ? 'TEAM_AMERICANO' : 'CLASSIC';
  amSetFormat(fmtType);
  amLockFormatToggle(true);
  document.querySelector('#modal-create-americano .modal-title').textContent =
      fmtType === 'WINNERS_COURT' ? "Редагувати Winner's Court"
      : fmtType === 'TEAM_AMERICANO' ? 'Редагувати командне американо'
      : 'Редагувати американо';
  document.getElementById('am-submit').textContent = 'Зберегти';
  populateAmTimeSelect();
  document.getElementById('am-name').value = t.name || '';
  document.getElementById('am-date').value = t.date || '';
  document.getElementById('am-time').value = t.time ? t.time.slice(0, 2) + ':00' : '';
  document.getElementById('am-location').value = t.location || '';
  document.getElementById('am-price').value = t.price || '';
  document.getElementById('am-max-participants').value = String(t.maxParticipants || 8);
  document.getElementById('am-points').value = String(t.pointsPerMatch || 24);
  document.getElementById('am-rounds').value = t.roundsCount || '';
  document.getElementById('am-private').checked = !!t.isPrivate;
  document.getElementById('am-entry-all').checked = t.resultEntryMode === 'ALL_PARTICIPANTS';
  document.getElementById('am-rating-enabled').checked = !!t.ratingEnabled;
  document.getElementById('am-official').checked = !t.friendly;
  document.getElementById('am-min-rating').value = t.minRating || '';
  document.getElementById('am-max-rating').value = t.maxRating || '';
  document.getElementById('am-description').value = t.description || '';
  amToggleAdminSection();
  amUpdateRoundsHint();
  openModal('modal-create-americano');
  await amPopulateLevelSelects();
  document.getElementById('am-level').value = t.level || 'D';
  document.getElementById('am-level-max').value = t.levelMax || t.level || 'D';
}

document.getElementById('am-max-participants').addEventListener('change', amUpdateRoundsHint);
document.getElementById('am-official').addEventListener('change', amToggleRatingInputs);

document.getElementById('am-submit').addEventListener('click', async () => {
  const name = document.getElementById('am-name').value.trim();
  const date = document.getElementById('am-date').value;
  if (!name || !date) { showToast('Вкажіть назву та дату', 'error'); return; }

  const isWc = amSelectedFormat === 'WINNERS_COURT';
  const isTeam = amSelectedFormat === 'TEAM_AMERICANO';
  const roundsCount = parseInt(document.getElementById('am-rounds').value) || null;
  if (isWc && !roundsCount) {
    showToast("Вкажіть кількість раундів для Winner's Court", 'error');
    return;
  }

  const isAdmin  = currentUser?.role === 'ADMIN';
  const official = isAdmin && document.getElementById('am-official').checked;
  const payload = {
    name, date,
    // Only the americano endpoint understands `type`; omit it for Winner's Court.
    type:            isWc ? undefined : (isTeam ? 'TEAM_AMERICANO' : 'AMERICANO'),
    level:           document.getElementById('am-level').value || null,
    levelMax:        document.getElementById('am-level-max').value
                       || document.getElementById('am-level').value || null,
    time:            document.getElementById('am-time').value || null,
    location:        document.getElementById('am-location').value.trim() || null,
    price:           parseInt(document.getElementById('am-price').value) || null,
    maxParticipants: parseInt(document.getElementById('am-max-participants').value, 10),
    pointsPerMatch:  parseInt(document.getElementById('am-points').value, 10),
    roundsCount,
    isPrivate:       document.getElementById('am-private').checked,
    resultEntryMode: document.getElementById('am-entry-all').checked ? 'ALL_PARTICIPANTS' : 'CREATOR_ONLY',
    friendly:        !official,
    ratingEnabled:   official || document.getElementById('am-rating-enabled').checked,
    minRating:       official ? (parseInt(document.getElementById('am-min-rating').value) || null) : null,
    maxRating:       official ? (parseInt(document.getElementById('am-max-rating').value) || null) : null,
    description:     document.getElementById('am-description').value.trim() || null,
  };

  const api = isWc ? API.winnersCourt : API.americano;
  const btn = document.getElementById('am-submit');
  btn.disabled = true; btn.textContent = '...';
  try {
    if (editingAmericanoId) {
      await api.update(editingAmericanoId, payload);
      showToast('Турнір оновлено', 'success');
    } else {
      await api.create(payload);
      showToast(isWc ? "Winner's Court створено! 🎾"
              : isTeam ? 'Командне американо створено! 👥' : 'Американо створено! 🎾', 'success');
    }
    tournamentsData = null;
    closeModal('modal-create-americano');
    renderResults();
  } catch (e) {
    showToast('Помилка: ' + (e.data?.message || e.message || 'unknown'), 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = editingAmericanoId ? 'Зберегти' : 'Створити';
  }
});

/* ── Detail modal: rounds, score entry, standings ────────────────── */

async function openAmericanoModal(tournamentId) {
  americanoTournamentId = tournamentId;
  const body  = document.getElementById('americano-modal-body');
  const title = document.getElementById('americano-modal-title');
  const t = (tournamentsData || []).find(x => String(x.id) === String(tournamentId));
  title.textContent = t ? t.name : 'Американо';
  body.innerHTML = '<div style="text-align:center;padding:30px;color:var(--text-muted)">Завантаження...</div>';
  openModal('modal-americano');
  try {
    americanoState = await API.americano.get(tournamentId);
    renderAmericanoModal();
  } catch (e) {
    body.innerHTML = `<div style="color:var(--error);padding:20px;text-align:center">Помилка: ${esc(e.data?.message || e.message)}</div>`;
  }
}

function amTeamNames(team) {
  return team.map(p => `<span class="tp-name-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${jsq(p.displayName || '?')}')">${esc(p.displayName || '?')}</span>`)
             .join('<span class="am-team-sep"> / </span>');
}

function renderAmericanoModal() {
  const st = americanoState;
  if (!st) return;
  const body = document.getElementById('americano-modal-body');
  const t = (tournamentsData || []).find(x => String(x.id) === String(americanoTournamentId));
  const allMatches = (st.rounds || []).flatMap(r => r.matches);
  const allPlayed  = allMatches.length > 0 && allMatches.every(m => m.played);

  let html = '';

  // Config summary
  html += `<div class="am-config">
    ${!st.friendly ? '<span class="friendly-badge fb-official">Офіційний · з рейтингом</span>'
        : st.ratingEnabled ? '<span class="friendly-badge">Дружній · з рейтингом</span>'
        : '<span class="friendly-badge">Дружній · без рейтингу</span>'}
    ${st.isPrivate ? '<span class="friendly-badge fb-private">🔒 Приватний</span>' : ''}
    <span class="am-config-chip">🎯 ${st.pointsPerMatch} очок/матч</span>
    ${st.roundsCount ? `<span class="am-config-chip">🔄 ${st.roundsCount} раундів</span>` : ''}
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
      html += `<button class="btn-secondary" id="am-add-participant-btn" style="width:100%;margin-top:8px">+ Додати учасника</button>`;
      const okCount = AM_SIZES.includes(parts.length);
      html += `<button class="btn-primary" id="am-start-btn" style="width:100%;margin-top:8px" ${okCount ? '' : 'disabled'}>
        ▶ Запустити американо${okCount ? '' : ` (потрібно 4, 8, 12 або 16 гравців)`}
      </button>`;
    } else {
      html += `<div class="am-empty" style="margin-top:8px">Розклад раундів з'явиться після старту</div>`;
    }
  }

  // Rounds with courts and score entry
  if (st.rounds && st.rounds.length) {
    html += `<div class="cup-section-title" style="margin-top:14px">Раунди</div>`;
    st.rounds.forEach(r => {
      html += `<div class="am-round">
        <div class="am-round-title">Раунд ${r.roundNumber}</div>
        ${r.matches.map(m => {
          const canEnter = st.canEnterResults && st.status === 'ACTIVE';
          const score = m.played
              ? `<span class="am-score ${m.score1 > m.score2 ? 'am-score-a' : m.score2 > m.score1 ? 'am-score-b' : ''}">${m.score1}:${m.score2}</span>`
              : '<span class="am-score am-score-empty">—:—</span>';
          return `<div class="am-match-row">
            <span class="am-court">Корт ${m.court}</span>
            <div class="am-teams">
              <div class="am-team${m.played && m.score1 > m.score2 ? ' am-team-won' : ''}">${amTeamNames(m.teamA)}</div>
              <div class="am-vs">проти</div>
              <div class="am-team${m.played && m.score2 > m.score1 ? ' am-team-won' : ''}">${amTeamNames(m.teamB)}</div>
            </div>
            <div class="am-match-right">
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

  // Standings — team americano groups both partners into one row
  if (st.teamStandings && st.teamStandings.length) {
    const anyPlayed = st.teamStandings.some(s => s.matchesPlayed > 0);
    const iAmIn = s => currentUser && (s.players || []).some(p => p.id === currentUser.id);
    html += `<div class="cup-section-title" style="margin-top:14px">Таблиця команд${anyPlayed ? '' : ' (матчі ще не зіграні)'}</div>`;
    html += `<div class="am-standings">
      <div class="am-st-head"><span></span><span>Команда</span><span>В–П</span><span>Очки</span></div>
      ${st.teamStandings.map(s => `
        <div class="am-st-row${iAmIn(s) ? ' am-st-me' : ''}">
          <span class="am-st-pos pos-${s.position}">${s.position}</span>
          <span class="am-st-name">${amTeamNames(s.players || [])}</span>
          <span class="am-st-wl">${s.wins}–${s.losses}</span>
          <span class="am-st-pts">${s.points}</span>
        </div>`).join('')}
    </div>`;
  } else if (st.standings && st.standings.length) {
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
    const anyPlayed = allMatches.some(m => m.played);
    if (!anyPlayed) {
      html += `<button class="btn-secondary" id="am-restart-btn" style="width:100%;margin-top:12px">🔄 Перегенерувати розклад</button>`;
    }
    html += `<button class="btn-primary" id="am-finalize-btn" style="width:100%;margin-top:8px;background:linear-gradient(135deg,var(--success),#2a8a55)" ${allPlayed ? '' : 'disabled'}>
      ✓ ${st.ratingEnabled ? 'Завершити та нарахувати рейтинг' : 'Завершити турнір'}${allPlayed ? '' : ' (не всі матчі зіграні)'}
    </button>`;
  }

  body.innerHTML = html;

  // Wire score entry
  body.querySelectorAll('.am-enter-btn').forEach(btn => {
    btn.addEventListener('click', () => openAmericanoScoreModal(btn.dataset));
  });

  // Wire roster management
  body.querySelectorAll('.am-part-remove').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!(await uiConfirm('Прибрати гравця з турніру?'))) return;
      btn.disabled = true;
      try {
        await API.americano.removeParticipant(americanoTournamentId, btn.dataset.uid);
        await amRefresh();
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        btn.disabled = false;
      }
    });
  });
  const addBtn = body.querySelector('#am-add-participant-btn');
  if (addBtn) addBtn.addEventListener('click', openAmericanoAddPicker);

  // Wire start / restart
  const startBtn = body.querySelector('#am-start-btn');
  if (startBtn) startBtn.addEventListener('click', () => amStart(startBtn, false));
  const restartBtn = body.querySelector('#am-restart-btn');
  if (restartBtn) restartBtn.addEventListener('click', () => amStart(restartBtn, true));

  // Wire finalize
  const finalizeBtn = body.querySelector('#am-finalize-btn');
  if (finalizeBtn) finalizeBtn.addEventListener('click', async () => {
    const msg = americanoState.ratingEnabled
        ? 'Завершити турнір та нарахувати рейтинг?'
        : 'Завершити турнір? Результати буде зафіксовано (рейтинг не зміниться).';
    if (!(await uiConfirm(msg))) return;
    finalizeBtn.disabled = true;
    try {
      americanoState = await API.americano.finalize(americanoTournamentId);
      tournamentsData = null;
      renderAmericanoModal();
      showToast(americanoState.ratingEnabled ? 'Турнір завершено! Рейтинг нараховано 🏆' : 'Турнір завершено! 🎾', 'success');
    } catch (e) {
      showToast(e.data?.message || e.message || 'Помилка', 'error');
      finalizeBtn.disabled = false;
    }
  });
}

async function amStart(btn, isRestart) {
  if (isRestart && !(await uiConfirm('Перегенерувати розклад раундів?'))) return;
  btn.disabled = true;
  try {
    americanoState = await API.americano.start(americanoTournamentId);
    tournamentsData = null;
    renderResults();
    renderAmericanoModal();
    showToast('Розклад згенеровано! 🎾', 'success');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
    btn.disabled = false;
  }
}

/** Refetch both the tournament list (roster) and the americano state, then re-render. */
async function amRefresh() {
  tournamentsData = null;
  await renderResults();
  americanoState = await API.americano.get(americanoTournamentId);
  renderAmericanoModal();
}

/* ── Score entry modal ───────────────────────────────────────────── */

let amScoreMatchId = null;

function openAmericanoScoreModal(ds) {
  amScoreMatchId = ds.mid;
  const total = americanoState.pointsPerMatch;
  document.getElementById('am-score-teama').textContent = ds.ta;
  document.getElementById('am-score-teamb').textContent = ds.tb;
  document.getElementById('am-score-hint').textContent = `Сума очок має дорівнювати ${total}`;
  const in1 = document.getElementById('am-score-1');
  const in2 = document.getElementById('am-score-2');
  in1.max = total; in2.max = total;
  in1.value = ds.s1 || '';
  in2.value = ds.s2 || '';
  openModal('modal-americano-score');
  setTimeout(() => in1.focus(), 150);
}

// Auto-complete the second score: teams always split pointsPerMatch between them
document.getElementById('am-score-1').addEventListener('input', () => {
  const total = americanoState?.pointsPerMatch || 0;
  const v = parseInt(document.getElementById('am-score-1').value, 10);
  if (!isNaN(v) && v >= 0 && v <= total) {
    document.getElementById('am-score-2').value = total - v;
  }
});

document.getElementById('am-score-submit').addEventListener('click', async () => {
  const s1 = parseInt(document.getElementById('am-score-1').value, 10);
  const s2 = parseInt(document.getElementById('am-score-2').value, 10);
  const total = americanoState?.pointsPerMatch || 0;
  if (isNaN(s1) || isNaN(s2) || s1 < 0 || s2 < 0 || s1 + s2 !== total) {
    showToast(`Сума очок має дорівнювати ${total}`, 'error');
    return;
  }
  const btn = document.getElementById('am-score-submit');
  btn.disabled = true;
  try {
    americanoState = await API.americano.submitMatch(americanoTournamentId, amScoreMatchId, { score1: s1, score2: s2 });
    closeModal('modal-americano-score');
    renderAmericanoModal();
    showToast('Рахунок збережено', 'success');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
  } finally {
    btn.disabled = false;
  }
});

/* ── Add-participant picker (creator-managed roster) ─────────────── */

async function openAmericanoAddPicker() {
  const listEl = document.getElementById('am-picker-list');
  listEl.innerHTML = '<div class="am-empty">Завантаження...</div>';
  document.getElementById('am-picker-search').value = '';
  openModal('modal-americano-add');
  try {
    if (!americanoDirectory) americanoDirectory = await API.users.directory();
    renderAmericanoPicker('');
  } catch (e) {
    listEl.innerHTML = `<div class="am-empty">Помилка: ${esc(e.message)}</div>`;
  }
}

function renderAmericanoPicker(query) {
  const listEl = document.getElementById('am-picker-list');
  const t = (tournamentsData || []).find(x => String(x.id) === String(americanoTournamentId));
  const enrolled = new Set([...(t?.participants || []), ...(t?.reserveParticipants || [])].map(p => p.id));
  const q = query.trim().toLowerCase();
  const matches = (americanoDirectory || [])
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
        await API.americano.addParticipant(americanoTournamentId, row.dataset.uid);
        closeModal('modal-americano-add');
        showToast('Гравця додано', 'success');
        await amRefresh();
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        row.style.pointerEvents = '';
      }
    });
  });
}

document.getElementById('am-picker-search').addEventListener('input', e => renderAmericanoPicker(e.target.value));

/* The "create americano" button lives in the Profile tab (rendered by renderProfile,
   wired via inline onclick="openCreateAmericano()"). */
