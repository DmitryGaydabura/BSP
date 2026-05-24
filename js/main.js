/* ── First-visit onboarding ────────────────────────────────────── */
const _ob = (() => {
  const overlay = document.getElementById('onboarding-overlay');
  const slides = Array.from(overlay.querySelectorAll('.ob-slide'));
  const dots = Array.from(overlay.querySelectorAll('.ob-dot'));
  const btnPrev = document.getElementById('ob-prev');
  const btnNext = document.getElementById('ob-next');
  const btnSkip = document.getElementById('ob-skip');
  let current = 0;

  function goTo(idx) {
    const leaving = current;
    slides[leaving].classList.remove('ob-active');
    slides[leaving].classList.add('ob-prev');
    setTimeout(() => slides[leaving].classList.remove('ob-prev'), 300);
    dots[leaving].classList.remove('ob-dot-active');
    current = idx;
    slides[current].classList.add('ob-active');
    dots[current].classList.add('ob-dot-active');
    btnPrev.style.visibility = current === 0 ? 'hidden' : '';
    btnNext.textContent = current === slides.length - 1 ? 'Почати' : 'Далі';
  }

  function dismiss() {
    localStorage.setItem('bsp_intro_seen', '1');
    overlay.classList.add('ob-hidden');
  }

  btnNext.addEventListener('click', () => {
    if (current < slides.length - 1) goTo(current + 1);
    else dismiss();
  });
  btnPrev.addEventListener('click', () => { if (current > 0) goTo(current - 1); });
  btnSkip.addEventListener('click', dismiss);
  dots.forEach((d, i) => d.addEventListener('click', () => goTo(i)));

  let touchStartX = 0;
  overlay.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
  overlay.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - touchStartX;
    if (Math.abs(dx) > 50) {
      if (dx < 0 && current < slides.length - 1) goTo(current + 1);
      else if (dx > 0 && current > 0) goTo(current - 1);
    }
  }, { passive: true });

  return {
    show() {
      slides.forEach(s => s.classList.remove('ob-active', 'ob-prev'));
      dots.forEach(d => d.classList.remove('ob-dot-active'));
      current = 0;
      slides[0].classList.add('ob-active');
      dots[0].classList.add('ob-dot-active');
      btnPrev.style.visibility = 'hidden';
      btnNext.textContent = slides.length === 1 ? 'Почати' : 'Далі';
      overlay.classList.remove('ob-hidden');
    },
  };
})();

function initOnboarding() { _ob.show(); }

/* ── Telegram WebApp init ──────────────────────────────────────── */
const tg = window.Telegram?.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
  tg.setHeaderColor('#0D1B2E');
  tg.setBackgroundColor('#0D1B2E');
}

/* ── App state ─────────────────────────────────────────────────── */
let currentUser = null;   // UserDto from API when logged in
let apiAvailable = false; // whether the backend responded

/* ════════════════════════════════════════════════════════════════
   FALLBACK DATA (used when API is unavailable)
════════════════════════════════════════════════════════════════ */

const TOURNAMENTS = [
  {
    id: 1,
    name: 'Blacksea Open — Весна 2026',
    date: '2026-04-12',
    year: '2026',
    category: 'open',
    categoryLabel: 'Open',
    results: [
      { pos: 1, pair: ['Oleksandr Koval', 'Dmytro Melnyk'],   score: '6–3  6–4', pts: 100 },
      { pos: 2, pair: ['Ivan Petrenko', 'Mykola Bondar'],     score: '3–6  4–6', pts: 60  },
      { pos: 3, pair: ['Artem Shevchenko', 'Vasyl Tkachuk'], score: '6–4  4–6  10–7', pts: 40  },
      { pos: 4, pair: ['Serhiy Levchenko', 'Andriy Hrytsenko'], score: '',      pts: 30  },
    ],
  },
  {
    id: 2,
    name: 'Mixed Doubles Cup — Зима 2026',
    date: '2026-02-08',
    year: '2026',
    category: 'mixed',
    categoryLabel: 'Mixed',
    results: [
      { pos: 1, pair: ['Oleksiy Savchenko', 'Kateryna Mova'],   score: '6–2  6–3', pts: 100 },
      { pos: 2, pair: ['Volodymyr Kravets', 'Yulia Bondarenko'], score: '2–6  3–6', pts: 60  },
      { pos: 3, pair: ['Roman Marchenko', 'Iryna Kovalenko'],   score: '6–3  3–6  10–5', pts: 40  },
      { pos: 4, pair: ['Pavlo Sydorenko', 'Natalia Rudenko'],   score: '',        pts: 30  },
    ],
  },
  {
    id: 3,
    name: 'Blacksea Cup — Осінь 2025',
    date: '2025-10-19',
    year: '2025',
    category: 'open',
    categoryLabel: 'Open',
    results: [
      { pos: 1, pair: ['Dmytro Melnyk', 'Artem Shevchenko'],   score: '7–5  6–4', pts: 100 },
      { pos: 2, pair: ['Oleksandr Koval', 'Vasyl Tkachuk'],    score: '5–7  4–6', pts: 60  },
      { pos: 3, pair: ['Ivan Petrenko', 'Serhiy Levchenko'],   score: '6–2  6–1', pts: 40  },
      { pos: 4, pair: ['Mykola Bondar', 'Andriy Hrytsenko'],   score: '',         pts: 30  },
    ],
  },
  {
    id: 4,
    name: 'Літній Open — Одеса 2025',
    date: '2025-07-05',
    year: '2025',
    category: 'open',
    categoryLabel: 'Open',
    results: [
      { pos: 1, pair: ['Oleksandr Koval', 'Oleksiy Savchenko'], score: '6–4  7–6', pts: 100 },
      { pos: 2, pair: ['Dmytro Melnyk', 'Ivan Petrenko'],        score: '4–6  6–7', pts: 60  },
      { pos: 3, pair: ['Roman Marchenko', 'Pavlo Sydorenko'],    score: '6–3  6–2', pts: 40  },
      { pos: 4, pair: ['Vasyl Tkachuk', 'Mykola Bondar'],        score: '',          pts: 30  },
    ],
  },
];

const RATINGS = [
  /* name, pts, wins, losses, change('+1'/'-2'/'='), cat */
  { name: 'Oleksandr Koval',      pts: 580, wins: 24, losses:  6, change: '=',  cat: ['all','men'] },
  { name: 'Dmytro Melnyk',        pts: 520, wins: 21, losses:  8, change: '+1', cat: ['all','men'] },
  { name: 'Oleksiy Savchenko',    pts: 460, wins: 19, losses:  9, change: '-1', cat: ['all','men'] },
  { name: 'Artem Shevchenko',     pts: 410, wins: 17, losses: 11, change: '+2', cat: ['all','men'] },
  { name: 'Ivan Petrenko',        pts: 370, wins: 15, losses: 12, change: '=',  cat: ['all','men'] },
  { name: 'Kateryna Mova',        pts: 340, wins: 14, losses:  8, change: '+1', cat: ['all','women'] },
  { name: 'Vasyl Tkachuk',        pts: 320, wins: 13, losses: 14, change: '-1', cat: ['all','men'] },
  { name: 'Yulia Bondarenko',     pts: 290, wins: 12, losses:  9, change: '+3', cat: ['all','women'] },
  { name: 'Roman Marchenko',      pts: 260, wins: 11, losses: 15, change: '=',  cat: ['all','men'] },
  { name: 'Mykola Bondar',        pts: 240, wins: 10, losses: 16, change: '-1', cat: ['all','men'] },
  { name: 'Iryna Kovalenko',      pts: 220, wins:  9, losses: 10, change: '+1', cat: ['all','women'] },
  { name: 'Serhiy Levchenko',     pts: 200, wins:  8, losses: 17, change: '=',  cat: ['all','men'] },
  { name: 'Andriy Hrytsenko',     pts: 175, wins:  7, losses: 18, change: '-2', cat: ['all','men'] },
  { name: 'Volodymyr Kravets',    pts: 155, wins:  6, losses: 14, change: '+1', cat: ['all','men'] },
  { name: 'Natalia Rudenko',      pts: 140, wins:  6, losses: 12, change: '=',  cat: ['all','women'] },
  { name: 'Pavlo Sydorenko',      pts: 120, wins:  5, losses: 16, change: '-1', cat: ['all','men'] },
];

/* ════════════════════════════════════════════════════════════════
   API BOOTSTRAP — auto-login on startup
════════════════════════════════════════════════════════════════ */

async function apiBootstrap() {
  // Try to restore session from stored token
  if (API.isAuthenticated()) {
    try {
      currentUser = await API.users.me();
      apiAvailable = true;
      return;
    } catch (e) {
      if (e.status === 401) API.removeToken();
    }
  }

  // Try to authenticate with Telegram initData
  const initData = tg?.initData;
  if (initData) {
    try {
      const res = await API.auth.loginWithTelegram(initData);
      API.setToken(res.token);
      currentUser = res.user;
      apiAvailable = true;
    } catch {
      // Backend unavailable or invalid — continue with mock data
    }
  }

  // Test if API is reachable at all
  if (!apiAvailable) {
    try {
      await API.tournaments.list();
      apiAvailable = true;
    } catch { /* offline */ }
  }
}

/* ════════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════════ */

function fmt(date) {
  const d = new Date(date);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

function ratioClass(wins, losses) {
  const total = wins + losses;
  if (!total) return 'ratio-mid';
  const r = wins / total;
  if (r >= 0.65) return 'ratio-high';
  if (r >= 0.40) return 'ratio-mid';
  return 'ratio-low';
}

function pct(wins, losses) {
  const total = wins + losses;
  if (!total) return '—';
  return Math.round((wins / total) * 100) + '%';
}

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

  const statusLabel = { DRAFT: 'Реєстрація', ACTIVE: 'Активний', FINISHED: 'Завершено' };
  const statusCls   = { DRAFT: 't-status-draft', ACTIVE: 't-status-active', FINISHED: 't-status-done' };

  list.innerHTML = filtered.map(t => {
    const confirmed   = t.participants || [];
    const reserve     = t.reserveParticipants || [];
    const isEnrolled  = currentUser && [...confirmed, ...reserve].some(p => p.id === currentUser.id);
    const isInReserve = currentUser && reserve.some(p => p.id === currentUser.id);
    const canJoin     = currentUser && (t.status === 'DRAFT' || t.status === 'ACTIVE');
    const isFull      = t.maxParticipants && (t.participantCount || 0) >= t.maxParticipants;

    const ratingRange = [
      t.minRating ? `від ${t.minRating}` : '',
      t.maxRating ? `до ${t.maxRating}` : '',
    ].filter(Boolean).join('–');

    const reserveCount = reserve.length;
    const participantsInfo = t.maxParticipants
      ? `${t.participantCount || 0}/${t.maxParticipants} уч.${reserveCount ? ` · +${reserveCount} резерв` : ''}`
      : (t.participantCount ? `${t.participantCount} уч.${reserveCount ? ` · +${reserveCount} резерв` : ''}` : '');
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : 'Парний';

    const enrolledBadge = isEnrolled
      ? `<span class="chip-btn ${isInReserve ? 'chip-reserve' : 'chip-join'}" style="pointer-events:none">${isInReserve ? 'Резерв' : 'Зареєстровано'}</span>`
      : '';

    const joinBtn = canJoin
      ? (isEnrolled
          ? enrolledBadge
          : `<button class="chip-btn chip-join sr-join-btn" data-id="${t.id}">${isFull ? 'У резерв' : 'Приєднатись'}</button>`)
      : '';

    const priceLabel = t.price ? `${t.price} грн` : 'безкоштовно';
    const nameOf = p => [p.firstName, p.lastName].filter(Boolean).join(' ') || p.displayName || p.username || 'Гравець';

    const participantsList = confirmed.length > 0
      ? `<div class="tournament-participants-list">
          <div class="tp-label">Учасники</div>
          <div class="tp-names">${confirmed.map(p => `<span class="tp-name">${nameOf(p)}</span>`).join('')}</div>
        </div>`
      : '';

    const reserveList = reserve.length > 0
      ? `<div class="tournament-participants-list reserve-section">
          <div class="tp-label">Резерв</div>
          <div class="tp-names">${reserve.map(p => `<span class="tp-name tp-reserve">${nameOf(p)}</span>`).join('')}</div>
        </div>`
      : '';

    return `
      <div class="tournament-card" data-tournament-id="${t.id}">
        <div class="tournament-card-header">
          <div class="tournament-meta">
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">
              <div class="tournament-name">${t.name}</div>
              ${joinBtn}
            </div>
            <div class="tournament-date-cat">
              <span class="tournament-date">${fmt(t.date)}${t.time ? ' · ' + t.time.slice(0,5) : ''}</span>
              ${t.levelLabel ? `<span class="level-badge level-badge-lg ${levelClass(t.levelLabel)}">${t.levelLabel}</span>` : ''}
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
            ${currentUser?.role === 'ADMIN' ? `
            <div class="t-admin-actions">
              <button class="t-admin-btn t-admin-edit-btn" data-id="${t.id}">Редагувати</button>
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
      const tid = parseInt(btn.dataset.id, 10);
      const tournament = (tournamentsData || []).find(t => t.id === tid);
      if (tournament) showRegistrationConfirm(tournament);
    });
  });

  wireAdminTournamentBtns(list);
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
    const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : 'Парний';

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
              ? `<div class="fp-avatar-duo">${players.map(p => `<div class="fp-avatar lb-row-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${(p.name).replace(/'/g, "&#39;")}')">${fpAvatarHtml(p)}</div>`).join('')}</div>`
              : `<div class="fp-avatar-wrap lb-row-tap" onclick="_tournamentPlayerTap('${players[0].id || ''}','${(players[0].name).replace(/'/g, "&#39;")}')"> ${crown}<div class="fp-avatar">${fpAvatarHtml(players[0])}</div></div>`;
            const names = players.map(p => `<span class="lb-row-tap" style="cursor:pointer" onclick="_tournamentPlayerTap('${p.id || ''}','${(p.name).replace(/'/g, "&#39;")}')">${p.name}</span>`).join('<span class="fp-name-sep"> / </span>');
            return `<div class="fp-place ${cls}">
              ${avatarSection}
              <div class="fp-names">${names}</div>
              ${r.score ? `<div class="fp-score">${r.score}</div>` : ''}
              ${r.pts ? `<div class="fp-pts">+${r.pts}</div>` : ''}
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
            const nameSpans = rPlayers.map(p => `<span class="lb-row-tap" style="cursor:pointer" onclick="_tournamentPlayerTap('${p.id || ''}','${(p.name).replace(/'/g, "&#39;")}')">${p.name}</span>`).join('<span class="separator"> / </span>');
            return `
            <div class="results-row">
              <span class="results-pos pos-${r.pos}">${r.pos}</span>
              <div class="results-pair"><div class="results-pair-names">${nameSpans}</div></div>
              ${r.score ? `<span class="results-score">${r.score}</span>` : (hasScore ? `<span class="results-score-empty"></span>` : '')}
              <span class="results-pts">+${r.pts}</span>
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

    return `<div class="finished-card">
      <div class="finished-card-header">
        <div class="finished-card-name">${t.name}</div>
        <div class="finished-card-meta">
          <span class="tournament-date">${fmt(t.date)}</span>
          ${t.levelLabel ? `<span class="level-badge level-badge-lg ${levelClass(t.levelLabel)}">${t.levelLabel}</span>` : ''}
          <span class="tournament-cat">${typeLabel}</span>
        </div>
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
   RENDER — RATINGS
════════════════════════════════════════════════════════════════ */

let ratingsData = null;
let activeRatingFilter = 'all';

const LEVELS_ORDER = ['D−','D','D+','C−','C','C+','B−','B','B+'];

function normalizeRating(r) {
  const startingPts = r.startingPoints || 0;
  return {
    id: r.userId || r.id,
    name: r.name || r.displayName,
    photoUrl: r.photoUrl || null,
    pts: r.ratingPoints,
    startingPts,
    tournamentPts: (r.ratingPoints || 0) - startingPts,
    wins: r.wins,
    losses: r.losses,
    change: r.rankChange > 0 ? `+${r.rankChange}` : r.rankChange < 0 ? `${r.rankChange}` : '=',
  };
}

function avatarHtml(p, size = 'md') {
  const cls = size === 'sm' ? 'lb-avatar' : 'podium-avatar';
  if (p.photoUrl) {
    return `<img src="${p.photoUrl}" alt="" onerror="this.parentNode.innerHTML='${initials(p.name)}'">`;
  }
  return initials(p.name);
}

function renderLbRow(p, rank, showLevel) {
  const rankCls = rank <= 3 ? `r${rank}` : '';
  const top3cls = rank <= 3 ? 'top3' : '';
  const changeSign = p.change === '=' ? '–' : p.change;
  const changeCls = p.change.startsWith('+') ? 'up' : p.change.startsWith('-') ? 'down' : 'same';
  const lvl = levelFromPoints(p.pts);
  const avatarContent = p.photoUrl
    ? `<img src="${p.photoUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentNode.textContent='${initials(p.name)}'">`
    : initials(p.name);
  return `
    <div class="lb-row ${top3cls} lb-row-tap" onclick="_lbRowTap('${p.id || ''}',${rank})">
      <span class="lb-rank ${rankCls}">${rank <= 3 ? ['①','②','③'][rank-1] : rank}</span>
      <div class="lb-avatar">${avatarContent}</div>
      <div class="lb-name">
        <div class="lb-name-text">${p.name}</div>
        ${showLevel ? `<span class="level-badge level-badge-sm ${levelClass(lvl)}">${lvl}</span>` : ''}
      </div>
      <span class="lb-start">${p.startingPts}</span>
      <span class="lb-trn">${p.tournamentPts >= 0 ? '+' : ''}${p.tournamentPts}</span>
      <span class="lb-pts">${p.pts}</span>
      <span class="lb-change ${changeCls}">${changeSign}</span>
    </div>
  `;
}

