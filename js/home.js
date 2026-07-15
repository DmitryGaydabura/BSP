/* ════════════════════════════════════════════════════════════════
   HOME TAB — «що далі для мене» dashboard
   Default screen: next game hero + rank/activity tiles + live banner
   + last finished tournament. Relies on globals from core.js,
   tournaments.js (myEnrollmentState, openTournamentPage, …) and
   players.js (ratings cache, activity helpers) — classic load order.
════════════════════════════════════════════════════════════════ */

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
  const openReg = next ? null : upcoming.find(t =>
    !t.friendly && !t.isPrivate && (t.status === 'DRAFT' || t.status === 'ACTIVE'));
  const live = upcoming.find(t =>
    (t.status === 'GROUP_STAGE' || t.status === 'PLAYOFF') && (!next || t.id !== next.id));
  const lastDone = ts.filter(t => t.status === 'FINISHED' && !t.friendly).sort(byDate).slice(-1)[0] || null;

  let html = '';

  if (next) {
    html += hmHeroHtml(next, true);
  } else if (openReg) {
    html += hmHeroHtml(openReg, false);
  } else {
    html += `<div class="hm-hero">
      <div class="hm-hero-label"><span>Наступна гра</span></div>
      <div class="hm-hero-name">Поки нічого не заплановано</div>
      <div class="hm-hero-meta">Слідкуйте за анонсами нових турнірів</div>
      <div class="hm-hero-actions"><button class="hm-btn-ghost" onclick="switchTab('results')">Усі турніри</button></div>
    </div>`;
  }

  if (currentUser) {
    const meRating = (ratingsData || []).find(p => String(p.id) === String(currentUser.id));
    const rank = meRating ? (ratingsData.indexOf(meRating) + 1) : 0;
    const lvl = meRating ? (meRating.level || levelFromPoints(meRating.pts)) : null;
    html += `<div class="hm-tiles">
      <button class="hm-tile" onclick="switchTab('ratings')">
        <div class="hm-tile-label">Рейтинг</div>
        <div class="hm-tile-val">${meRating ? meRating.pts : (currentUser.ratingPoints ?? '—')}</div>
        <div class="hm-tile-sub">${rank ? `#${rank} у клубі` : 'ще не в рейтингу'}${lvl ? ` · ${lvl}` : ''}</div>
      </button>
      <button class="hm-tile" onclick="switchTab('activity')">
        <div class="hm-tile-label">Активність</div>
        <div class="hm-tile-val" id="hm-act-val">—</div>
        <div class="hm-tile-sub" id="hm-act-sub">${activityMonthLabel(currentYearMonth())}</div>
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
  }
}
