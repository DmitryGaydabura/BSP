/* ════════════════════════════════════════════════════════════════
   HOME TAB — «що далі для мене» dashboard
   Default screen: next game hero + rank/activity tiles + live banner
   + last finished tournament. Relies on globals from core.js,
   tournaments.js (myEnrollmentState, openTournamentPage, …) and
   players.js (ratings cache, activity helpers) — classic load order.
════════════════════════════════════════════════════════════════ */

function hmOpenFriendly() {
  switchTab('results');
  document.querySelector('#results-subtabs .results-subtab[data-subtab="friendly"]')?.click();
}

/**
 * Recent-form strip: one chip per finished event, oldest → newest, coloured by the
 * signed rating delta. A tournament is not a single win/loss (a player can win four
 * matches and still drop points), so the delta itself is what gets shown — it is the
 * only unambiguous per-event outcome we have.
 */
function hmFormHtml(history) {
  const evts = (history || []).filter(h => h.pointsDelta != null);
  if (evts.length < 2) return '';

  const recent = evts.slice(0, 5);
  const chips = recent.slice().reverse().map(h => {
    const cls = h.pointsDelta > 0 ? 'won' : h.pointsDelta < 0 ? 'lost' : 'flat';
    return `<span class="hm-form-chip ${cls}">${h.pointsDelta > 0 ? '+' : ''}${h.pointsDelta}</span>`;
  }).join('');

  // Streak = consecutive most-recent events on the same side of zero (0 breaks it).
  let streak = 0;
  const dir = Math.sign(evts[0].pointsDelta);
  if (dir !== 0) {
    for (const h of evts) {
      if (Math.sign(h.pointsDelta) !== dir) break;
      streak++;
    }
  }

  const since = Date.now() - 30 * 864e5;
  const monthDelta = evts
    .filter(h => h.tournamentDate && new Date(h.tournamentDate).getTime() >= since)
    .reduce((s, h) => s + h.pointsDelta, 0);

  const bits = [];
  if (streak >= 2) bits.push(`Серія: ${streak} ${dir > 0 ? '↑' : '↓'}`);
  if (monthDelta) bits.push(`${monthDelta > 0 ? '+' : ''}${monthDelta} за 30 днів`);

  return `<div class="hm-section-title">Форма</div>
    <div class="hm-form">
      <div class="hm-form-chips">${chips}</div>
      ${bits.length ? `<div class="hm-form-sub">${bits.join(' · ')}</div>` : ''}
    </div>`;
}

/** Fills the form strip when the history is not yet cached. When it is (the
    usual case after the first seconds), renderHome inlines the strip instead —
    this is only the cold path, so the block never appears mid-card. Shares
    myHistoryCache with the Profile chart: one fetch per session, not one per
    visit to either screen. */
async function hmLoadForm() {
  const slot = document.getElementById('hm-form-slot');
  if (!slot || !currentUser || myHistoryCache !== null) return;
  try {
    myHistoryCache = await API.users.history();
    const el = document.getElementById('hm-form-slot');
    if (el) el.innerHTML = hmFormHtml(myHistoryCache);
  } catch { /* offline — the strip just stays empty */ }
}

function hmWhenLabel(t) {
  const start = new Date(`${t.date}T${t.time || '00:00:00'}`);
  const days = Math.ceil((start.getTime() - Date.now()) / 864e5);
  if (days < 0) return 'вже триває';
  if (days === 0) return 'сьогодні';
  if (days === 1) return 'завтра';
  if (days <= 4) return `через ${days} дні`;
  return `через ${days} днів`;
}

function hmHeroHtml(t, enrolled) {
  const metaBits = [
    fmt(t.date) + (t.time ? ' · ' + t.time.slice(0, 5) : ''),
    t.location || null,
  ].filter(Boolean);
  const st = enrolled ? myEnrollmentState(t) : null;
  const needPartner = !!(st && st.cls === 'warn');
  const isLive = t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF';
  const when = isLive ? '● вже триває' : hmWhenLabel(t);
  const actions = enrolled
    ? `<button class="hm-btn-lime" onclick="openTournamentPage(${t.id})">${isLive ? 'Дивитись' : needPartner ? 'Знайти партнера' : 'Відкрити турнір'}</button>`
    : `<button class="hm-btn-lime" onclick="attemptJoinTournament(${t.id})">Зареєструватись</button>
       <button class="hm-btn-ghost" onclick="openTournamentPage(${t.id})">Деталі</button>`;
  return `
    <div class="hm-hero">
      <div class="hm-hero-label"><span>${enrolled ? 'Наступна гра' : 'Відкрита реєстрація'}</span><span class="hm-hero-when">${when}</span></div>
      <div class="hm-hero-name">${esc(t.name)}</div>
      <div class="hm-hero-meta">${esc(metaBits.join(' · '))}</div>
      ${st ? `<div class="hm-hero-state">${st.label}${needPartner ? ' — оберіть партнера у списку' : ''}</div>` : ''}
      <div class="hm-hero-actions">${actions}</div>
    </div>`;
}