function renderPodium(players) {
  if (!players.length) { document.getElementById('podium').innerHTML = ''; return; }
  const top3 = players.slice(0, 3);
  const podiumOrder = [top3[1], top3[0], top3[2]].filter(Boolean);
  const podiumRanks = [2, 1, 3];
  const podiumBlocks = ['pb-2', 'pb-1', 'pb-3'];
  const podiumRankCls = ['pr-2', 'pr-1', 'pr-3'];
  const podiumAvatarCls = ['p2', 'p1', 'p3'];
  const crowns = ['', '★', ''];

  document.getElementById('podium').innerHTML = podiumOrder.map((p, i) => {
    const avatarContent = p.photoUrl
      ? `<img src="${p.photoUrl}" alt="" onerror="this.parentNode.textContent='${initials(p.name)}'">`
      : initials(p.name);
    return `
      <div class="podium-place lb-row-tap" onclick="_lbRowTap('${p.id || ''}',${podiumRanks[i]})">
        <div class="podium-avatar ${podiumAvatarCls[i]}">
          ${crowns[i] ? `<span class="podium-crown">${crowns[i]}</span>` : ''}
          ${avatarContent}
        </div>
        <div class="podium-name">${p.name.split(' ')[0]}<br>${p.name.split(' ')[1] || ''}</div>
        <div class="podium-pts">${p.pts}</div>
        <div class="podium-block ${podiumBlocks[i]}">
          <span class="podium-rank ${podiumRankCls[i]}">${podiumRanks[i]}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function renderRatings() {
  let source = RATINGS;
  if (apiAvailable && ratingsData === null) {
    try {
      ratingsData = (await API.ratings.list()).map(normalizeRating);
    } catch { /* fallback */ }
  }
  if (ratingsData) source = ratingsData;

  const isAll = activeRatingFilter === 'all';
  const filtered = isAll
    ? source
    : source.filter(p => levelFromPoints(p.pts) === activeRatingFilter);

  /* Title */
  document.getElementById('ratings-title').textContent =
    isAll ? 'Рейтинг гравців' : `Рейтинг · ${activeRatingFilter}`;

  /* Podium — only for "all" or when the level group has enough players */
  renderPodium(filtered);

  /* Leaderboard */
  const lbEl = document.getElementById('leaderboard-rows');
  if (isAll) {
    /* All view: group rows by level visually */
    let html = '';
    for (const lvl of [...LEVELS_ORDER].reverse()) {
      const group = filtered.filter(p => levelFromPoints(p.pts) === lvl);
      if (!group.length) continue;
      const lvlCls = levelClass(lvl);
      html += `<div class="lb-level-group-header"><span class="level-badge level-badge-sm ${lvlCls}">${lvl}</span></div>`;
      group.forEach((p, gi) => {
        const globalRank = source.indexOf(p) + 1;
        html += renderLbRow(p, globalRank, false);
      });
    }
    lbEl.innerHTML = html || '<div class="lb-empty-level">Немає даних</div>';
  } else {
    /* Single-level view: rank within that level */
    if (!filtered.length) {
      lbEl.innerHTML = '<div class="lb-empty-level">У цій категорії ще немає гравців</div>';
    } else {
      lbEl.innerHTML = filtered.map((p, i) => renderLbRow(p, i + 1, false)).join('');
    }
  }

  /* Updated date */
  document.getElementById('ratings-updated').textContent =
    'Оновлено: ' + new Date().toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

/* ════════════════════════════════════════════════════════════════
   PLAYER PUBLIC PROFILE
════════════════════════════════════════════════════════════════ */

function _lbRowTap(id, rank) {
  const source = ratingsData || RATINGS;
  const player = id ? source.find(p => String(p.id) === id) : source[rank - 1];
  if (player) openPlayerProfile(player, rank);
}

function _tournamentPlayerTap(id, name) {
  const source = ratingsData || RATINGS;
  const player = (id && source.find(p => String(p.id) === String(id)))
    || source.find(p => p.name === name)
    || { id, name, pts: 0, startingPts: 0, tournamentPts: 0, wins: 0, losses: 0 };
  const rank = source.indexOf(player) + 1 || 0;
  openPlayerProfile(player, rank);
}

function _actRowTap(userId, displayName) {
  const source = ratingsData || RATINGS;
  const player = source.find(p => String(p.id) === String(userId))
    || { id: userId, name: displayName, pts: 0, startingPts: 0, tournamentPts: 0, wins: 0, losses: 0, change: '=' };
  const rank = source.indexOf(player) + 1 || 0;
  openPlayerProfile(player, rank);
}

async function openPlayerProfile(player, rank) {
  const body = document.getElementById('player-profile-body');
  const lvl = levelFromPoints(player.pts);
  const lvlCls = levelClass(lvl);
  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const tier = tierClass(lvl);
  body.innerHTML = `
    <div class="pp-hero ${tier}">
      <div class="pp-avatar">${player.photoUrl
        ? `<img src="${player.photoUrl}" alt="" onerror="this.parentNode.textContent='${initials(player.name)}'">`
        : initials(player.name)}</div>
      <div class="pp-info">
        <div class="pp-name">${player.name}</div>
        <span class="level-badge level-badge-hero ${lvlCls}">${lvl}</span>
        <div class="pp-meta">
          <span class="pp-rank-badge">#${rank} у рейтингу</span>
        </div>
        <div class="pp-stats-compact">
          <div class="pp-stat-c">
            <div class="pp-stat-val">${player.pts}</div>
            <div class="pp-stat-lbl">Рейтинг</div>
          </div>
          <div class="pp-stat-c">
            <div class="pp-stat-val">${player.startingPts}</div>
            <div class="pp-stat-lbl">Старт</div>
          </div>
          <div class="pp-stat-c">
            <div class="pp-stat-val ${player.tournamentPts >= 0 ? 'clr-pos' : 'clr-neg'}">${player.tournamentPts >= 0 ? '+' : ''}${player.tournamentPts}</div>
            <div class="pp-stat-lbl">Турніри</div>
          </div>
          <div class="pp-stat-c" id="pp-act-stat">
            <div class="pp-stat-val" id="pp-act-val">—</div>
            <div class="pp-stat-lbl" id="pp-act-lbl">Активність</div>
          </div>
        </div>
      </div>
    </div>

    <div id="pp-achievements"></div>

    ${total > 0 ? `
    <div class="pp-wl">
      <div class="pp-wl-bar"><div class="pp-wl-fill" style="width:${winPct}%"></div></div>
      <div class="pp-wl-labels">
        <span class="clr-pos">${wins} перемог</span>
        <span class="pp-wl-pct">${winPct}%</span>
        <span class="clr-neg">${losses} поразок</span>
      </div>
    </div>` : ''}

    <div class="rating-chart-card">
      <div class="history-card-title">Прогрес рейтингу</div>
      <div id="pp-chart-body"><div class="history-loading">Завантаження...</div></div>
    </div>
  `;

  openModal('modal-player-profile');

  if (player.id && apiAvailable) {
    const chartBody = document.getElementById('pp-chart-body');
    const actVal = document.getElementById('pp-act-val');
    const actLbl = document.getElementById('pp-act-lbl');

    if (!tournamentsData) {
      try {
        tournamentsData = (await API.tournaments.list()).map(normalizeTournament);
      } catch { /* achievements stay empty */ }
    }
    const achEl = document.getElementById('pp-achievements');
    if (achEl) { achEl.innerHTML = renderAchievements(player.id, player.name); wireAchievements(achEl); }

    const [historyResult, activityResult] = await Promise.allSettled([
      API.users.userHistory(player.id),
      API.activity.monthly(currentYearMonth()),
    ]);

    if (historyResult.status === 'fulfilled') {
      const history = historyResult.value;
      const svg = history?.length >= 1 ? buildRatingChart(history, player.startingPts) : null;
      if (chartBody) chartBody.innerHTML = svg ?? '<div class="history-empty">Немає турнірних результатів</div>';
    } else {
      if (chartBody) chartBody.innerHTML = '<div class="history-empty">Немає турнірних результатів</div>';
    }

    if (activityResult.status === 'fulfilled') {
      const entry = activityResult.value?.find(e => e.userId === player.id);
      if (actVal) actVal.textContent = entry ? entry.activityPoints : '—';
      if (actLbl) actLbl.textContent = entry ? `Активність · #${entry.rank}` : 'Активність';
    }
  }
}

/* ════════════════════════════════════════════════════════════════
   MEMBER COUNT
════════════════════════════════════════════════════════════════ */
async function updateMemberCount() {
  let playerCount = RATINGS.length;
  let tournamentCount = null;
  if (apiAvailable) {
    try {
      const [users, tournaments] = await Promise.all([
        API.users.list().catch(() => []),
        API.tournaments.list().catch(() => []),
      ]);
      if (users.length) playerCount = users.length;
      tournamentCount = tournaments.length;
    } catch {}
  }
  document.getElementById('member-count').textContent = playerCount + '+';
  if (tournamentCount !== null) {
    document.getElementById('tournament-count').textContent = tournamentCount;
  }
}

/* ════════════════════════════════════════════════════════════════
   RENDER — ACTIVITY TAB
════════════════════════════════════════════════════════════════ */

let activityCache = {};      // keyed by YYYY-MM
let activeActivityMonth = currentYearMonth();

function currentYearMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function activityMonthLabel(ym) {
  const [y, m] = ym.split('-');
  return UA_MONTHS[parseInt(m, 10) - 1] + ' ' + y;
}

function buildActivityMonthChips(tournaments) {
  const row = document.getElementById('activity-filter');
  row.innerHTML = '';

  const months = [...new Set(
    tournaments
      .filter(t => t.status === 'FINISHED')
      .map(t => String(t.date).slice(0, 7))
      .filter(Boolean)
  )].sort((a, b) => b.localeCompare(a));

  if (!months.length) {
    row.innerHTML = '<span style="font-size:12px;color:var(--text-muted);padding:4px 0">Немає завершених турнірів</span>';
    activeActivityMonth = '';
    return;
  }

  if (!months.includes(activeActivityMonth)) activeActivityMonth = months[0];

  months.forEach(ym => {
    const btn = document.createElement('button');
    btn.className = 'filter-chip' + (ym === activeActivityMonth ? ' active' : '');
    btn.dataset.month = ym;
    btn.textContent = activityMonthLabel(ym);
    btn.addEventListener('click', () => {
      document.querySelectorAll('#activity-filter .filter-chip').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      activeActivityMonth = ym;
      renderActivityList();
    });
    row.appendChild(btn);
  });
}

async function renderActivityList() {
  if (!activeActivityMonth) return;
  const wrap = document.getElementById('activity-list');
  wrap.innerHTML = '<div class="activity-empty">Завантаження...</div>';

  try {
    if (!activityCache[activeActivityMonth]) {
      activityCache[activeActivityMonth] = await API.activity.monthly(activeActivityMonth);
    }
    const data = activityCache[activeActivityMonth];

    if (!data.length) {
      wrap.innerHTML = '<div class="activity-empty">Немає даних за цей місяць</div>';
      return;
    }

    wrap.innerHTML = data.map(e => `
      <div class="activity-row lb-row-tap" onclick="_actRowTap('${e.userId}','${e.displayName}')">
        <div class="activity-rank ${e.rank === 1 ? 'top1' : e.rank === 2 ? 'top2' : e.rank === 3 ? 'top3' : ''}">
          ${e.rank === 1 ? '★' : e.rank}
        </div>
        <div class="activity-avatar">
          ${e.photoUrl ? `<img src="${e.photoUrl}" alt="">` : initials(e.displayName)}
        </div>
        <div class="activity-info">
          <div class="activity-name">${e.displayName}</div>
          <div class="activity-sub">${e.tournamentsPlayed} ${e.tournamentsPlayed === 1 ? 'турнір' : e.tournamentsPlayed < 5 ? 'турніри' : 'турнірів'}</div>
        </div>
        <div>
          <div class="activity-pts">${e.activityPoints}</div>
          <div class="activity-pts-label">Активність</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="activity-empty" style="color:var(--error)">${e.message}</div>`;
  }
}

async function renderActivity() {
  if (!tournamentsData) {
    try {
      tournamentsData = (await API.tournaments.list()).map(normalizeTournament);
    } catch { /* fallback to mock */ }
  }
  const source = tournamentsData || TOURNAMENTS;
  buildActivityMonthChips(source);
  await renderActivityList();
}

/* ════════════════════════════════════════════════════════════════
   RENDER — PROFILE TAB
════════════════════════════════════════════════════════════════ */

function initials(name) {
  return name ? name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';
}

function renderProfile() {
  const container = document.getElementById('profile-content');

  if (!apiAvailable) {
    container.innerHTML = `
      <div class="api-banner warn">
        <span>⚠</span> Backend недоступний. Запустіть bsp-backend локально.
      </div>
      <div class="profile-guest">
        <div class="profile-guest-avatar">BS</div>
        <div class="profile-guest-name">Blacksea Padel</div>
        <div class="profile-guest-hint">Підключіться до backend-сервера щоб увійти в профіль.</div>
      </div>`;
    return;
  }

  if (!currentUser) {
    const tgUser = tg?.initDataUnsafe?.user;
    const name = tgUser ? (tgUser.first_name + (tgUser.last_name ? ' ' + tgUser.last_name : '')) : 'Гість';
    container.innerHTML = `
      <div class="profile-guest">
        <div class="profile-guest-avatar">${initials(name)}</div>
        <div class="profile-guest-name">${name}</div>
        <div class="profile-guest-hint">Натисніть «Ввійти», щоб зберегти ваш профіль та статистику.</div>
        <button class="btn-primary" id="login-btn">Ввійти через Telegram</button>
      </div>`;
    document.getElementById('login-btn').addEventListener('click', async () => {
      const btn = document.getElementById('login-btn');
      btn.disabled = true; btn.textContent = '...';
      try {
        const initData = tg?.initData || 'test';
        const res = await API.auth.loginWithTelegram(initData);
        API.setToken(res.token);
        currentUser = res.user;
        renderProfile();
      } catch (e) {
        btn.disabled = false; btn.textContent = 'Ввійти через Telegram';
        alert('Помилка входу: ' + (e.message || 'невідома'));
      }
    });
    return;
  }

  const u = currentUser;
  const isAdmin = u.role === 'ADMIN';
  const level = levelFromPoints(u.ratingPoints);
  const tier = tierClass(level);
  const globalRank = ratingsData ? ratingsData.findIndex(p => p.id === u.id) + 1 : 0;
  const colorLabel = { RED: 'Червоний', YELLOW: 'Жовтий', GREEN: 'Зелений' };
  const colorDot   = { RED: '🔴', YELLOW: '🟡', GREEN: '🟢' };

  container.innerHTML = `
    <div class="profile-hero ${tier}">
      <div class="profile-avatar">
        ${u.photoUrl ? `<img src="${u.photoUrl}" alt="">` : initials(u.displayName)}
      </div>
      <div class="profile-info">
        <div class="profile-name">${u.displayName}</div>
        ${u.username ? `<div class="profile-username">@${u.username}</div>` : ''}
        <span class="level-badge level-badge-hero ${levelClass(level)}">${level}</span>
        <div class="profile-hero-meta">
          <span class="profile-role-badge ${isAdmin ? '' : 'player'}">${isAdmin ? 'Admin' : 'Player'}</span>
          ${globalRank > 0 ? `<span class="profile-hero-rank">#${globalRank} у рейтингу</span>` : ''}
        </div>
      </div>
    </div>

    <div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-value">${u.ratingPoints}</div>
        <div class="profile-stat-label" style="display:flex;align-items:center;justify-content:center;gap:4px">
          Бали <button class="rating-info-btn" onclick="openModal('modal-rating-guide')">?</button>
        </div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${u.startingPoints || 0}</div>
        <div class="profile-stat-label">Стартові</div>
      </div>
    </div>

    <div id="profile-achievements"></div>

    <div class="profile-activity-card" id="profile-activity-card">
      <div class="pac-left">
        <div class="pac-label">Активність</div>
        <div class="pac-month">${activityMonthLabel(currentYearMonth())}</div>
      </div>
      <div class="pac-right">
        <div class="pac-pts" id="pac-pts">—</div>
        <div class="pac-rank" id="pac-rank">балів · завантаження...</div>
      </div>
    </div>

    ${u.initialPointsClaimed ? `
      <div class="raketo-claimed-card">
        <div class="raketo-claimed-icon">${colorDot[u.raketoColor] || '⭐'}</div>
        <div class="raketo-claimed-body">
          <div class="raketo-claimed-rating">Raketo ${u.raketoRating?.toFixed(1)}</div>
          <div class="raketo-claimed-detail">${colorLabel[u.raketoColor] || ''} · ${u.gender === 'MALE' ? 'Чоловік' : 'Жінка'} · стартові бали нараховано</div>
        </div>
      </div>
    ` : `
      <button class="claim-points-btn" id="btn-claim-points">
        <div class="claim-points-btn-left">
          <div class="claim-points-btn-title">Імпортувати рейтинг з Raketo</div>
          <div class="claim-points-btn-sub">Вкажіть @username в Raketo — один раз</div>
        </div>
        <div class="claim-points-btn-arrow">›</div>
      </button>
    `}

    ${isAdmin ? renderAdminPanel() : ''}

    <div class="rating-chart-card" id="rating-chart-card">
      <div class="history-card-title">Прогрес рейтингу</div>
      <div id="rating-chart-body"><div class="history-loading">Завантаження...</div></div>
    </div>

    <div class="history-card">
      <div class="history-card-title">Історія турнірів</div>
      <div id="history-list"><div class="history-loading">Завантаження...</div></div>
    </div>

    <button class="btn-secondary" id="btn-support" style="width:100%;margin-top:8px">Написати підтримці</button>
    <button class="btn-secondary btn-danger" id="logout-btn" style="width:100%;margin-top:4px">Вийти</button>
  `;

  document.getElementById('logout-btn').addEventListener('click', () => {
    API.removeToken();
    currentUser = null;
    renderProfile();
  });

  document.getElementById('btn-support').addEventListener('click', openSupportModal);

  if (!u.initialPointsClaimed) {
    document.getElementById('btn-claim-points').addEventListener('click', openClaimPointsModal);
  }

  if (isAdmin) wireAdminPanel();
  loadHistory();

  // Load current-month activity for this user
  const actMonth = currentYearMonth();
  API.activity.monthly(actMonth).then(data => {
    const me = data.find(e => e.userId === u.id);
    const ptsEl  = document.getElementById('pac-pts');
    const rankEl = document.getElementById('pac-rank');
    if (!ptsEl) return;
    if (me) {
      ptsEl.textContent  = me.activityPoints;
      rankEl.textContent = `балів · #${me.rank} місце`;
    } else {
      ptsEl.textContent  = '0';
      rankEl.textContent = 'балів · немає участі';
    }
  }).catch(() => {
    const rankEl = document.getElementById('pac-rank');
    if (rankEl) rankEl.textContent = 'балів';
  });
}

function levelFromPoints(pts) {
  if (pts >= 3000) return 'B+';
  if (pts >= 2750) return 'B';
  if (pts >= 2500) return 'B−';
  if (pts >= 2000) return 'C+';
  if (pts >= 1750) return 'C';
  if (pts >= 1500) return 'C−';
  if (pts >= 1250) return 'D+';
  if (pts >= 1000) return 'D';
  return 'D−';
}

function levelClass(lvl) {
  return {
    'D−': 'level-d-minus', 'D': 'level-d', 'D+': 'level-d-plus',
    'C−': 'level-c-minus', 'C': 'level-c', 'C+': 'level-c-plus',
    'B−': 'level-b-minus', 'B': 'level-b', 'B+': 'level-b-plus',
  }[lvl] || 'level-d';
}

function tierClass(lvl) {
  if (['B−','B','B+'].includes(lvl)) return 'tier-gold';
  if (['C−','C','C+'].includes(lvl)) return 'tier-silver';
  return 'tier-bronze';
}

function cupTierClass(levelLabel) {
  if (!levelLabel) return 'cup-bronze';
  const l = String(levelLabel).toUpperCase();
  if (l.startsWith('B')) return 'cup-gold';
  if (l.startsWith('C')) return 'cup-silver';
  return 'cup-bronze';
}

function trophySvg(tier) {
  const c = tier === 'cup-gold' ? '#C9A84C' : tier === 'cup-silver' ? '#B0C4D8' : '#B87333';
  const glow = tier === 'cup-gold' ? 'filter:drop-shadow(0 0 4px rgba(201,168,76,0.9))' : '';
  return `<svg width="22" height="22" viewBox="0 0 24 24" style="${glow}" xmlns="http://www.w3.org/2000/svg">
    <path d="M7 2h10v5a5 5 0 01-10 0V2z" fill="${c}" fill-opacity="0.9"/>
    <path d="M7 4h-2a2 2 0 000 4h2M17 4h2a2 2 0 010 4h-2" stroke="${c}" stroke-width="1.5" fill="none" stroke-linecap="round"/>
    <line x1="12" y1="12" x2="12" y2="16" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
    <path d="M9 18h6" stroke="${c}" stroke-width="1.5" stroke-linecap="round"/>
  </svg>`;
}

function renderAchievements(playerId, playerName) {
  const source = tournamentsData || TOURNAMENTS;
  const MONTHS = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];
  const wins = source
    .filter(t => t.status === 'FINISHED' && (t.results || []).some(r =>
      r.pos === 1 && (r.players || []).some(p =>
        (playerId && String(p.id) === String(playerId)) ||
        (p.name && p.name === playerName)
      )
    ))
    .sort((a, b) => new Date(b.date) - new Date(a.date));
  if (!wins.length) return '';
  const cups = wins.map(t => {
    const d = new Date(t.date);
    const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return `<div class="ach-cup cup-gold" data-tid="${t.id}" role="button" tabindex="0">
      ${trophySvg('cup-gold')}
      <div class="ach-name">${t.name}</div>
      <div class="ach-date">${dateStr}</div>
    </div>`;
  }).join('');
  return `<div class="achievements-section">
    <div class="achievements-title">Перемоги</div>
    <div class="achievements-list">${cups}</div>
  </div>`;
}

function spawnAchParticles(el) {
  const rect = el.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const shapes = ['★', '✦', '·', '◆', '✦', '★', '·', '◆', '✦', '★', '·', '◆'];
  shapes.forEach((char, i) => {
    const angle = (360 / shapes.length) * i + Math.random() * 20 - 10;
    const dist  = 38 + Math.random() * 28;
    const p = document.createElement('div');
    p.className = 'ach-particle';
    p.textContent = char;
    p.style.cssText = `left:${cx}px;top:${cy}px;--dx:${Math.cos(angle * Math.PI / 180) * dist}px;--dy:${Math.sin(angle * Math.PI / 180) * dist}px;--rot:${Math.random() * 360}deg`;
    document.body.appendChild(p);
    setTimeout(() => p.remove(), 700);
  });
}

let achTrophyCleanup = null;

function openAchievementTournament(tid) {
  const source = tournamentsData || TOURNAMENTS;
  const t = source.find(x => String(x.id) === String(tid));
  if (!t) return;

  const content = document.getElementById('ach-modal-content');
  const MONTHS_FULL = ['січня','лютого','березня','квітня','травня','червня',
                       'липня','серпня','вересня','жовтня','листопада','грудня'];
  const d = new Date(t.date);
  const dateStr = `${d.getDate()} ${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`;
  const results = (t.results || []).slice().sort((a, b) => a.pos - b.pos);
  const typeLabel = t.type === 'SINGLE' ? 'Одиночний' : 'Парний';

  const rowsHtml = results.map(r => {
    const rPlayers = r.players || r.pair.map(n => ({ name: n }));
    const medal = r.pos === 1 ? '🥇' : r.pos === 2 ? '🥈' : r.pos === 3 ? '🥉' : `<span class="ach-pos">${r.pos}</span>`;
    const names = rPlayers.map(p => `<span>${p.name}</span>`).join('<span class="separator"> / </span>');
    const isWinner = r.pos === 1;
    return `<div class="ach-result-row${isWinner ? ' ach-result-winner' : ''}">
      <span class="ach-result-medal">${medal}</span>
      <div class="ach-result-names">${names}</div>
      ${r.pts ? `<span class="ach-result-pts">+${r.pts}</span>` : ''}
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="ach-hero">
      <div class="ach-stage">
        <div class="ach-loader" id="ach-loader"><div class="ach-loader-ring"></div></div>
        <canvas id="ach-trophy-canvas" class="ach-trophy-canvas"></canvas>
      </div>
      <img src="assets/laurel_wreath.svg" class="ach-wreath" aria-hidden="true">
      <div class="ach-hero-brand">★ BLACKSEA PADEL · ODESA ★</div>
    </div>

    <div class="ach-info-block">
      <div class="ach-info-name">${t.name}</div>
      <div class="ach-info-divider"></div>
      <div class="ach-info-table">
        <div class="ach-info-row">
          <span class="ach-info-lbl">Дата</span>
          <span class="ach-dots"></span>
          <span class="ach-info-val">${dateStr}</span>
        </div>
        ${t.levelLabel ? `<div class="ach-info-row">
          <span class="ach-info-lbl">Рівень</span>
          <span class="ach-dots"></span>
          <span class="ach-info-val">${t.levelLabel}</span>
        </div>` : ''}
        <div class="ach-info-row">
          <span class="ach-info-lbl">Формат</span>
          <span class="ach-dots"></span>
          <span class="ach-info-val">${typeLabel}</span>
        </div>
      </div>
      <div class="ach-info-divider"></div>
      <div class="ach-results-hdr">Підсумки турніру</div>
      <div class="ach-modal-results">${rowsHtml}</div>
    </div>
  `;

  if (achTrophyCleanup) { achTrophyCleanup(); achTrophyCleanup = null; }
  openModal('modal-achievement');
  requestAnimationFrame(() => { achTrophyCleanup = initAchTrophy3D(); });
}

function initAchTrophy3D() {
  const canvas   = document.getElementById('ach-trophy-canvas');
  const loaderEl = document.getElementById('ach-loader');
  if (!canvas || typeof THREE === 'undefined') return null;

  const SZ  = 240;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ── Renderer ────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(SZ, SZ);
  renderer.setPixelRatio(DPR);
  renderer.outputEncoding    = THREE.sRGBEncoding;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;

  // ── Scene & Camera ───────────────────────────────────────────────
  const scene  = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(36, 1, 0.01, 100);
  camera.position.set(0, 0.15, 4.0);

  // ── Warm golden environment map (gives metals proper reflections) ─
  (function () {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    const W = 16, H = 8;
    const data = new Uint8Array(W * H * 3);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 3;
        const t = y / (H - 1);
        if (t < 0.35) {
          // top — soft warm sky (dimmed)
          data[i]=140; data[i+1]=130; data[i+2]=100;
        } else if (t < 0.65) {
          // mid — muted gold horizon
          const s = (t - 0.35) / 0.30;
          data[i]   = Math.round(140 - s * 30);
          data[i+1] = Math.round(130 - s * 65);
          data[i+2] = Math.round(100 - s * 70);
        } else {
          // bottom — dark navy ground
          data[i]=20; data[i+1]=35; data[i+2]=65;
        }
      }
    }
    const tex = new THREE.DataTexture(data, W, H, THREE.RGBFormat);
    tex.needsUpdate = true;
    const rt = pmrem.fromEquirectangular(tex);
    scene.environment = rt.texture;
    tex.dispose();
    pmrem.dispose();
  })();

  // ── Lights — balanced for gold metallic materials ────────────────
  scene.add(new THREE.AmbientLight(0xfff8dc, 0.5));

  const lightDefs = [
    { pos: [ 2,  6,  4], col: 0xfffbe0, int: 2.0 },  // key  (front-top-right)
    { pos: [-3,  3,  2], col: 0xffd040, int: 1.0 },  // fill (left warm gold)
    { pos: [ 0, -2,  3], col: 0xffe080, int: 0.7 },  // bounce (below front)
    { pos: [ 1,  2, -4], col: 0x99aacc, int: 0.5 },  // rim (cool blue back)
  ];
  lightDefs.forEach(({ pos, col, int }) => {
    const l = new THREE.DirectionalLight(col, int);
    l.position.set(...pos);
    scene.add(l);
  });

  // ── Model ────────────────────────────────────────────────────────
  let model = null, raf;
  let rotY = 0.5, velY = 0;
  let dragging = false, lastX = 0;

  new THREE.GLTFLoader().load(
    'Golden%20Trophy%203D%20Model/scene.gltf',
    (gltf) => {
      model = gltf.scene;

      // Auto-centre & scale to fit 2 units tall
      const box    = new THREE.Box3().setFromObject(model);
      const centre = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const scale  = 2.0 / Math.max(size.x, size.y, size.z);
      model.scale.setScalar(scale);
      model.position.sub(centre.multiplyScalar(scale));
      model.position.y += 0.1; // nudge up slightly for better framing

      // Crank up environment reflections on all PBR materials
      model.traverse(child => {
        if (!child.isMesh) return;
        [].concat(child.material).forEach(mat => {
          if (mat.envMapIntensity !== undefined) mat.envMapIntensity = 1.2;
          mat.needsUpdate = true;
        });
      });

      scene.add(model);

      // Reveal canvas, hide loader
      canvas.style.opacity = '1';
      if (loaderEl) {
        loaderEl.style.opacity = '0';
        setTimeout(() => { loaderEl.style.display = 'none'; }, 350);
      }
    },
    undefined,
    (err) => {
      console.warn('Trophy load error:', err);
      canvas.style.opacity = '1';
      if (loaderEl) loaderEl.style.display = 'none';
    }
  );

  // ── Render loop ──────────────────────────────────────────────────
  function loop() {
    if (!dragging) { velY *= 0.90; rotY += velY + 0.012; }
    if (model) model.rotation.y = rotY;
    renderer.render(scene, camera);
    raf = requestAnimationFrame(loop);
  }

  // ── Drag to spin ─────────────────────────────────────────────────
  function onDown(e) { dragging = true; velY = 0; lastX = (e.touches?.[0] ?? e).clientX; }
  function onMove(e) {
    if (!dragging) return;
    e.preventDefault();
    const x = (e.touches?.[0] ?? e).clientX;
    velY = (x - lastX) * 0.012; rotY += velY; lastX = x;
  }
  function onUp() { dragging = false; }

  canvas.addEventListener('pointerdown', onDown);
  window.addEventListener('pointermove', onMove, { passive: false });
  window.addEventListener('pointerup',   onUp);

  loop();

  return () => {
    cancelAnimationFrame(raf);
    canvas.removeEventListener('pointerdown', onDown);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup',   onUp);
    renderer.dispose();
  };
}


function wireAchievements(container) {
  container.querySelectorAll('.ach-cup[data-tid]').forEach(cup => {
    cup.addEventListener('click', () => {
      cup.classList.remove('ach-tapped');
      void cup.offsetWidth; // reflow to restart animation
      cup.classList.add('ach-tapped');
      spawnAchParticles(cup);
      setTimeout(() => openAchievementTournament(cup.dataset.tid), 220);
    });
  });
}

function buildRatingChart(history, startingPoints) {
  const sorted = [...history].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

  const pts = [{ value: startingPoints, date: null }];
  let running = startingPoints;
  for (const h of sorted) {
    running = (h.totalPointsAfter > 0 ? h.totalPointsAfter : null) ?? (running + (h.pointsDelta || 0));
    pts.push({ value: running, date: new Date(h.createdAt) });
  }

  if (pts.length < 2) return null;

  const W = 360, H = 110;
  const pL = 42, pR = 14, pT = 18, pB = 26;
  const plotW = W - pL - pR, plotH = H - pT - pB;

  const vals = pts.map(p => p.value);
  const minV = Math.min(...vals), maxV = Math.max(...vals);
  const range = maxV - minV || 1;

  const xOf = i => pL + (i / (pts.length - 1)) * plotW;
  const yOf = v => pT + plotH - ((v - minV) / range) * plotH;

  const lineD = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${xOf(i).toFixed(1)} ${yOf(p.value).toFixed(1)}`).join(' ');
  const areaD = `${lineD} L${xOf(pts.length - 1).toFixed(1)} ${(pT + plotH).toFixed(1)} L${pL} ${(pT + plotH).toFixed(1)} Z`;

  const lastIdx = pts.length - 1;
  const lastX = xOf(lastIdx), lastY = yOf(pts[lastIdx].value);
  const fmtDate = d => d.toLocaleDateString('uk-UA', { month: 'short', year: '2-digit' });

  const gridVals = range > 0 ? [minV, Math.round((minV + maxV) / 2), maxV] : [minV];
  const grids = gridVals.map(v => `
    <line x1="${pL}" y1="${yOf(v).toFixed(1)}" x2="${W - pR}" y2="${yOf(v).toFixed(1)}" stroke="rgba(255,255,255,0.06)" stroke-width="1"/>
    <text x="${(pL - 6).toFixed(0)}" y="${(yOf(v) + 3.5).toFixed(1)}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.3)">${v}</text>
  `).join('');

  const dots = pts.map((p, i) => {
    const isEnd = i === 0 || i === lastIdx;
    return `<circle cx="${xOf(i).toFixed(1)}" cy="${yOf(p.value).toFixed(1)}" r="${isEnd ? 4 : 2.5}" fill="${isEnd ? 'var(--gold)' : 'var(--navy-mid)'}" stroke="var(--gold)" stroke-width="1.5"/>`;
  }).join('');

  const calloutAnchor = lastX > W * 0.75 ? 'end' : 'start';
  const calloutX = (calloutAnchor === 'end' ? lastX - 8 : lastX + 8).toFixed(1);
  const calloutY = Math.max(lastY - 7, pT + 11).toFixed(1);

  return `
<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;display:block">
  <defs>
    <linearGradient id="rg-fill" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--gold)" stop-opacity="0.28"/>
      <stop offset="100%" stop-color="var(--gold)" stop-opacity="0.02"/>
    </linearGradient>
  </defs>
  ${grids}
  <path d="${areaD}" fill="url(#rg-fill)"/>
  <path d="${lineD}" fill="none" stroke="var(--gold)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>
  ${dots}
  <text x="${pL}" y="${H - 5}" font-size="9" fill="rgba(255,255,255,0.3)">Старт: ${pts[0].value}</text>
  <text x="${(W - pR).toFixed(0)}" y="${H - 5}" text-anchor="end" font-size="9" fill="rgba(255,255,255,0.3)">${fmtDate(pts[lastIdx].date)}</text>
  <text x="${calloutX}" y="${calloutY}" text-anchor="${calloutAnchor}" font-size="13" font-weight="700" fill="var(--gold)">${pts[lastIdx].value}</text>