async function renderHome() {
  const body = document.getElementById('home-body');
  const greet = document.getElementById('home-greeting');
  if (!body) return;

  greet.textContent = currentUser
    ? `Привіт, ${(currentUser.displayName || 'гравцю').split(' ')[0]}! 👋`
    : 'Ласкаво просимо! 👋';

  if (apiLoading) {
    body.innerHTML = `
      <div class="t-skel-card">
        <div class="skel t-skel-title" style="width:55%"></div>
        <div class="skel t-skel-meta" style="width:70%"></div>
        <div class="skel t-skel-tags"></div>
      </div>
      <div class="hm-tiles">
        <div class="skel" style="height:82px;border-radius:14px"></div>
        <div class="skel" style="height:82px;border-radius:14px"></div>
      </div>`;
    return;
  }

  if (!apiAvailable) {
    body.innerHTML = `<div class="tab-offline-state">
      <div class="tab-offline-icon">📡</div>
      <div class="tab-offline-text">Немає з'єднання з сервером</div>
    </div>`;
    return;
  }

  if (tournamentsData === null) {
    try { tournamentsData = (await API.tournaments.list()).map(normalizeTournament); } catch { /* offline */ }
  }
  if (ratingsData === null) {
    try { ratingsData = (await API.ratings.list()).map(normalizeRating); } catch { /* offline */ }
  }

  const ts = tournamentsData || [];
  const byDate = (a, b) => String(a.date).localeCompare(String(b.date));
  const upcoming = ts.filter(t => t.status !== 'FINISHED').sort(byDate);
  const mine = currentUser ? upcoming.filter(t => myEnrollmentState(t)) : [];
  const next = mine[0] || null;

  const meRating = currentUser
    ? (ratingsData || []).find(p => String(p.id) === String(currentUser.id))
    : null;
  const myPts = meRating ? meRating.pts : (currentUser?.ratingPoints ?? null);

  // Suggest a tournament the player is actually eligible for; fall back to any open one.
  const openCandidates = next ? [] : upcoming.filter(t =>
    !t.friendly && !t.isPrivate && (t.status === 'DRAFT' || t.status === 'ACTIVE'));
  const fitsMe = t => myPts == null
    || ((t.minRating == null || myPts >= t.minRating) && (t.maxRating == null || myPts <= t.maxRating));
  const openReg = openCandidates.find(fitsMe) || openCandidates[0] || null;

  const live = upcoming.find(t =>
    (t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF') && (!next || t.id !== next.id));
  const lastDone = ts.filter(t => t.status === 'FINISHED' && !t.friendly).sort(byDate).slice(-1)[0] || null;

  // Everything below is derived from these — if none of them moved, the card is
  // already correct and rebuilding it would only re-create the DOM for a frame.
  if (!shouldRepaint('home', [next, openReg, live, lastDone, meRating, myPts, currentUser?.id ?? null, myHistoryCache])) {
    return;
  }

  let html = '';

  if (next) {
    html += hmHeroHtml(next, true);
  } else if (openReg) {
    html += hmHeroHtml(openReg, false);
  } else {
    html += `<div class="hm-hero">
      <div class="hm-hero-label"><span>Наступна гра</span></div>
      <div class="hm-hero-name">Поки нічого не заплановано</div>
      <div class="hm-hero-meta">Зберіть своїх на дружнє американо або подивіться, хто вже шукає партнерів.</div>
      <div class="hm-hero-actions">
        <button class="hm-btn-lime" onclick="hmOpenFriendly()">Дружня гра</button>
        <button class="hm-btn-ghost" onclick="switchTab('results')">Усі турніри</button>
      </div>
    </div>`;
  }

  if (currentUser) {
    const rank = meRating ? (ratingsData.indexOf(meRating) + 1) : 0;
    const lvl = meRating ? (meRating.level || levelFromPoints(meRating.pts)) : null;
    // rankChange is places gained/lost in the most recent finalized tournament.
    const mv = meRating?.rankChange || 0;
    const mvHtml = mv ? ` · <span class="hm-move ${mv > 0 ? 'up' : 'down'}">${mv > 0 ? '▲' : '▼'}${Math.abs(mv)}</span>` : '';
    // Seed the activity tile from cache so a repaint never blinks back to «—».
    const actMonth = currentYearMonth();
    const actMe = (activityCache[actMonth] || []).find(e => String(e.userId) === String(currentUser.id));
    html += `<div class="hm-tiles">
      <button class="hm-tile" onclick="switchTab('ratings')">
        <div class="hm-tile-label">Рейтинг</div>
        <div class="hm-tile-val">${meRating ? meRating.pts : (currentUser.ratingPoints ?? '—')}</div>
        <div class="hm-tile-sub">${rank ? `#${rank} у клубі` : 'ще не в рейтингу'}${lvl ? ` · ${lvl}` : ''}${mvHtml}</div>
      </button>
      <button class="hm-tile" onclick="switchTab('activity')">
        <div class="hm-tile-label">Активність</div>
        <div class="hm-tile-val" id="hm-act-val">${actMe ? actMe.activityPoints : (activityCache[actMonth] ? '0' : '—')}</div>
        <div class="hm-tile-sub" id="hm-act-sub">${actMe ? `#${actMe.rank} · ` : ''}${activityMonthLabel(actMonth)}</div>
      </button>
    </div>`;
  } else {
    html += `<div class="hm-tiles">
      <button class="hm-tile" onclick="switchTab('ratings')">
        <div class="hm-tile-label">Гравців у рейтингу</div>
        <div class="hm-tile-val">${(ratingsData || []).length || '—'}</div>
        <div class="hm-tile-sub">переглянути рейтинг</div>
      </button>
      <button class="hm-tile" onclick="switchTab('results')">
        <div class="hm-tile-label">Турнірів</div>
        <div class="hm-tile-val">${ts.length || '—'}</div>
        <div class="hm-tile-sub">календар і результати</div>
      </button>
    </div>`;
  }

  // Painted inline from the shared history cache; hmLoadForm() below fills it
  // only on the cold path, so a revisit never grows a block mid-card.
  if (currentUser) html += `<div id="hm-form-slot">${myHistoryCache ? hmFormHtml(myHistoryCache) : ''}</div>`;

  if (live) {
    html += `<button class="hm-live" onclick="${live.type === 'CUP' ? `openCupModal(${live.id})` : `openTournamentPage(${live.id})`}">
      <span class="hm-live-dot"></span>
      <span class="hm-live-text"><strong>${esc(live.name)}</strong> — зараз триває</span>
      <span class="t-row-chev">›</span>
    </button>`;
  }

  if (lastDone) {
    const win = (lastDone.results || []).find(r => r.pos === 1);
    const my = currentUser
      ? (lastDone.results || []).find(r => (r.players || []).some(p => p.id != null && String(p.id) === String(currentUser.id)))
      : null;
    html += `<div class="hm-section-title">Останній турнір</div>
      <button class="t-row t-row-done" data-home-tid="${lastDone.id}">
        ${tRowDateBlock(lastDone)}
        <div class="t-row-main">
          <div class="t-row-name">${esc(lastDone.name)}</div>
          ${win ? `<div class="t-row-meta">🥇 ${esc(win.pair.join(' / '))}</div>` : ''}
          <div class="t-row-tags">
            ${my ? `<span class="t-row-state ${my.pts >= 0 ? 'st-ok' : 'st-neg'}">Ви: #${my.pos} · ${my.pts > 0 ? '+' : ''}${my.pts}</span>` : ''}
            ${lastDone.hasAnalysis ? '<span class="t-row-state st-wait">AI аналіз</span>' : ''}
          </div>
        </div>
        <span class="t-row-chev">›</span>
      </button>`;
  }

  html += `<button class="hm-all-link" onclick="switchTab('results')">Усі турніри →</button>`;

  body.innerHTML = html;

  body.querySelectorAll('[data-home-tid]').forEach(el =>
    el.addEventListener('click', () => openTournamentPage(parseInt(el.dataset.homeTid, 10))));

  // Activity tile value loads async (cached per month)
  if (currentUser) {
    const m = currentYearMonth();
    (activityCache[m]
      ? Promise.resolve(activityCache[m])
      : API.activity.monthly(m).then(d => (activityCache[m] = d)))
      .then(data => {
        const me = (data || []).find(e => String(e.userId) === String(currentUser.id));
        const v = document.getElementById('hm-act-val');
        const s = document.getElementById('hm-act-sub');
        if (v) v.textContent = me ? me.activityPoints : '0';
        if (s && me) s.textContent = `#${me.rank} · ${activityMonthLabel(m)}`;
      })
      .catch(() => {});

    hmLoadForm();
  }
}