</svg>`;
}

async function loadHistory() {
  const container = document.getElementById('history-list');
  const chartBody = document.getElementById('rating-chart-body');
  if (!container) return;
  if (!apiAvailable) {
    container.innerHTML = '<div class="history-empty">Backend недоступний</div>';
    if (chartBody) chartBody.innerHTML = '<div class="history-empty">—</div>';
    return;
  }
  // Load tournaments for achievements if not yet cached
  if (!tournamentsData && apiAvailable) {
    try {
      tournamentsData = (await API.tournaments.list()).map(normalizeTournament);
    } catch { /* ignore — achievements will be empty */ }
  }
  const achEl = document.getElementById('profile-achievements');
  if (achEl && currentUser) { achEl.innerHTML = renderAchievements(currentUser.id, currentUser.displayName); wireAchievements(achEl); }

  try {
    const history = await API.users.history();
    if (!history || history.length === 0) {
      container.innerHTML = '<div class="history-empty">Немає записів</div>';
      if (chartBody) chartBody.innerHTML = '<div class="history-empty">Недостатньо даних</div>';
      return;
    }

    if (chartBody) {
      const svg = buildRatingChart(history, currentUser?.startingPoints || 0);
      chartBody.innerHTML = svg ?? '<div class="history-empty">Недостатньо даних</div>';
    }

    container.innerHTML = history.map(h => {
      const sign = h.pointsDelta >= 0 ? '+' : '';
      const ptsCls = h.pointsDelta >= 0 ? 'pos' : 'neg';
      const date = new Date(h.createdAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
      return `
        <div class="history-row">
          <div class="history-row-info">
            <div class="history-row-name">${h.tournamentName}</div>
            <div class="history-row-meta">${h.tournamentLevel} · ${date}</div>
          </div>
          <div class="history-row-pts ${ptsCls}">${sign}${h.pointsDelta}</div>
        </div>
      `;
    }).join('');
  } catch {
    container.innerHTML = '<div class="history-empty">Помилка завантаження</div>';
    if (chartBody) chartBody.innerHTML = '<div class="history-empty">—</div>';
  }
}

/* ════════════════════════════════════════════════════════════════
   CLAIM INITIAL POINTS MODAL
════════════════════════════════════════════════════════════════ */

const RAKETO_LEVELS = [
  { max: 1.5, level: 'D',  pts: 1000 },
  { max: 2.0, level: 'D+', pts: 1250 },
  { max: 2.5, level: 'C−', pts: 1500 },
  { max: 3.0, level: 'C',  pts: 1750 },
  { max: 3.5, level: 'C+', pts: 2000 },
  { max: 4.0, level: 'B−', pts: 2500 },
  { max: 4.5, level: 'B',  pts: 2750 },
  { max: 99,  level: 'B+', pts: 3000 },
];

const COLOR_STEPS = { GREEN: 0, YELLOW: -1, RED: -2 };

function raketoPreview(rating, color) {
  const idx = RAKETO_LEVELS.findIndex(l => rating < l.max);
  const safeIdx = idx === -1 ? RAKETO_LEVELS.length - 1 : idx;
  const levelIdx = Math.max(0, Math.min(safeIdx + (COLOR_STEPS[color] ?? 0), RAKETO_LEVELS.length - 1));
  return RAKETO_LEVELS[levelIdx];
}

/* ── Raketo Firestore integration ───────────────────────────── */

function parseFirestoreValue(v) {
  if (!v) return null;
  if ('stringValue'  in v) return v.stringValue;
  if ('doubleValue'  in v) return v.doubleValue;
  if ('integerValue' in v) return parseInt(v.integerValue, 10);
  if ('booleanValue' in v) return v.booleanValue;
  if ('mapValue'     in v) {
    const out = {};
    for (const [k, fv] of Object.entries(v.mapValue.fields || {})) out[k] = parseFirestoreValue(fv);
    return out;
  }
  if ('arrayValue' in v) return (v.arrayValue.values || []).map(parseFirestoreValue);
  return null;
}

function parseRaketoDoc(doc) {
  const f = doc.fields || {};
  const ratings = parseFirestoreValue(f.ratings) || {};
  const matches = parseFirestoreValue(f.matches) || {};
  const name = parseFirestoreValue(f.display_name) || '';
  if (!name || name === 'Not Selected' || name === 'Bye') return null;
  const padelRating = ratings.padel_dbl ?? 0;
  const padelMatches = (matches.padel_dbl_num ?? 0) + (matches.padel_americano_num ?? 0);
  const color = padelMatches >= 40 ? 'GREEN' : padelMatches >= 16 ? 'YELLOW' : 'RED';
  const rawGender = parseFirestoreValue(f.gender);
  const gender = rawGender === 'male' || rawGender === 'MALE' ? 'MALE'
               : rawGender === 'female' || rawGender === 'FEMALE' ? 'FEMALE'
               : null;
  const rawTg = parseFirestoreValue(f.telegram) || null;
  const telegramHandle = rawTg ? rawTg.replace(/^@/, '') : null;
  return {
    name,
    photoUrl: parseFirestoreValue(f.photo_url) || null,
    padelRating: Math.round(padelRating * 1000) / 1000,
    padelMatches,
    color,
    gender,
    telegramHandle,
  };
}


function renderRaketoCard(u) {
  const dotCls = u.color.toLowerCase();
  const ratingStr = u.padelRating > 0 ? u.padelRating.toFixed(3) : '—';
  const initStr = u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="raketo-results">
    <div class="raketo-result active">
      <div class="raketo-result-avatar">
        ${u.photoUrl
          ? `<img src="${u.photoUrl}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${initStr}</span>`
          : initStr}
      </div>
      <div class="raketo-result-body">
        <div class="raketo-result-name">${u.name}</div>
        <div class="raketo-result-meta">
          <span class="raketo-result-dot ${dotCls}"></span>
          <span class="raketo-result-rating">Padel ${ratingStr}</span>
          <span class="raketo-result-matches">${u.padelMatches} матчів</span>
        </div>
      </div>
    </div>
  </div>`;
}

async function lookupRaketoByTelegram(username) {
  const bare = username.replace(/^@/, '');
  // Try both formats: Raketo may store the handle with or without the @ prefix
  const candidates = ['@' + bare, bare];
  const url = 'https://firestore.googleapis.com/v1/projects/georgia-tennis/databases/(default)/documents:runQuery';

  for (const tgHandle of candidates) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        structuredQuery: {
          from: [{ collectionId: 'users' }],
          select: { fields: [
            { fieldPath: 'display_name' },
            { fieldPath: 'photo_url' },
            { fieldPath: 'ratings' },
            { fieldPath: 'matches' },
            { fieldPath: 'gender' },
          ]},
          where: {
            fieldFilter: {
              field: { fieldPath: 'telegram' },
              op: 'EQUAL',
              value: { stringValue: tgHandle },
            },
          },
          limit: 1,
        },
      }),
    });

    const body = await res.json().catch(() => null);
    if (!res.ok) {
      const msg = body?.error?.message || body?.error?.status || ('Raketo API error ' + res.status);
      throw new Error(msg);
    }

    const items = Array.isArray(body) ? body : [];
    // Surface any embedded Firestore error (returned inside a 200 body)
    const errItem = items.find(i => i.error);
    if (errItem) throw new Error(errItem.error.message || errItem.error.status || 'Raketo error');

    const docs = items.filter(i => i.document).map(i => {
      const parsed = parseRaketoDoc(i.document);
      if (!parsed) return null;
      return { ...parsed, docId: i.document.name?.split('/').pop() || null };
    }).filter(Boolean);
    if (docs.length > 0) return docs[0];
  }

  return null;
}

function openSupportModal() {
  openModal('modal-support');
  const textarea = document.getElementById('support-textarea');
  const sendBtn  = document.getElementById('support-send-btn');
  const status   = document.getElementById('support-status');
  textarea.value = '';
  status.textContent = '';
  status.style.color = '';
  sendBtn.disabled = false;
  sendBtn.textContent = 'Надіслати';

  sendBtn.onclick = async () => {
    const msg = textarea.value.trim();
    if (!msg) return;
    sendBtn.disabled = true;
    sendBtn.textContent = '...';
    try {
      await API.users.support(msg);
      status.textContent = 'Повідомлення надіслано!';
      status.style.color = 'var(--success)';
      setTimeout(() => closeModal('modal-support'), 1500);
    } catch (e) {
      status.textContent = 'Помилка: ' + (e.message || 'спробуйте ще раз');
      status.style.color = 'var(--error)';
      sendBtn.disabled = false;
      sendBtn.textContent = 'Надіслати';
    }
  };
}

function openClaimPointsModal() {
  openModal('modal-claim-points');
  let gender = null, selectedRating = null, selectedColor = null, selectedDocId = null, selectedRaketoName = null;

  const lookupBox    = document.getElementById('cp-lookup');
  const genderGroup  = document.getElementById('cp-gender-group');
  const previewBox   = document.getElementById('cp-preview');
  const previewPts   = document.getElementById('cp-preview-pts');
  const previewLevel = document.getElementById('cp-preview-level');
  const submitBtn    = document.getElementById('cp-submit');

  // Reset state each time modal opens
  gender = null; selectedRating = null; selectedColor = null;
  lookupBox.innerHTML = '';
  genderGroup.style.display = 'none';
  previewBox.style.display = 'none';
  submitBtn.disabled = true;
  document.querySelectorAll('#cp-gender .claim-chip').forEach(b => b.classList.remove('active'));

  function updatePreview() {
    submitBtn.disabled = !(gender && selectedRating !== null);
    if (selectedRating !== null && selectedColor && gender) {
      const p = raketoPreview(selectedRating, selectedColor);
      previewPts.textContent = p.pts;
      previewLevel.textContent = `Рівень BSP: ${p.level}`;
      previewBox.style.display = '';
    }
  }

  function applyRaketoUser(u) {
    selectedRating    = u.padelRating;
    selectedColor     = u.color;
    selectedDocId     = u.docId || null;
    selectedRaketoName = u.name || null;
    genderGroup.style.display = '';
    if (u.gender) {
      gender = u.gender;
      document.querySelectorAll('#cp-gender .claim-chip').forEach(b => {
        b.classList.toggle('active', b.dataset.val === u.gender);
      });
    }
    updatePreview();
  }

  // Auto-lookup by Telegram username
  const tgUsername = currentUser?.username;
  if (!tgUsername) {
    lookupBox.innerHTML = `<div class="raketo-no-result">Ваш акаунт не має Telegram username. Зверніться до адміністратора.</div>`;
  } else {
    lookupBox.innerHTML = `<div class="raketo-searching">Пошук у Raketo за @${tgUsername}...</div>`;
    lookupRaketoByTelegram(tgUsername).then(user => {
      if (!user) {
        lookupBox.innerHTML = `<div class="raketo-no-result">Профіль Raketo з Telegram <b>@${tgUsername}</b> не знайдено.<br><br>Переконайтесь, що ви вказали <b>@${tgUsername}</b> у налаштуваннях Raketo як Telegram контакт.</div>`;
        return;
      }
      lookupBox.innerHTML = renderRaketoCard(user);
      applyRaketoUser(user);
    }).catch(e => {
      lookupBox.innerHTML = `<div class="raketo-no-result">Помилка при зверненні до Raketo: ${e.message}</div>`;
    });
  }

  document.querySelectorAll('#cp-gender .claim-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cp-gender .claim-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      gender = btn.dataset.val;
      updatePreview();
    });
  });

  submitBtn.onclick = async () => {
    if (!gender || selectedRating === null) return;
    submitBtn.disabled = true;
    submitBtn.textContent = '...';
    try {
      currentUser = await API.users.claimInitialPoints({
        gender,
        raketoRating: selectedRating,
        raketoColor: selectedColor,
        ...(selectedDocId ? { raketoDocId: selectedDocId } : {}),
        ...(selectedRaketoName ? { raketoName: selectedRaketoName } : {}),
      });
      closeModal('modal-claim-points');
      renderProfile();
    } catch (e) {
      alert('Помилка: ' + (e.message || 'unknown'));
      submitBtn.disabled = false;
      submitBtn.textContent = 'Підтвердити імпорт';
    }
  };
}

function renderAdminPanel() {
  return `
    <div class="admin-panel">
      <div class="admin-panel-header">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#C9A84C" stroke-width="2" stroke-linecap="round"><path d="M12 2l2.4 7.4H22l-6.2 4.5 2.4 7.4L12 17l-6.2 4.3 2.4-7.4L2 9.4h7.6z"/></svg>
        <span class="admin-panel-title">Адмін панель</span>
      </div>
      <div class="admin-actions">
        <button class="admin-action-btn" id="btn-create-tournament">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M12 8v8M8 12h8"/></svg>
          <span class="admin-action-label">Створити турнір</span>
          <span class="admin-action-arrow">›</span>
        </button>
        <button class="admin-action-btn" id="btn-submit-results">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
          <span class="admin-action-label">Внести результати</span>
          <span class="admin-action-arrow">›</span>
        </button>
        <button class="admin-action-btn" id="btn-manage-participants">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 9h6M9 13h4M8 4V2M16 4V2"/></svg>
          <span class="admin-action-label">Учасники турніру</span>
          <span class="admin-action-arrow">›</span>
        </button>
        <button class="admin-action-btn" id="btn-users">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
          <span class="admin-action-label">Гравці</span>
          <span class="admin-action-arrow">›</span>
        </button>
        <button class="admin-action-btn" id="btn-admin-import">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          <span class="admin-action-label">Імпорт з Raketo</span>
          <span class="admin-action-arrow">›</span>
        </button>
        <button class="admin-action-btn" id="btn-admin-analysis">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>
          <span class="admin-action-label">AI Аналіз турнірів</span>
          <span class="admin-action-arrow">›</span>
        </button>
      </div>
    </div>
  `;
}

/* ════════════════════════════════════════════════════════════════
   AI ANALYSIS
════════════════════════════════════════════════════════════════ */

let _tournamentChart = null;

function destroyCharts() {
  if (_tournamentChart) { _tournamentChart.destroy(); _tournamentChart = null; }
}

const CHART_PALETTE = [
  '#4fc3f7','#81c784','#ffb74d','#e57373','#ce93d8',
  '#80cbc4','#fff176','#ff8a65','#90caf9','#a5d6a7',
  '#f48fb1','#b0bec5','#80deea','#ffe082','#bcaaa4','#c5e1a5',
];

async function openAnalysisModal(tournamentId) {
  destroyCharts();
  openModal('modal-analysis');
  const content = document.getElementById('analysis-content');
  const playerSection = document.getElementById('analysis-player-section');
  const playerContent = document.getElementById('analysis-player-content');
  playerSection.style.display = 'none';
  content.innerHTML = analysisLoadingHtml('Завантаження аналізу...');

  try {
    const data = await API.tournaments.getAnalysis(tournamentId);
    content.innerHTML = `
      <div class="analysis-text">${escapeHtml(data.analysis)}</div>
      ${data.chartData ? '<canvas id="tournament-chart" style="margin-top:20px;max-height:260px"></canvas>' : ''}
      ${data.generatedAt ? `<div class="analysis-meta">Згенеровано: ${fmtDatetime(data.generatedAt)}</div>` : ''}
    `;

    if (data.chartData) renderTournamentChart(data.chartData);

    if (currentUser && currentUser.raketoDocId) {
      playerSection.style.display = 'block';
      const cached = await API.tournaments.getPlayerAnalysis(tournamentId).catch(() => null);
      if (cached) {
        renderPlayerAnalysis(playerContent, cached);
      } else {
        playerContent.innerHTML = `
          <button class="btn-secondary" id="btn-my-analysis" style="width:100%">
            Аналіз мого гейму
          </button>`;
        document.getElementById('btn-my-analysis').addEventListener('click', async () => {
          playerContent.innerHTML = analysisLoadingHtml('Аналізую твій виступ...');
          try {
            const result = await API.tournaments.generatePlayerAnalysis(tournamentId);
            renderPlayerAnalysis(playerContent, result);
          } catch (e) {
            playerContent.innerHTML = `<div class="analysis-error">${e.message || 'Помилка генерації'}</div>`;
          }
        });
      }
    }
  } catch (e) {
    content.innerHTML = `<div class="analysis-error">${e.message || 'Помилка завантаження'}</div>`;
  }
}

function renderTournamentChart(chartData) {
  const canvas = document.getElementById('tournament-chart');
  if (!canvas || !chartData?.players?.length) return;

  const players = chartData.players;
  const gridHtml = `<div class="chart-player-grid" id="chart-player-grid">${
    players.map((p, i) => `
      <div class="chart-player-item active" data-index="${i}">
        <span class="chart-player-dot" style="background:${CHART_PALETTE[i % CHART_PALETTE.length]}"></span>
        <span class="chart-player-name">${p.name}</span>
      </div>`).join('')
  }</div>`;
  canvas.insertAdjacentHTML('beforebegin', gridHtml);

  _tournamentChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels: chartData.labels,
      datasets: players.map((p, i) => ({
        label: p.name,
        data: p.cumulative,
        borderColor: CHART_PALETTE[i % CHART_PALETTE.length],
        backgroundColor: 'transparent',
        borderWidth: 2,
        pointRadius: 3,
        pointHoverRadius: 5,
        tension: 0.3,
      })),
    },
    options: {
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: '#0D1B2E',
          titleColor: '#B8C8D8',
          bodyColor: '#8FA3B8',
          borderColor: 'rgba(201,168,76,0.25)',
          borderWidth: 1,
          callbacks: {
            title: items => 'Після ' + items[0].label,
            label: item => ` ${item.dataset.label}: ${item.raw}п`,
          },
        },
      },
      scales: {
        x: {
          ticks: { color: '#8FA3B8', font: { size: 10 } },
          grid: { color: 'rgba(201,168,76,0.08)' },
          border: { color: 'rgba(201,168,76,0.15)' },
        },
        y: {
          ticks: { color: '#8FA3B8', font: { size: 10 } },
          grid: { color: 'rgba(201,168,76,0.08)' },
          border: { color: 'rgba(201,168,76,0.15)' },
          beginAtZero: true,
        },
      },
    },
  });

  document.getElementById('chart-player-grid')?.querySelectorAll('.chart-player-item').forEach(item => {
    item.addEventListener('click', () => {
      const idx = parseInt(item.dataset.index);
      const on = item.classList.toggle('active');
      _tournamentChart.setDatasetVisibility(idx, on);
      _tournamentChart.update();
    });
  });
}

function renderPlayerAnalysis(container, data) {
  container.innerHTML = `
    <div class="analysis-player-title">Аналіз мого гейму</div>
    <div class="analysis-text">${escapeHtml(data.analysis)}</div>
    ${data.radarData ? buildSpiderSvg(data.radarData) : ''}
    ${data.generatedAt ? `<div class="analysis-meta">Згенеровано: ${fmtDatetime(data.generatedAt)}</div>` : ''}
  `;
}

function buildSpiderSvg(radarData) {
  const labels = radarData.labels || [];
  const values = (radarData.values || []).map(Number);
  const n = labels.length;
  if (n < 2) return '';

  const maxPts = Number(radarData.maxPts) || Math.max(...values, 1);
  const avg = values.reduce((a, b) => a + b, 0) / n;

  const size = 280;
  const cx = size / 2, cy = size / 2;
  const R = 94;

  const ang = i => (2 * Math.PI * i / n) - Math.PI / 2;
  const px = (r, i) => (cx + r * Math.cos(ang(i))).toFixed(1);
  const py = (r, i) => (cy + r * Math.sin(ang(i))).toFixed(1);

  const axes = Array.from({length: n}, (_, i) =>
    `<line x1="${cx}" y1="${cy}" x2="${px(R, i)}" y2="${py(R, i)}" stroke="rgba(201,168,76,0.15)" stroke-width="1"/>`
  ).join('');

  const dataPath = values.map((v, i) => {
    const r = (Math.min(v, maxPts) / maxPts) * R;
    return `${i === 0 ? 'M' : 'L'}${px(r, i)},${py(r, i)}`;
  }).join(' ') + ' Z';

  const avgCircleR = ((avg / maxPts) * R).toFixed(1);

  const dots = values.map((v, i) => {
    const r = (Math.min(v, maxPts) / maxPts) * R;
    return `<circle cx="${px(r, i)}" cy="${py(r, i)}" r="3.5" fill="#C9A84C" stroke="#0D1B2E" stroke-width="1.5"/>`;
  }).join('');

  const labelPad = 24;
  const labelEls = labels.map((label, i) => {
    const a = ang(i);
    const cosA = Math.cos(a);
    const lx = (cx + (R + labelPad) * cosA).toFixed(1);
    const ly = (cy + (R + labelPad) * Math.sin(a)).toFixed(1);
    const anchor = cosA > 0.3 ? 'start' : cosA < -0.3 ? 'end' : 'middle';
    const parts = label.split(' + ');
    if (parts.length === 2) {
      // Pair label: two name lines + points line
      const l1 = parts[0].length > 10 ? parts[0].slice(0, 9) + '…' : parts[0];
      const l2 = parts[1].length > 10 ? parts[1].slice(0, 9) + '…' : parts[1];
      const base = parseFloat(ly);
      return `
        <text x="${lx}" y="${(base - 11).toFixed(1)}" text-anchor="${anchor}" fill="#B8C8D8" font-size="9.5" font-family="system-ui,sans-serif">${l1}</text>
        <text x="${lx}" y="${(base + 1).toFixed(1)}"  text-anchor="${anchor}" fill="#B8C8D8" font-size="9.5" font-family="system-ui,sans-serif">+ ${l2}</text>
        <text x="${lx}" y="${(base + 14).toFixed(1)}" text-anchor="${anchor}" fill="#C9A84C" font-size="9" font-weight="600" font-family="system-ui,sans-serif">${values[i]}п</text>`;
    }
    const short = label.length > 9 ? label.slice(0, 8) + '…' : label;
    return `
      <text x="${lx}" y="${(parseFloat(ly) - 4).toFixed(1)}" text-anchor="${anchor}" fill="#B8C8D8" font-size="10" font-family="system-ui,sans-serif">${short}</text>
      <text x="${lx}" y="${(parseFloat(ly) + 9).toFixed(1)}" text-anchor="${anchor}" fill="#C9A84C" font-size="9" font-weight="600" font-family="system-ui,sans-serif">${values[i]}п</text>`;
  }).join('');

  return `
    <svg viewBox="0 0 ${size} ${size}" style="width:100%;max-height:280px;overflow:visible;display:block;margin-top:18px">
      ${axes}
      <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="rgba(201,168,76,0.28)" stroke-width="1.5"/>
      <circle cx="${cx}" cy="${cy}" r="${avgCircleR}" fill="none" stroke="rgba(201,168,76,0.55)" stroke-width="1.5" stroke-dasharray="5,3"/>
      <path d="${dataPath}" fill="rgba(201,168,76,0.13)" stroke="#C9A84C" stroke-width="2" stroke-linejoin="round"/>
      ${dots}
      ${labelEls}
    </svg>
    <div style="display:flex;gap:16px;margin-top:6px;font-size:10px;color:var(--text-muted);justify-content:center;flex-wrap:wrap">
      <span style="display:flex;align-items:center;gap:5px">
        <svg width="16" height="6" viewBox="0 0 16 6" style="flex-shrink:0"><line x1="0" y1="3" x2="16" y2="3" stroke="rgba(201,168,76,0.55)" stroke-width="1.5" stroke-dasharray="5,3"/></svg>
        середнє (${avg.toFixed(1)}п)
      </span>
      <span style="display:flex;align-items:center;gap:5px">
        <svg width="16" height="6" viewBox="0 0 16 6" style="flex-shrink:0"><line x1="0" y1="3" x2="16" y2="3" stroke="rgba(201,168,76,0.28)" stroke-width="1.5"/></svg>
        макс (${maxPts}п)
      </span>
    </div>`;
}

function analysisLoadingHtml(msg) {
  return `<div class="analysis-loading"><div class="analysis-spinner"></div><div>${msg}</div></div>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function fmtDatetime(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch { return ''; }
}

/* ── Admin Analysis Modal ────────────────────────────────────────── */

const RAKETO_FS = 'https://firestore.googleapis.com/v1/projects/georgia-tennis/databases/(default)/documents';

async function openAdminAnalysisModal() {
  openModal('modal-admin-analysis');
  const list = document.getElementById('aa-tournament-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Завантаження...</div>';

  try {
    // Load BSP users to build the "Odessa filter" — tournaments containing our players
    const [tournaments, allUsers] = await Promise.all([
      API.tournaments.list(),
      API.users.list(),
    ]);
    const bspRaketoIds = new Set(allUsers.map(u => u.raketoDocId).filter(Boolean));

    const finished = tournaments.filter(t => t.status === 'FINISHED');
    if (!finished.length) {
      list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Немає завершених турнірів</div>';
      return;
    }

    list.innerHTML = finished.map(t => `
      <div class="aa-item" data-id="${t.id}" data-date="${t.date}">
        <div class="aa-item-header">
          <div class="aa-item-name">${t.name}</div>
          <div class="aa-item-date">${fmt(t.date)}</div>
        </div>
        ${t.raketoId
          ? `<div class="aa-linked">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
               Ракето підключено
               <button class="aa-unlink-btn" style="margin-left:auto;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0">Змінити</button>
             </div>`
          : ''}
        <div class="aa-picker" style="display:none">
          <div class="aa-date-row">
            <input type="date" class="form-input aa-date-input" value="${t.date}" style="flex:1;font-size:13px">
            <button class="btn-secondary aa-search-btn" style="flex-shrink:0;font-size:12px;padding:0 14px">Шукати</button>
          </div>
          <div class="aa-results"></div>
        </div>
        ${!t.raketoId ? `<button class="btn-secondary aa-find-btn" style="width:100%;font-size:12px;margin-top:6px">Знайти в Ракето</button>` : ''}
        <button class="btn-primary aa-generate-btn" ${!t.raketoId ? 'disabled' : ''} style="width:100%;margin-top:6px;font-size:12px">
          ${t.hasAnalysis ? 'Перегенерувати аналіз' : 'Згенерувати аналіз'}
        </button>
        ${t.hasAnalysis ? `<div class="aa-status">Аналіз готовий · ${fmtDatetime(t.analysisGeneratedAt)}</div>` : ''}
      </div>
    `).join('');

    list.querySelectorAll('.aa-item').forEach(item => {
      const bspId   = item.dataset.id;
      const picker  = item.querySelector('.aa-picker');
      const results = item.querySelector('.aa-results');
      const findBtn = item.querySelector('.aa-find-btn');
      const unlinkBtn = item.querySelector('.aa-unlink-btn');
      const searchBtn = item.querySelector('.aa-search-btn');
      const dateInput = item.querySelector('.aa-date-input');
      const generateBtn = item.querySelector('.aa-generate-btn');

      const openPicker = () => {
        picker.style.display = 'block';
        if (findBtn) findBtn.style.display = 'none';
      };

      const doSearch = async () => {
        const date = dateInput.value;
        if (!date) return;
        searchBtn.disabled = true; searchBtn.textContent = '...';
        results.innerHTML = '<div class="aa-picker-loading"><div class="analysis-spinner" style="width:18px;height:18px;border-width:2px"></div>Шукаю в Ракето...</div>';
        try {
          const raketo = await fetchRaketoForDate(date, bspRaketoIds);
          if (!raketo.length) {
            results.innerHTML = '<div style="font-size:12px;color:var(--text-muted);padding:6px 0">Одеських турнірів за цей день не знайдено</div>';
          } else {
            results.innerHTML = raketo.map(r => `
              <div class="aa-raketo-pick" data-raketo-id="${r.id}">
                <div class="aa-pick-datetime">${r.dateStr} · ${r.timeStr}</div>
                <div class="aa-pick-court">${r.courtName}</div>
                <div class="aa-pick-players">${r.players.join(' · ')}</div>
              </div>
            `).join('');
            results.querySelectorAll('.aa-raketo-pick').forEach(pick => {
              pick.addEventListener('click', async () => {
                try {
                  await API.tournaments.setRaketoId(bspId, pick.dataset.raketoId);
                  tournamentsData = null;
                  generateBtn.disabled = false;
                  picker.style.display = 'none';
                  const linkedEl = item.querySelector('.aa-linked');
                  if (linkedEl) {
                    linkedEl.style.display = 'flex';
                  } else {
                    item.querySelector('.aa-item-header').insertAdjacentHTML('afterend',
                      `<div class="aa-linked">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                        Ракето підключено
                        <button class="aa-unlink-btn" style="margin-left:auto;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0">Змінити</button>
                      </div>`);
                    item.querySelector('.aa-unlink-btn')?.addEventListener('click', openPicker);
                  }
                } catch (e) { alert('Помилка: ' + (e.message || 'unknown')); }
              });
            });
          }
        } catch (e) {
          results.innerHTML = `<div style="font-size:12px;color:var(--error);padding:6px 0">${e.message || 'Помилка'}</div>`;
        } finally {
          searchBtn.disabled = false; searchBtn.textContent = 'Шукати';
        }
      };

      if (findBtn)   findBtn.addEventListener('click', openPicker);
      if (unlinkBtn) unlinkBtn.addEventListener('click', openPicker);
      searchBtn.addEventListener('click', doSearch);

      generateBtn.addEventListener('click', async () => {
        generateBtn.disabled = true; generateBtn.textContent = 'Генерую...';
        try {
          await API.tournaments.generateAnalysis(bspId);
          tournamentsData = null;
          const statusEl = item.querySelector('.aa-status');
          if (statusEl) statusEl.textContent = `Аналіз готовий · ${fmtDatetime(new Date().toISOString())}`;
          else item.insertAdjacentHTML('beforeend', `<div class="aa-status">Аналіз готовий · щойно</div>`);
          generateBtn.textContent = 'Перегенерувати аналіз';
        } catch (e) {
          alert('Помилка: ' + (e.message || 'unknown'));
          generateBtn.textContent = generateBtn.textContent === 'Генерую...' ? 'Згенерувати аналіз' : generateBtn.textContent;
        } finally {
          generateBtn.disabled = false;
        }
      });
    });
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">${e.message || 'Помилка'}</div>`;
  }
}

async function fetchRaketoForDate(date, bspRaketoIds) {
  // Query the full day in UTC (covers local timezones with up to UTC+14 offset)
  const from = new Date(date + 'T00:00:00Z');
  const to   = new Date(date + 'T23:59:59Z');

  const res = await fetch(`${RAKETO_FS}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'americano' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'time_from' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: from.toISOString() } } },
              { fieldFilter: { field: { fieldPath: 'time_from' }, op: 'LESS_THAN_OR_EQUAL',    value: { timestampValue: to.toISOString() } } },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'time_from' }, direction: 'ASCENDING' }],
        limit: 50,
      },
    }),
  });

  const body = await res.json();
  const items = Array.isArray(body) ? body : [];
  const docs = items
    .filter(i => i.document)
    .map(i => i.document)
    .filter(d => fsBool(d.fields, 'finalized') && !fsBool(d.fields, 'deleted'));

  if (!docs.length) return [];

  // Odessa filter: keep only tournaments where ≥2 players are known BSP users
  const odessa = docs.filter(d => {
    const uids = raketoPlayerUids(d.fields);
    return uids.filter(uid => bspRaketoIds.has(uid)).length >= 2;
  });

  if (!odessa.length) return [];

  // Fetch court names and player display names in parallel
  const courtIds = [...new Set(odessa.map(d => fsRefId(d.fields, 'courts')).filter(Boolean))];
  const allUids  = new Set(odessa.flatMap(d => raketoPlayerUids(d.fields).slice(0, 3)));

  const [courtMap, userMap] = await Promise.all([
    Promise.all(courtIds.map(async cid => {
      try {
        const r = await fetch(`${RAKETO_FS}/courts/${cid}`);
        const f = (await r.json()).fields || {};
        const name = f.name?.stringValue || '';
        const city = f.city?.stringValue || '';
        return [cid, city ? `${name}, ${city}` : name || '?'];
      } catch { return [cid, '?']; }
    })).then(Object.fromEntries),
    Promise.all([...allUids].map(async uid => {
      try {
        const r = await fetch(`${RAKETO_FS}/users/${uid}`);
        const f = (await r.json()).fields || {};
        return [uid, f.display_name?.stringValue || uid.slice(0, 6)];
      } catch { return [uid, uid.slice(0, 6)]; }
    })).then(Object.fromEntries),
  ]);

  return odessa.map(d => {
    const f   = d.fields || {};
    const ts  = f.time_from?.timestampValue;
    const dt  = ts ? new Date(ts) : null;
    const cid = fsRefId(f, 'courts');
    const playerNames = raketoPlayerUids(d.fields).slice(0, 3).map(uid => userMap[uid] || uid.slice(0, 6));
    return {
      id: d.name.split('/').pop(),
      dateStr:   dt ? dt.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      timeStr:   dt ? dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '',
      courtName: cid ? (courtMap[cid] || '?') : 'Без корту',
      players:   playerNames,
    };
  });
}

async function fetchAllRaketoForDate(date) {
  const from = new Date(date + 'T00:00:00Z');
  const to   = new Date(date + 'T23:59:59Z');

  const res = await fetch(`${RAKETO_FS}:runQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'americano' }],
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'time_from' }, op: 'GREATER_THAN_OR_EQUAL', value: { timestampValue: from.toISOString() } } },
              { fieldFilter: { field: { fieldPath: 'time_from' }, op: 'LESS_THAN_OR_EQUAL',    value: { timestampValue: to.toISOString()   } } },
            ],
          },
        },
        orderBy: [{ field: { fieldPath: 'time_from' }, direction: 'ASCENDING' }],
        limit: 100,
      },
    }),
  });

  const body = await res.json();
  const docs = (Array.isArray(body) ? body : [])
    .filter(i => i.document)
    .map(i => i.document)
    .filter(d => !fsBool(d.fields, 'deleted'));

  if (!docs.length) return [];

  const courtIds = [...new Set(docs.map(d => fsRefId(d.fields, 'courts')).filter(Boolean))];
  const allUids  = new Set(docs.flatMap(d => raketoPlayerUids(d.fields).slice(0, 4)));

  const [courtMap, userMap] = await Promise.all([
    Promise.all(courtIds.map(async cid => {
      try {
        const r = await fetch(`${RAKETO_FS}/courts/${cid}`);
        const f = (await r.json()).fields || {};
        const name = f.name?.stringValue || '';
        const city = f.city?.stringValue || '';
        return [cid, city ? `${name}, ${city}` : name || '?'];
      } catch { return [cid, '?']; }
    })).then(Object.fromEntries),
    Promise.all([...allUids].map(async uid => {
      try {
        const r = await fetch(`${RAKETO_FS}/users/${uid}`);
        const f = (await r.json()).fields || {};
        return [uid, f.display_name?.stringValue || uid.slice(0, 6)];
      } catch { return [uid, uid.slice(0, 6)]; }
    })).then(Object.fromEntries),
  ]);

  return docs.map(d => {
    const f   = d.fields || {};
    const ts  = f.time_from?.timestampValue;
    const dt  = ts ? new Date(ts) : null;
    const cid = fsRefId(f, 'courts');
    const type = f.type?.stringValue || '';
    const finalized = fsBool(f, 'finalized');
    const playerNames = raketoPlayerUids(d.fields).slice(0, 4).map(uid => userMap[uid] || uid.slice(0, 6));
    return {
      id: d.name.split('/').pop(),
      dateStr:    dt ? dt.toLocaleDateString('uk-UA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
      timeStr:    dt ? dt.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit' }) : '',
      courtName:  cid ? (courtMap[cid] || '?') : 'Без корту',
      players:    playerNames,
      type,
      finalized,
    };
  });
}

function raketoPlayerUids(fields) {
  const standings = fields?.standings?.arrayValue?.values || [];
  const teams     = fields?.teams?.arrayValue?.values     || [];
  const players   = fields?.players?.arrayValue?.values   || [];
  if (standings.length) {
    const uids = [];
    for (const v of standings) {
      const f = v.mapValue?.fields;
      const playerRef = f?.playerRef?.referenceValue;
      if (playerRef) { uids.push(playerRef.split('/').pop()); continue; }
      // TeamAmericano: teamRef.player1Ref / player2Ref
      const p1 = f?.teamRef?.mapValue?.fields?.player1Ref?.referenceValue;
      const p2 = f?.teamRef?.mapValue?.fields?.player2Ref?.referenceValue;
      if (p1) uids.push(p1.split('/').pop());
      if (p2) uids.push(p2.split('/').pop());
    }
    if (uids.length) return uids;
  }
  if (teams.length) {
    return teams.flatMap(v => {
      const f = v.mapValue?.fields;
      return [f?.player1Ref?.referenceValue, f?.player2Ref?.referenceValue]
        .filter(Boolean).map(r => r.split('/').pop());
    });
  }
  return players.map(v => v.referenceValue?.split('/').pop()).filter(Boolean);
}

function fsStr(fields, key)  { return fields?.[key]?.stringValue   || null; }
function fsBool(fields, key) { return fields?.[key]?.booleanValue === true; }
function fsRefId(fields, key) {
  const ref = fields?.[key]?.referenceValue;
  return ref ? ref.split('/').pop() : null;
}

/* ════════════════════════════════════════════════════════════════
   ADMIN — WIRE ACTIONS
════════════════════════════════════════════════════════════════ */

function wireAdminPanel() {
  document.getElementById('btn-create-tournament').addEventListener('click', openCreateTournament);
  document.getElementById('btn-submit-results').addEventListener('click', openSubmitResults);
  document.getElementById('btn-manage-participants').addEventListener('click', openParticipantsModal);
  document.getElementById('btn-users').addEventListener('click', openUsersModal);
  document.getElementById('btn-admin-import').addEventListener('click', openAdminImportModal);
  document.getElementById('btn-admin-analysis').addEventListener('click', openAdminAnalysisModal);
  initAdminImportModal();
}

/* ── Admin import from Raketo ───────────────────────────────────── */
let adminImportModalInitialized = false;

async function searchRaketoByName(query) {
  const url = 'https://firestore.googleapis.com/v1/projects/georgia-tennis/databases/(default)/documents:runQuery';
  const sentinel = query + '';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: 'users' }],
        select: { fields: [
          { fieldPath: 'display_name' },
          { fieldPath: 'photo_url' },
          { fieldPath: 'ratings' },
          { fieldPath: 'matches' },
          { fieldPath: 'gender' },
          { fieldPath: 'telegram' },
        ]},
        where: {
          compositeFilter: {
            op: 'AND',
            filters: [
              { fieldFilter: { field: { fieldPath: 'display_name' }, op: 'GREATER_THAN_OR_EQUAL', value: { stringValue: query } } },
              { fieldFilter: { field: { fieldPath: 'display_name' }, op: 'LESS_THAN',             value: { stringValue: sentinel } } },
            ],
          },
        },
        limit: 10,
      },
    }),
  });
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error?.message || 'Raketo API error ' + res.status);
  const items = Array.isArray(body) ? body : [];
  const errItem = items.find(i => i.error);
  if (errItem) throw new Error(errItem.error.message || 'Raketo error');
  return items.filter(i => i.document).map(i => {
    const parsed = parseRaketoDoc(i.document);
    if (!parsed) return null;
    return { ...parsed, docId: i.document.name?.split('/').pop() || null };
  }).filter(Boolean);
}

function renderAdminRaketoResult(u, selected) {
  const dotCls = u.color.toLowerCase();
  const ratingStr = u.padelRating > 0 ? u.padelRating.toFixed(3) : '—';
  const initStr = u.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
  return `<div class="raketo-result${selected ? ' active' : ''}" data-doc-id="${u.docId}">
    <div class="raketo-result-avatar">
      ${u.photoUrl
        ? `<img src="${u.photoUrl}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${initStr}</span>`
        : initStr}
    </div>
    <div class="raketo-result-body">
      <div class="raketo-result-name">${u.name}</div>
      <div class="raketo-result-meta">
        <span class="raketo-result-dot ${dotCls}"></span>
        <span class="raketo-result-rating">Padel ${ratingStr}</span>
        <span class="raketo-result-matches">${u.padelMatches} матчів</span>
        ${u.telegramHandle ? `<span style="font-size:11px;color:var(--text-muted)">@${u.telegramHandle}</span>` : ''}
      </div>
    </div>
  </div>`;
}

let aiSelectedUser = null;
let aiSelectedGender = null;

function updateAiImportBtn() {
  document.getElementById('ai-import-btn').disabled = !(aiSelectedUser && aiSelectedGender);
}

async function doAdminSearch() {
  const searchInput  = document.getElementById('ai-search-input');
  const resultsBox   = document.getElementById('ai-results');
  const selectedBox  = document.getElementById('ai-selected');
  const selectedCard = document.getElementById('ai-selected-card');

  const q = searchInput.value.trim();
  if (q.length < 2) {
    resultsBox.innerHTML = '<div class="raketo-no-result">Введіть мінімум 2 символи</div>';
    return;
  }
  resultsBox.innerHTML = '<div class="raketo-searching">Пошук у Raketo...</div>';
  selectedBox.style.display = 'none';
  aiSelectedUser = null;
  aiSelectedGender = null;
  updateAiImportBtn();
  try {
    const results = await searchRaketoByName(q);
    if (!results.length) {
      resultsBox.innerHTML = '<div class="raketo-no-result">Гравців не знайдено за цим ім\'ям</div>';
      return;
    }
    resultsBox.innerHTML = `<div class="raketo-results" id="ai-result-list">
      ${results.map(u => renderAdminRaketoResult(u, false)).join('')}
    </div>`;
    resultsBox.querySelectorAll('.raketo-result').forEach((el, idx) => {
      el.style.cursor = 'pointer';
      el.addEventListener('click', () => {
        aiSelectedUser = results[idx];
        resultsBox.querySelectorAll('.raketo-result').forEach(r => r.classList.remove('active'));
        el.classList.add('active');
        selectedCard.innerHTML = renderAdminRaketoResult(aiSelectedUser, true);
        selectedBox.style.display = '';
        if (aiSelectedUser.gender) {
          aiSelectedGender = aiSelectedUser.gender;
          document.querySelectorAll('#ai-gender .claim-chip').forEach(b => {
            b.classList.toggle('active', b.dataset.val === aiSelectedUser.gender);
          });
        } else {
          aiSelectedGender = null;
          document.querySelectorAll('#ai-gender .claim-chip').forEach(b => b.classList.remove('active'));
        }
        updateAiImportBtn();
      });
    });
  } catch (e) {
    resultsBox.innerHTML = `<div class="raketo-no-result">Помилка: ${e.message}</div>`;
  }
}

function initAdminImportModal() {
  if (adminImportModalInitialized) return;
  adminImportModalInitialized = true;

  const searchBtn  = document.getElementById('ai-search-btn');
  const searchInput = document.getElementById('ai-search-input');
  const importBtn  = document.getElementById('ai-import-btn');

  searchBtn.addEventListener('click', doAdminSearch);
  searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doAdminSearch(); });

  document.querySelectorAll('#ai-gender .claim-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ai-gender .claim-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      aiSelectedGender = btn.dataset.val;
      updateAiImportBtn();
    });
  });

  importBtn.addEventListener('click', async () => {
    if (!aiSelectedUser || !aiSelectedGender) return;
    importBtn.disabled = true;
    importBtn.textContent = '...';
    try {
      await API.users.adminImportFromRaketo({
        displayName:            aiSelectedUser.name,
        gender:                 aiSelectedGender,
        raketoRating:           aiSelectedUser.padelRating,
        raketoColor:            aiSelectedUser.color,
        raketoDocId:            aiSelectedUser.docId,
        raketoTelegramUsername: aiSelectedUser.telegramHandle || null,
        photoUrl:               aiSelectedUser.photoUrl || null,
      });
      closeModal('modal-admin-import');
      alert(`Гравця "${aiSelectedUser.name}" успішно додано!`);
    } catch (e) {
      alert('Помилка: ' + (e.message || 'unknown'));
      importBtn.disabled = false;
      importBtn.textContent = 'Додати гравця';
    }
  });
}

function openAdminImportModal() {
  openModal('modal-admin-import');
  aiSelectedUser = null;
  aiSelectedGender = null;
  document.getElementById('ai-search-input').value = '';
  document.getElementById('ai-results').innerHTML = '';
  document.getElementById('ai-selected').style.display = 'none';
  document.getElementById('ai-import-btn').disabled = true;
  document.getElementById('ai-import-btn').textContent = 'Додати гравця';
  document.querySelectorAll('#ai-gender .claim-chip').forEach(b => b.classList.remove('active'));
}

/* ── Modal helpers ──────────────────────────────────────────────── */
function openModal(id) {
  document.getElementById(id).classList.add('open');
}
function closeModal(id) {
  document.getElementById(id).classList.remove('open');
  if (id === 'modal-analysis') destroyCharts();
  if (id === 'modal-achievement' && achTrophyCleanup) { achTrophyCleanup(); achTrophyCleanup = null; }
}
document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});

document.getElementById('btn-rating-info').addEventListener('click', () => openModal('modal-rating-guide'));

document.getElementById('btn-help').addEventListener('click', () => {
  localStorage.removeItem('bsp_intro_seen');
  initOnboarding();
});

document.getElementById('ratings-filter').addEventListener('click', e => {
  const chip = e.target.closest('.filter-chip');
  if (!chip) return;
  document.querySelectorAll('#ratings-filter .filter-chip').forEach(c => c.classList.remove('active'));
  chip.classList.add('active');
  activeRatingFilter = chip.dataset.level;
  renderRatings();
});

/* ── Create / Edit tournament ───────────────────────────────────── */
let tournamentLevels = null;
let editingTournamentId = null;

async function loadTournamentLevels() {
  if (tournamentLevels) return;
  try {
    tournamentLevels = await API.tournaments.getLevels();
  } catch {
    tournamentLevels = [
      { value:'D', label:'D', ratingCeiling:1499 },
      { value:'D_PLUS', label:'D+', ratingCeiling:1749 },
      { value:'C_MINUS', label:'C−', ratingCeiling:1999 },
      { value:'C', label:'C', ratingCeiling:2249 },
      { value:'C_PLUS', label:'C+', ratingCeiling:2749 },
      { value:'B_MINUS', label:'B−', ratingCeiling:2999 },
      { value:'B', label:'B', ratingCeiling:3249 },
      { value:'B_PLUS', label:'B+', ratingCeiling:'—' },
    ];
  }
}

async function openCreateTournament() {
  editingTournamentId = null;
  document.querySelector('#modal-create-tournament .modal-title').textContent = 'Новий турнір';
  document.getElementById('ct-submit').textContent = 'Створити';
  document.getElementById('ct-name').value = '';
  document.getElementById('ct-date').value = '';
  document.getElementById('ct-time').value = '';
  document.getElementById('ct-max-participants').value = '';
  document.getElementById('ct-min-rating').value = '';
  document.getElementById('ct-max-rating').value = '';
  document.getElementById('ct-location').value = '';
  document.getElementById('ct-price').value = '';
  openModal('modal-create-tournament');
  await loadTournamentLevels();
  const sel = document.getElementById('ct-level');
  sel.innerHTML = tournamentLevels.map(l =>
    `<option value="${l.value}">${l.label} (до ${l.ratingCeiling} pts)</option>`
  ).join('');
  updateLevelHint();
}

async function openEditTournament(t) {
  editingTournamentId = t.id;
  document.querySelector('#modal-create-tournament .modal-title').textContent = 'Редагувати турнір';
  document.getElementById('ct-submit').textContent = 'Зберегти';
  openModal('modal-create-tournament');
  await loadTournamentLevels();
  const sel = document.getElementById('ct-level');
  sel.innerHTML = tournamentLevels.map(l =>
    `<option value="${l.value}">${l.label} (до ${l.ratingCeiling} pts)</option>`
  ).join('');
  document.getElementById('ct-name').value = t.name || '';
  document.getElementById('ct-date').value = t.date || '';
  document.getElementById('ct-time').value = t.time ? t.time.slice(0, 5) : '';
  sel.value = t.level || '';
  document.getElementById('ct-type').value = t.type || 'PAIR';
  document.getElementById('ct-max-participants').value = t.maxParticipants || '';
  document.getElementById('ct-min-rating').value = t.minRating || '';
  document.getElementById('ct-max-rating').value = t.maxRating || '';
  document.getElementById('ct-location').value = t.location || '';
  document.getElementById('ct-price').value = t.price || '';
  updateLevelHint();
}

function updateLevelHint() {
  const sel = document.getElementById('ct-level');
  const hint = document.getElementById('ct-level-hint');
  if (!tournamentLevels || !sel.value) { hint.textContent = ''; return; }
  const lvl = tournamentLevels.find(l => l.value === sel.value);
  if (!lvl) return;
  hint.textContent = `Стартові бали: ${lvl.startingPoints}`;
  const maxInput = document.getElementById('ct-max-rating');
  if (!maxInput.value && lvl.ratingCeiling !== '—') maxInput.value = lvl.ratingCeiling;
}

document.getElementById('ct-level').addEventListener('change', updateLevelHint);

document.getElementById('ct-submit').addEventListener('click', async () => {
  const name = document.getElementById('ct-name').value.trim();
  const date = document.getElementById('ct-date').value;
  const level = document.getElementById('ct-level').value;
  const type = document.getElementById('ct-type').value;
  if (!name || !date || !level) { alert('Заповніть всі поля'); return; }
  const maxParticipants = parseInt(document.getElementById('ct-max-participants').value) || null;
  const minRating = parseInt(document.getElementById('ct-min-rating').value) || null;
  const maxRating = parseInt(document.getElementById('ct-max-rating').value) || null;
  const location = document.getElementById('ct-location').value.trim() || null;
  const price = parseInt(document.getElementById('ct-price').value) || null;
  const time = document.getElementById('ct-time').value || null;
  const payload = { name, date, level, type, maxParticipants, minRating, maxRating, location, price, time };

  const btn = document.getElementById('ct-submit');
  btn.disabled = true; btn.textContent = '...';
  try {
    if (editingTournamentId) {
      await API.tournaments.update(editingTournamentId, payload);
      alert('Турнір оновлено!');
    } else {
      await API.tournaments.create(payload);
      alert('Турнір створено!');
    }
    tournamentsData = null;
    closeModal('modal-create-tournament');
    renderResults();
  } catch (e) {
    alert('Помилка: ' + (e.message || 'unknown'));
  } finally {
    btn.disabled = false;
    btn.textContent = editingTournamentId ? 'Зберегти' : 'Створити';
  }
});

/* ── Submit results ─────────────────────────────────────────────── */
let srPairCount = 2;
let srParticipants = [];
let srTournamentType = 'PAIR';
let srTournamentsAll = [];

async function openSubmitResults() {
  openModal('modal-submit-results');
  const sel = document.getElementById('sr-tournament-select');
  sel.innerHTML = '<option>Завантаження...</option>';
  srParticipants = [];
  try {
    srTournamentsAll = await API.tournaments.list();
    const active = srTournamentsAll.filter(t => t.status !== 'FINISHED');
    sel.innerHTML = active.map(t => {
      const typeLabel = t.type === 'SINGLE' ? 'Один.' : 'Пар.';
      return `<option value="${t.id}">${t.name} [${t.levelLabel || t.level || ''} · ${typeLabel}]</option>`;
    }).join('');
    if (!active.length) { sel.innerHTML = '<option>Немає активних турнірів</option>'; return; }
    await loadSrParticipants(sel.value);
  } catch {
    sel.innerHTML = '<option>Помилка завантаження</option>';
  }
}

async function loadSrParticipants(tournamentId) {
  if (!tournamentId) { srParticipants = []; renderPositionRows(); return; }
  const t = srTournamentsAll.find(t => String(t.id) === String(tournamentId));
  srTournamentType = t?.type || 'PAIR';

  document.getElementById('sr-import-info').style.display = 'none';
  const section = document.getElementById('sr-raketo-section');
  section.style.display = t ? 'block' : 'none';
  if (t) renderSrRaketoSection(t);

  try {
    srParticipants = await API.tournaments.getParticipants(tournamentId);
  } catch {
    srParticipants = [];
  }
  const isSingle = srTournamentType === 'SINGLE';
  const count = srParticipants.length;
  srPairCount = count > 0
    ? (isSingle ? count : Math.ceil(count / 2))
    : 4;
  const info = document.getElementById('sr-info');
  if (count > 0) {
    info.textContent = `${count} учасник${count === 1 ? '' : count < 5 ? 'и' : 'ів'} · ${isSingle ? 'одиночний' : 'парний'}`;
  } else {
    info.textContent = 'Учасників не знайдено — оберіть гравців вручну';
  }
  renderPositionRows();
}

function renderSrRaketoSection(t) {
  const section = document.getElementById('sr-raketo-section');
  const tid = String(t.id);
  if (t.raketoId) {
    section.innerHTML = `
      <div style="display:flex;align-items:center;gap:6px">
        <button id="sr-do-import-btn" class="btn-secondary" style="flex:1;font-size:13px">Імпортувати результати з Raketo</button>
        <button id="sr-relink-btn" style="font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;flex-shrink:0;padding:0 4px">Змінити</button>
      </div>`;
    document.getElementById('sr-do-import-btn').addEventListener('click', () => doSrImportFromRaketo(tid));
    document.getElementById('sr-relink-btn').addEventListener('click', () => showSrRaketoFinder(t));
  } else {
    showSrRaketoFinder(t);
  }
}

async function showSrRaketoFinder(t) {
  const section = document.getElementById('sr-raketo-section');
  const tid = String(t.id);
  const defaultDate = t.date || new Date().toISOString().slice(0, 10);
  section.innerHTML = `
    <div style="border:1px solid var(--border-subtle);border-radius:10px;padding:8px">
      <div style="font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:6px">Прив'язати турнір Raketo</div>
      <div style="display:flex;gap:6px;margin-bottom:4px">
        <input type="date" id="sr-rl-date" class="form-input" value="${defaultDate}" style="flex:1;font-size:13px">
        <button id="sr-rl-search" class="btn-secondary" style="font-size:12px;padding:0 12px">Шукати</button>
      </div>
      <div id="sr-rl-results"></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:8px">
        <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
        <span style="font-size:10px;color:var(--text-dim)">або вставити ID напряму</span>
        <div style="flex:1;height:1px;background:var(--border-subtle)"></div>
      </div>
      <div style="display:flex;gap:6px;margin-top:6px">
        <input type="text" id="sr-rl-direct-id" class="form-input" placeholder="ID або посилання з Raketo…" style="flex:1;font-size:12px">
        <button id="sr-rl-direct-btn" class="btn-primary" style="font-size:12px;padding:0 12px;flex-shrink:0">Прив'язати</button>
      </div>
    </div>`;

  const doSearch = async () => {
    const date = document.getElementById('sr-rl-date').value;
    if (!date) return;
    const btn = document.getElementById('sr-rl-search');
    const results = document.getElementById('sr-rl-results');
    btn.disabled = true; btn.textContent = '...';
    results.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">Шукаю в Raketo...</div>';
    try {
      const raketo = await fetchAllRaketoForDate(date);
      if (!raketo.length) {
        results.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">Турнірів не знайдено за цю дату</div>';
        return;
      }
      results.innerHTML = raketo.map(r => {
        const meta = [r.courtName, r.type, r.finalized ? '✓ фінал' : 'не фінал'].filter(Boolean).join(' · ');
        return `<div class="sr-rl-pick" data-raketo-id="${r.id}"
          style="padding:6px 8px;border-radius:8px;background:var(--card-bg);margin-bottom:4px;cursor:pointer;font-size:12px">
          <div style="font-weight:600">${r.timeStr || r.dateStr}</div>
          <div style="color:var(--text-muted);font-size:11px">${meta}</div>
          <div style="color:var(--text-dim);font-size:11px;margin-top:2px">${r.players.join(', ')}</div>
        </div>`;
      }).join('');
      results.querySelectorAll('.sr-rl-pick').forEach(pick => {
        pick.addEventListener('click', async () => {
          pick.style.opacity = '0.5';
          try {
            await API.tournaments.setRaketoId(tid, pick.dataset.raketoId);
            const idx = srTournamentsAll.findIndex(x => String(x.id) === tid);
            if (idx >= 0) srTournamentsAll[idx] = { ...srTournamentsAll[idx], raketoId: pick.dataset.raketoId };
            renderSrRaketoSection({ ...t, raketoId: pick.dataset.raketoId });
          } catch (e) {
            alert('Помилка: ' + (e.message || 'unknown'));
            pick.style.opacity = '1';
          }
        });
      });
    } catch (e) {
      results.innerHTML = `<div style="font-size:11px;color:var(--error)">${e.message || 'Помилка'}</div>`;
    } finally {
      if (document.getElementById('sr-rl-search')) {
        document.getElementById('sr-rl-search').disabled = false;
        document.getElementById('sr-rl-search').textContent = 'Шукати';
      }
    }
  };

  document.getElementById('sr-rl-search').addEventListener('click', doSearch);
  document.getElementById('sr-rl-date').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  const doDirectLink = async () => {
    const raw = document.getElementById('sr-rl-direct-id').value.trim();
    if (!raw) return;
    // Accept a full URL like https://...americano/DOCID or just the bare doc ID
    const docId = raw.split('/').filter(Boolean).pop();
    const btn = document.getElementById('sr-rl-direct-btn');
    btn.disabled = true; btn.textContent = '...';
    try {
      await API.tournaments.setRaketoId(tid, docId);
      const idx = srTournamentsAll.findIndex(x => String(x.id) === tid);
      if (idx >= 0) srTournamentsAll[idx] = { ...srTournamentsAll[idx], raketoId: docId };
      renderSrRaketoSection({ ...t, raketoId: docId });
    } catch (e) {
      alert('Помилка: ' + (e.message || 'unknown'));
      btn.disabled = false; btn.textContent = 'Прив\'язати';
    }
  };
  document.getElementById('sr-rl-direct-btn').addEventListener('click', doDirectLink);
  document.getElementById('sr-rl-direct-id').addEventListener('keydown', e => { if (e.key === 'Enter') doDirectLink(); });
}

async function doSrImportFromRaketo(tournamentId) {
  const importInfo = document.getElementById('sr-import-info');
  const btn = document.getElementById('sr-do-import-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Імпортую...'; }
  importInfo.style.display = 'none';
  try {
    const result = await API.tournaments.importFromRaketo(tournamentId);
    const { tournament, createdUsers, matchedCount } = result;
    const knownIds = new Set(srParticipants.map(u => u.id));
    for (const pair of tournament.pairs) {
      for (const player of [pair.player1, pair.player2].filter(Boolean)) {
        if (!knownIds.has(player.id)) { srParticipants.push(player); knownIds.add(player.id); }
      }
    }
    srPairCount = tournament.pairs.length;
    renderPositionRows();
    for (const pair of tournament.pairs) {
      const p1 = document.getElementById(`p${pair.position}-p1`);
      const p2 = document.getElementById(`p${pair.position}-p2`);
      if (p1) p1.value = String(pair.player1.id);
      if (p2 && pair.player2) p2.value = String(pair.player2.id);
    }
    let summary = `Знайдено у системі: ${matchedCount}.`;
    if (createdUsers.length) summary += ` Додано нових: ${createdUsers.map(u => u.displayName).join(', ')}.`;
    importInfo.textContent = summary;
    importInfo.style.display = 'block';
    tournamentsData = null;
    showToast('Результати з Raketo імпортовано', 'success');
  } catch (e) {
    alert('Помилка імпорту: ' + (e.message || 'unknown'));
  } finally {
    if (document.getElementById('sr-do-import-btn')) {
      document.getElementById('sr-do-import-btn').disabled = false;
      document.getElementById('sr-do-import-btn').textContent = 'Імпортувати результати з Raketo';
    }
  }
}

document.getElementById('sr-tournament-select').addEventListener('change', async e => {
  await loadSrParticipants(e.target.value);
});


function participantOptions() {
  return `<option value="">— гравець —</option>` +
    [...srParticipants]
      .sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''))
      .map(u => `<option value="${u.id}">${u.displayName}</option>`).join('');
}

function renderPositionRows() {
  const c = document.getElementById('sr-pairs-container');
  const isSingle = srTournamentType === 'SINGLE';
  const opts = participantOptions();
  let html = '';
  for (let i = 1; i <= srPairCount; i++) {
    const posLabel = i === 1 ? '🥇' : i === 2 ? '🥈' : i === 3 ? '🥉' : `${i}.`;
    html += `<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <span style="min-width:28px;font-size:16px;text-align:center">${posLabel}</span>
      <div style="flex:1;display:flex;gap:6px">
        <select class="form-select" id="p${i}-p1" style="flex:1">${opts}</select>
        ${isSingle ? '' : `<select class="form-select" id="p${i}-p2" style="flex:1">${opts}</select>`}
      </div>
    </div>`;
  }
  c.innerHTML = html;
}

document.getElementById('sr-add-pair').addEventListener('click', () => {
  srPairCount++;
  renderPositionRows();
});

function buildPairsPayload() {
  const isSingle = srTournamentType === 'SINGLE';
  const pairs = [];
  for (let i = 1; i <= srPairCount; i++) {
    const p1val = document.getElementById(`p${i}-p1`)?.value;
    const p1Id = p1val ? parseInt(p1val, 10) : 0;
    if (!p1Id) continue;
    const p2val = !isSingle ? document.getElementById(`p${i}-p2`)?.value : '';
    const p2Id = p2val ? parseInt(p2val, 10) : null;
    pairs.push({ player1Id: p1Id, player2Id: p2Id || null, position: i, matchWins: 0, matchLosses: 0 });
  }
  const seen = new Set();
  for (const p of pairs) {
    for (const id of [p.player1Id, p.player2Id]) {
      if (id == null) continue;
      if (seen.has(id)) throw new Error('Один гравець зустрічається в результатах двічі. Будь ласка, перевірте дані.');
      seen.add(id);
    }
  }
  return pairs;
}

document.getElementById('sr-submit').addEventListener('click', async () => {
  const tournamentId = document.getElementById('sr-tournament-select').value;
  if (!tournamentId) return;
  const btn = document.getElementById('sr-submit');
  btn.disabled = true; btn.textContent = '...';
  try {
    const pairs = buildPairsPayload();
    await API.tournaments.submitResults(tournamentId, { pairs });
    tournamentsData = null;
    closeModal('modal-submit-results');
    alert('Результати збережено!');
  } catch (e) {
    alert('Помилка: ' + (e.message || 'unknown'));
  } finally {
    btn.disabled = false; btn.textContent = 'Зберегти';
  }
});

document.getElementById('sr-finalize').addEventListener('click', async () => {
  const tournamentId = document.getElementById('sr-tournament-select').value;
  if (!tournamentId) return;
  if (!confirm('Завершити турнір і нарахувати рейтинг? Цю дію не можна скасувати.')) return;
  const btn = document.getElementById('sr-finalize');
  btn.disabled = true; btn.textContent = '...';
  try {
    const pairs = buildPairsPayload();
    if (pairs.length) await API.tournaments.submitResults(tournamentId, { pairs });
    await API.tournaments.finalize(tournamentId);
    tournamentsData = null;
    ratingsData = null;
    closeModal('modal-submit-results');
    alert('Турнір завершено! Рейтинги оновлено.');
  } catch (e) {
    alert('Помилка: ' + (e.message || 'unknown'));
  } finally {
    btn.disabled = false; btn.textContent = 'Завершити та нарахувати рейтинг';
  }
});

/* ── Users modal ────────────────────────────────────────────────── */
const LEVEL_OPTIONS = [
  { value:'D',       label:'D'  },
  { value:'D_PLUS',  label:'D+' },
  { value:'C_MINUS', label:'C−' },
  { value:'C',       label:'C'  },
  { value:'C_PLUS',  label:'C+' },
  { value:'B_MINUS', label:'B−' },
  { value:'B',       label:'B'  },
  { value:'B_PLUS',  label:'B+' },
];

function inferLevel(startingPoints) {
  const pts = [1000,1250,1500,1750,2000,2500,2750,3000];
  const idx = pts.indexOf(startingPoints);
  return idx >= 0 ? LEVEL_OPTIONS[idx].value : '';
}

async function openUsersModal() {
  openModal('modal-users');
  const list = document.getElementById('users-list');
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Завантаження...</div>';
  try {
    const users = await API.users.list();
    const levelOptHtml = LEVEL_OPTIONS.map(l => `<option value="${l.value}">${l.label}</option>`).join('');
    list.innerHTML = users.map(u => `
      <div class="user-list-item" data-user-id="${u.id}" style="flex-wrap:wrap;gap:6px${u.adminImported && !u.telegramId ? ';opacity:0.75' : ''}">
        <div class="user-list-avatar">
          ${u.photoUrl ? `<img src="${u.photoUrl}" alt="">` : initials(u.displayName)}
        </div>
        <div class="user-list-info">
          <div class="user-list-name">${u.displayName}${u.adminImported && !u.telegramId ? ' <span style="font-size:10px;color:var(--text-dim);font-weight:600">Raketo·не зареєстрований</span>' : ''}</div>
          <div class="user-list-pts">${u.ratingPoints} pts (старт: ${u.startingPoints || 0})${u.raketoTelegramUsername ? ` · @${u.raketoTelegramUsername}` : ''}</div>
        </div>
        <div style="display:flex;gap:4px;margin-left:auto;flex-wrap:wrap;justify-content:flex-end">
          <input class="form-input rating-edit-input" type="number" min="0"
                 data-user-id="${u.id}" value="${u.startingPoints || 0}"
                 title="Стартові бали" placeholder="Рейтинг">
          <select class="form-select level-select" data-user-id="${u.id}"
                  style="font-size:12px;padding:4px 8px;height:32px;width:60px">
            <option value="">—</option>
            ${levelOptHtml}
          </select>
          <button class="role-toggle ${u.role === 'ADMIN' ? 'is-admin' : 'is-player'}"
                  data-user-id="${u.id}" data-role="${u.role}" style="height:32px">
            ${u.role === 'ADMIN' ? 'Admin' : 'Player'}
          </button>
          <button class="merge-user-btn" data-user-id="${u.id}" title="Об'єднати акаунти" style="height:32px;width:32px;display:flex;align-items:center;justify-content:center;border-radius:8px;border:1px solid var(--border-subtle);background:none;cursor:pointer;color:var(--text-muted)">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/></svg>
          </button>
          <button class="delete-user-btn" data-user-id="${u.id}" title="Видалити гравця">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
        <div class="user-merge-area" style="display:none;width:100%;padding-top:6px;border-top:1px solid var(--border-subtle);margin-top:2px">
          <div style="font-size:11px;font-weight:600;color:var(--text-dim);margin-bottom:6px">Об'єднати — оберіть другий акаунт (він буде видалений):</div>
          <div class="user-merge-candidates" style="max-height:180px;overflow-y:auto;display:flex;flex-direction:column;gap:3px"></div>
          <button class="merge-cancel-btn" style="width:100%;font-size:11px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:6px 0;margin-top:2px">Скасувати</button>
        </div>
        <div class="user-raketo-link" style="width:100%;padding-top:4px;border-top:1px solid var(--border-subtle);margin-top:2px">
          ${u.raketoDocId
            ? `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)">
                 <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                 Raketo: <span style="font-family:monospace;color:var(--text-dim)">${u.raketoDocId.slice(0,10)}…</span>
                 <button class="rl-change-btn" style="margin-left:auto;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0">Змінити</button>
               </div>`
            : `<button class="rl-link-btn btn-secondary" style="width:100%;font-size:11px;padding:4px 0">Прив'язати Raketo профіль</button>`
          }
          <div class="rl-search-area" style="display:none;margin-top:6px">
            <div style="display:flex;gap:4px;margin-bottom:4px">
              <input class="form-input rl-search-input" placeholder="Ім'я в Raketo..." style="flex:1;font-size:12px">
              <button class="btn-secondary rl-search-btn" style="font-size:11px;padding:0 10px">Шукати</button>
            </div>
            <div class="rl-results"></div>
          </div>
        </div>
      </div>
    `).join('');

    list.querySelectorAll('.rating-edit-input').forEach(inp => {
      inp.addEventListener('change', async () => {
        const pts = parseInt(inp.value, 10);
        if (isNaN(pts) || pts < 0) return;
        inp.disabled = true;
        try {
          await API.users.setRatingPoints(inp.dataset.userId, pts);
        } catch (e) {
          alert('Помилка: ' + (e.message || 'unknown'));
        } finally {
          inp.disabled = false;
        }
      });
    });

    list.querySelectorAll('.level-select').forEach(sel => {
      sel.value = inferLevel(users.find(u => String(u.id) === sel.dataset.userId)?.startingPoints || 0);
      sel.addEventListener('change', async () => {
        const level = sel.value;
        if (!level) return;
        sel.disabled = true;
        try {
          await API.users.setStartingPoints(sel.dataset.userId, level);
          const levelPts = {D:1000,D_PLUS:1250,C_MINUS:1500,C:1750,C_PLUS:2000,B_MINUS:2500,B:2750,B_PLUS:3000};
          const row = list.querySelector(`.rating-edit-input[data-user-id="${sel.dataset.userId}"]`);
          if (row && levelPts[level]) row.value = levelPts[level];
        } catch (e) {
          alert('Помилка: ' + (e.message || 'unknown'));
        } finally {
          sel.disabled = false;
        }
      });
    });

    list.querySelectorAll('.role-toggle').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.userId;
        const newRole = btn.dataset.role === 'ADMIN' ? 'PLAYER' : 'ADMIN';
        btn.disabled = true;
        try {
          await API.users.setRole(userId, newRole);
          btn.dataset.role = newRole;
          btn.textContent = newRole === 'ADMIN' ? 'Admin' : 'Player';
          btn.className = `role-toggle ${newRole === 'ADMIN' ? 'is-admin' : 'is-player'}`;
        } catch (e) {
          alert('Помилка: ' + (e.message || 'unknown'));
        } finally {
          btn.disabled = false;
        }
      });
    });

    list.querySelectorAll('.delete-user-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const row = list.querySelector(`.user-list-item[data-user-id="${btn.dataset.userId}"]`);
        const name = row?.querySelector('.user-list-name')?.textContent?.trim() || 'цього гравця';
        if (!confirm(`Видалити ${name}? Цю дію не можна скасувати.`)) return;
        btn.disabled = true;
        try {
          await API.users.delete(btn.dataset.userId);
          row?.remove();
        } catch (e) {
          alert('Помилка: ' + (e.message || 'unknown'));
          btn.disabled = false;
        }
      });
    });

    list.querySelectorAll('.merge-user-btn').forEach(btn => {
      const userId = btn.dataset.userId;
      const item = list.querySelector(`.user-list-item[data-user-id="${userId}"]`);
      const mergeArea = item.querySelector('.user-merge-area');
      const candidatesEl = item.querySelector('.user-merge-candidates');

      btn.addEventListener('click', () => {
        const isOpen = mergeArea.style.display !== 'none';
        list.querySelectorAll('.user-merge-area').forEach(a => { a.style.display = 'none'; });
        if (isOpen) return;

        const otherUsers = users.filter(u => String(u.id) !== userId);
        candidatesEl.innerHTML = otherUsers.map(u => {
          const typeLabel = u.adminImported && !u.telegramId ? 'Raketo-імпорт' : 'Telegram';
          const typeColor = u.adminImported && !u.telegramId ? 'var(--gold)' : 'var(--success)';
          return `<div class="merge-candidate" data-target-id="${u.id}"
            style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--card-bg);cursor:pointer;font-size:12px;border:1px solid transparent">
            <div style="flex:1;min-width:0">
              <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${u.displayName}</div>
              <div style="font-size:10px;color:var(--text-muted)">${u.ratingPoints} pts · <span style="color:${typeColor}">${typeLabel}</span></div>
            </div>
            <span style="font-size:11px;color:var(--text-muted);flex-shrink:0">Обрати →</span>
          </div>`;
        }).join('');

        candidatesEl.querySelectorAll('.merge-candidate').forEach(cand => {
          cand.addEventListener('mouseenter', () => { cand.style.borderColor = 'var(--border-strong)'; });
          cand.addEventListener('mouseleave', () => { cand.style.borderColor = 'transparent'; });
          cand.addEventListener('click', async () => {
            const targetId = cand.dataset.targetId;
            const keepUser = users.find(u => String(u.id) === userId);
            const delUser  = users.find(u => String(u.id) === targetId);
            if (!confirm(`Об'єднати акаунти?\n\n"${delUser.displayName}" буде видалено.\nВсі матчі та рейтинг перенесуться до "${keepUser.displayName}".`)) return;

            cand.style.opacity = '0.5';
            try {
              await API.users.mergeUsers(userId, targetId);
              list.querySelector(`.user-list-item[data-user-id="${targetId}"]`)?.remove();
              mergeArea.style.display = 'none';
              showToast(`Акаунти об'єднано`, 'success');
            } catch (e) {
              alert('Помилка: ' + (e.message || 'unknown'));
              cand.style.opacity = '1';
            }
          });
        });

        mergeArea.style.display = 'block';
      });

      item.querySelector('.merge-cancel-btn').addEventListener('click', () => {
        mergeArea.style.display = 'none';
      });
    });

    list.querySelectorAll('.user-list-item').forEach(item => {
      const userId = item.dataset.userId;
      const linkArea = item.querySelector('.rl-search-area');
      const resultsBox = item.querySelector('.rl-results');

      const openSearch = () => { linkArea.style.display = 'block'; };

      item.querySelector('.rl-link-btn')?.addEventListener('click', openSearch);
      item.querySelector('.rl-change-btn')?.addEventListener('click', openSearch);

      const searchBtn = item.querySelector('.rl-search-btn');
      const searchInput = item.querySelector('.rl-search-input');
      if (!searchBtn) return;

      const doRlSearch = async () => {
        const q = searchInput.value.trim();
        if (q.length < 2) { resultsBox.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">Мінімум 2 символи</div>'; return; }
        searchBtn.disabled = true; searchBtn.textContent = '...';
        resultsBox.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">Пошук...</div>';
        try {
          const results = await searchRaketoByName(q);
          if (!results.length) { resultsBox.innerHTML = '<div style="font-size:11px;color:var(--text-muted)">Не знайдено</div>'; return; }
          resultsBox.innerHTML = results.map(r =>
            `<div class="rl-pick" data-doc-id="${r.docId}" data-raketo-name="${(r.name || '').replace(/"/g, '&quot;')}" style="padding:6px 8px;border-radius:8px;background:var(--card-bg);margin-bottom:4px;cursor:pointer;font-size:12px">
               <div style="font-weight:600">${r.name}</div>
               <div style="color:var(--text-muted);font-size:11px">${r.padelRating > 0 ? r.padelRating.toFixed(3) : '—'} · ${r.padelMatches} матчів${r.telegramHandle ? ' · @' + r.telegramHandle : ''}</div>
             </div>`
          ).join('');
          resultsBox.querySelectorAll('.rl-pick').forEach(pick => {
            pick.addEventListener('click', async () => {
              pick.style.opacity = '0.5';
              try {
                await API.users.setRaketoDocId(userId, pick.dataset.docId, pick.dataset.raketoName);
                linkArea.style.display = 'none';
                const linkDiv = item.querySelector('.user-raketo-link');
                linkDiv.innerHTML = `<div style="display:flex;align-items:center;gap:6px;font-size:11px;color:var(--text-muted)">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="3" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                  Raketo: <span style="font-family:monospace;color:var(--text-dim)">${pick.dataset.docId.slice(0,10)}…</span>
                </div>`;
              } catch (e) {
                alert('Помилка: ' + (e.message || 'unknown'));
                pick.style.opacity = '1';
              }
            });
          });
        } catch (e) {
          resultsBox.innerHTML = `<div style="font-size:11px;color:var(--error)">${e.message || 'Помилка'}</div>`;
        } finally {
          searchBtn.disabled = false; searchBtn.textContent = 'Шукати';
        }
      };

      searchBtn.addEventListener('click', doRlSearch);
      searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doRlSearch(); });
    });
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">${e.message}</div>`;
  }
}

/* ── Participants modal ──────────────────────────────────────────── */
let pmAllUsers = [];
let pmParticipantIds = new Set();
let pmTournaments = [];

async function openParticipantsModal() {
  openModal('modal-participants');
  const sel = document.getElementById('pm-tournament-select');
  sel.innerHTML = '<option>Завантаження...</option>';
  document.getElementById('pm-addable-list').innerHTML = '';
  document.getElementById('pm-slots').textContent = '';
  document.getElementById('pm-search').value = '';
  pmAllUsers = [];
  pmParticipantIds = new Set();
  pmTournaments = [];

  try {
    const [allTournaments, allUsers] = await Promise.all([
      API.tournaments.list(),
      API.users.list(),
    ]);
    pmAllUsers = allUsers;

    const active = allTournaments.filter(t => t.status !== 'FINISHED');
    if (!active.length) { sel.innerHTML = '<option>Немає активних турнірів</option>'; return; }
    pmTournaments = active;
    sel.innerHTML = active.map(t => `<option value="${t.id}">${t.name} [${t.level || ''}]</option>`).join('');

    await renderParticipantList(sel.value);
  } catch (e) {
    sel.innerHTML = `<option>Помилка: ${e.message}</option>`;
  }
}

function updateSlotsIndicator(currentCount, maxParticipants) {
  const el = document.getElementById('pm-slots');
  if (!el) return;
  if (!maxParticipants) { el.textContent = `${currentCount} учасників · без обмеження`; el.style.color = 'var(--text-muted)'; return; }
  const free = maxParticipants - currentCount;
  if (free <= 0) {
    el.textContent = `${currentCount} / ${maxParticipants} · турнір заповнений`;
    el.style.color = 'var(--error, #e05050)';
  } else {
    el.textContent = `${currentCount} / ${maxParticipants} учасників · ${free} вільних ${free === 1 ? 'місце' : free < 5 ? 'місця' : 'місць'}`;
    el.style.color = free <= 2 ? '#e09050' : 'var(--gold)';
  }
}

async function renderParticipantList(tournamentId) {
  const container = document.getElementById('pm-participants-list');
  if (!tournamentId) { container.innerHTML = ''; pmParticipantIds = new Set(); renderAddableList(); return; }
  container.innerHTML = '<div style="color:var(--text-muted);font-size:13px">Завантаження...</div>';
  try {
    const participants = await API.tournaments.getParticipants(tournamentId);
    pmParticipantIds = new Set(participants.map(u => u.id));

    const tournament = pmTournaments.find(t => String(t.id) === String(tournamentId));
    updateSlotsIndicator(participants.length, tournament?.maxParticipants);

    if (!participants.length) {
      container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Учасників ще немає</div>';
    } else {
      container.innerHTML = participants.map(u => `
        <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-sub)">
          <span style="flex:1;font-size:13px">${u.displayName}</span>
          <span style="font-size:11px;color:var(--text-muted)">${u.ratingPoints} pts</span>
          <button class="pm-remove-btn" data-tournament-id="${tournamentId}" data-user-id="${u.id}"
                  style="color:var(--error);background:none;border:none;cursor:pointer;font-size:16px;line-height:1;padding:2px 6px">✕</button>
        </div>
      `).join('');

      container.querySelectorAll('.pm-remove-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await API.tournaments.removeParticipant(btn.dataset.tournamentId, btn.dataset.userId);
            await renderParticipantList(btn.dataset.tournamentId);
          } catch (e) {
            alert('Помилка: ' + (e.message || 'unknown'));
            btn.disabled = false;
          }
        });
      });
    }

    renderAddableList();
  } catch (e) {
    container.innerHTML = `<div style="color:var(--error);font-size:13px">${e.message}</div>`;
  }
}

function renderAddableList() {
  const query = (document.getElementById('pm-search')?.value || '').toLowerCase().trim();
  const list = document.getElementById('pm-addable-list');
  const tournamentId = document.getElementById('pm-tournament-select').value;

  const available = pmAllUsers.filter(u =>
    !pmParticipantIds.has(u.id) &&
    (!query || u.displayName.toLowerCase().includes(query))
  ).sort((a, b) => (a.displayName || '').localeCompare(b.displayName || ''));

  if (!available.length) {
    list.innerHTML = query
      ? `<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Нікого не знайдено</div>`
      : `<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Всі гравці вже у турнірі</div>`;
    return;
  }

  list.innerHTML = available.map(u => `
    <button class="pm-addable-row" data-user-id="${u.id}"
            style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:6px;width:100%;
                   background:none;border:none;color:inherit;text-align:left;cursor:pointer;
                   touch-action:manipulation;-webkit-tap-highlight-color:transparent">
      <span style="flex:1;font-size:13px">${u.displayName}</span>
      <span style="font-size:11px;color:var(--text-muted)">${u.ratingPoints} pts</span>
      <span style="font-size:12px;color:var(--gold);font-weight:600">+</span>
    </button>
  `).join('');

  list.querySelectorAll('.pm-addable-row').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (btn.disabled) return;
      btn.disabled = true;
      btn.style.opacity = '0.5';
      try {
        await API.tournaments.addParticipant(tournamentId, btn.dataset.userId);
        document.getElementById('pm-search').value = '';
        await renderParticipantList(tournamentId);
      } catch (e) {
        alert('Помилка: ' + (e.message || 'unknown'));
        btn.style.opacity = '';
        btn.disabled = false;
      }
    });
  });
}

document.getElementById('pm-tournament-select').addEventListener('change', e => {
  document.getElementById('pm-search').value = '';
  renderParticipantList(e.target.value);
});

document.getElementById('pm-search').addEventListener('input', renderAddableList);

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
    renderProfile(); // always re-render profile to reflect auth state
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
let confirmBtnLabel = 'Зареєструватися';

function showRegistrationConfirm(tournament, alreadyEnrolled = false) {
  pendingJoinTournamentId = alreadyEnrolled ? null : tournament.id;
  const isFull = tournament.maxParticipants && (tournament.participantCount || 0) >= tournament.maxParticipants;
  confirmBtnLabel = alreadyEnrolled ? 'Вже зареєстровані' : (isFull ? 'Перейти до резерву' : 'Зареєструватися');

  // Tournament card
  const dateObj = new Date(tournament.date);
  const dateStr = `${dateObj.getDate()} ${MONTHS_UK_LONG[dateObj.getMonth()]} ${dateObj.getFullYear()}, ${DAYS_UK_LONG[dateObj.getDay()]}`;

  let html = `<div class="rc-name">${tournament.name}</div>`;
  html += `<div class="rc-detail"><span class="rc-detail-icon">📅</span>${dateStr}</div>`;
  if (tournament.time) {
    html += `<div class="rc-detail"><span class="rc-detail-icon">⏰</span>${tournament.time.slice(0, 5)}</div>`;
  }
  if (tournament.location) {
    html += `<div class="rc-detail"><span class="rc-detail-icon">📍</span>${tournament.location}</div>`;
  }

  const tags = [];
  if (tournament.minRating != null || tournament.maxRating != null) {
    const lo = tournament.minRating ?? 0;
    const hi = tournament.maxRating != null ? tournament.maxRating : '∞';
    tags.push(`<span class="rc-tag rc-tag-gold">⚡ ${lo} – ${hi}</span>`);
  }
  if (tournament.levelLabel) tags.push(`<span class="rc-tag">${tournament.levelLabel}</span>`);
  tags.push(`<span class="rc-tag">${tournament.type === 'SINGLE' ? 'Одиночний' : 'Парний'}</span>`);
  html += `<div class="rc-tags">${tags.join('')}</div>`;

  document.getElementById('reg-confirm-card').innerHTML = html;

  // Price section
  const priceSection = document.getElementById('reg-confirm-price');
  if (tournament.price && tournament.price > 0) {
    document.getElementById('reg-confirm-price-amount').textContent = `${tournament.price} грн`;
    priceSection.classList.remove('hidden');
  } else {
    priceSection.classList.add('hidden');
  }

  const btn = document.getElementById('reg-confirm-submit');
  btn.textContent = confirmBtnLabel;
  btn.disabled = alreadyEnrolled;

  document.getElementById('reg-confirm').classList.add('reg-confirm-visible');
}

function hideRegistrationConfirm() {
  document.getElementById('reg-confirm').classList.remove('reg-confirm-visible');
  pendingJoinTournamentId = null;
}

document.getElementById('reg-confirm-back').addEventListener('click', hideRegistrationConfirm);

document.getElementById('reg-confirm-submit').addEventListener('click', async () => {
  if (!pendingJoinTournamentId) return;
  const btn = document.getElementById('reg-confirm-submit');
  btn.disabled = true;
  btn.textContent = '...';
  try {
    const res = await API.tournaments.join(pendingJoinTournamentId);
    hideRegistrationConfirm();
    tournamentsData = null;
    if (res && res.reserved) {
      showToast('Ви додані до резерву турніру 🎾', 'info');
    } else {
      showToast('Ви успішно зареєстровані! 🎾', 'success');
    }
    switchTab('results');
    await renderResults();
  } catch (e) {
    const msg = e.message || '';
    if (msg.includes('already enrolled')) {
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

/* ════════════════════════════════════════════════════════════════
   INIT
════════════════════════════════════════════════════════════════ */

// Render default tab immediately with fallback data — page is usable before API responds
/* ════════════════════════════════════════════════════════════════
   HOME SCREEN BANNER
════════════════════════════════════════════════════════════════ */

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
      if (typeof tg.addToHomeScreen === 'function') tg.addToHomeScreen();
      banner.classList.remove('hs-visible');
      localStorage.setItem('bsp_hs_added', '1');
    });

    document.getElementById('hs-dismiss-btn').addEventListener('click', () => {
      banner.classList.remove('hs-visible');
      localStorage.setItem('bsp_hs_dismissed', Date.now().toString());
    });
  }

  if (typeof tg.checkHomeScreenStatus === 'function') {
    tg.checkHomeScreenStatus(status => {
      if (status === 'added') { localStorage.setItem('bsp_hs_added', '1'); return; }
      if (status === 'unsupported') return;
      showBanner();
    });
  } else {
    showBanner();
  }
}

renderRatings();

apiBootstrap().then(async () => {
  if (apiAvailable) {
    ratingsData = null; // discard fallback, re-render with real data
    renderRatings();
  }

  updateMemberCount();

  const startParam = tg?.initDataUnsafe?.start_param;
  if (startParam && startParam.startsWith('tournament_')) {
    const tournamentId = startParam.replace('tournament_', '');
    await handleTournamentDeepLink(tournamentId);
  }

  if (!localStorage.getItem('bsp_intro_seen')) {
    initOnboarding();
  }

  initHomescreenBanner();
});
