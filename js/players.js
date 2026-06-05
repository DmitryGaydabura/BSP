/* ════════════════════════════════════════════════════════════════
   RENDER — RATINGS
════════════════════════════════════════════════════════════════ */

let ratingsData = null;
let activeRatingFilter = 'all';
const playerHistoryCache = new Map();

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
    level: r.playerLevel || null,
  };
}

function avatarHtml(p, size = 'md') {
  const cls = size === 'sm' ? 'lb-avatar' : 'podium-avatar';
  if (p.photoUrl) {
    return `<img src="${esc(p.photoUrl)}" alt="" onerror="this.parentNode.innerHTML='${esc(initials(p.name))}'">`;
  }
  return initials(p.name);
}

function renderLbRow(p, rank, showLevel) {
  const rankCls = rank <= 3 ? `r${rank}` : '';
  const top3cls = rank <= 3 ? 'top3' : '';
  const changeSign = p.change === '=' ? '–' : p.change;
  const changeCls = p.change.startsWith('+') ? 'up' : p.change.startsWith('-') ? 'down' : 'same';
  const lvl = p.level || levelFromPoints(p.pts);
  const avatarContent = p.photoUrl
    ? `<img src="${esc(p.photoUrl)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:50%" onerror="this.parentNode.textContent='${esc(initials(p.name))}'">`
    : initials(p.name);
  const startDisp = p.startingPts ?? '—';
  const tp = p.tournamentPts;
  const trnCls = tp > 0 ? 'pos' : tp < 0 ? 'neg' : '';
  const trnDisp = tp == null ? '—' : `${tp > 0 ? '+' : ''}${tp}`;
  return `
    <div class="lb-row ${top3cls} lb-row-tap" onclick="_lbRowTap('${p.id || ''}',${rank})">
      <span class="lb-rank ${rankCls}">${rank <= 3 ? ['①','②','③'][rank-1] : rank}</span>
      <div class="lb-avatar">${avatarContent}</div>
      <div class="lb-name">
        <div class="lb-name-text">${esc(p.name)}</div>
        ${showLevel ? `<span class="level-badge level-badge-sm ${levelClass(lvl)}">${lvl}</span>` : ''}
      </div>
      <span class="lb-start">${startDisp}</span>
      <span class="lb-trn ${trnCls}">${trnDisp}</span>
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
      ? `<img src="${esc(p.photoUrl)}" alt="" onerror="this.parentNode.textContent='${esc(initials(p.name))}'">`
      : initials(p.name);
    return `
      <div class="podium-place lb-row-tap" onclick="_lbRowTap('${p.id || ''}',${podiumRanks[i]})">
        <div class="podium-avatar ${podiumAvatarCls[i]}">
          ${crowns[i] ? `<span class="podium-crown">${crowns[i]}</span>` : ''}
          ${avatarContent}
        </div>
        <div class="podium-name">${esc(p.name.split(' ')[0])}<br>${esc(p.name.split(' ')[1] || '')}</div>
        <div class="podium-pts">${p.pts}</div>
        <div class="podium-block ${podiumBlocks[i]}">
          <span class="podium-rank ${podiumRankCls[i]}">${podiumRanks[i]}</span>
        </div>
      </div>
    `;
  }).join('');
}

async function renderRatings() {
  let source = RATINGS.filter(r => (r.pts || 0) > 0);
  if (apiAvailable && ratingsData === null) {
    try {
      ratingsData = (await API.ratings.list()).map(normalizeRating);
    } catch { /* fallback */ }
  }
  if (ratingsData) source = ratingsData;

  const isAll = activeRatingFilter === 'all';
  const filtered = isAll
    ? source
    : source.filter(p => (p.level || levelFromPoints(p.pts)) === activeRatingFilter);

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
      const group = filtered.filter(p => (p.level || levelFromPoints(p.pts)) === lvl);
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
  const lvl = player.level || levelFromPoints(player.pts);
  const lvlCls = levelClass(lvl);
  const wins = player.wins || 0;
  const losses = player.losses || 0;
  const total = wins + losses;
  const winPct = total > 0 ? Math.round((wins / total) * 100) : 0;

  const tier = tierClass(lvl);
  const showH2hTab = apiAvailable && currentUser && player.id && String(player.id) !== String(currentUser.id);

  body.innerHTML = `
    ${showH2hTab ? `
    <div class="pp-tabs">
      <button class="pp-tab active" data-tab="profile" onclick="ppSwitchTab('profile')">Профіль</button>
      <button class="pp-tab" data-tab="h2h" onclick="ppSwitchTab('h2h')">Наша статистика</button>
    </div>` : ''}

    <div id="pp-panel-profile">
      <div class="pp-hero ${tier}">
        <div class="pp-avatar">${player.photoUrl
          ? `<img src="${esc(player.photoUrl)}" alt="" onerror="this.parentNode.textContent='${esc(initials(player.name))}'">`
          : initials(player.name)}</div>
        <div class="pp-info">
          <div class="pp-name">${esc(player.name)}</div>
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

      <div class="history-card" style="margin-top:12px">
        <div class="history-card-title">Турніри</div>
        <div id="pp-history-list"><div class="history-loading">Завантаження...</div></div>
      </div>
    </div>

    ${showH2hTab ? `
    <div id="pp-panel-h2h" hidden>
      <div id="pp-h2h-content"><div class="history-loading">Завантаження...</div></div>
    </div>` : ''}
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

    const historyFetch = playerHistoryCache.has(player.id)
      ? Promise.resolve(playerHistoryCache.get(player.id))
      : API.users.userHistory(player.id).then(h => { playerHistoryCache.set(player.id, h); return h; });

    const fetches = [
      historyFetch,
      API.activity.monthly(currentYearMonth()),
    ];
    if (showH2hTab) fetches.push(API.users.h2h(player.id));

    const [historyResult, activityResult, h2hResult] = await Promise.allSettled(fetches);

    const histList = document.getElementById('pp-history-list');
    if (historyResult.status === 'fulfilled') {
      const history = historyResult.value;
      const svg = history?.length >= 1 ? buildRatingChart(history, player.startingPts) : null;
      if (chartBody) chartBody.innerHTML = svg ?? '<div class="history-empty">Немає турнірних результатів</div>';
      if (histList) {
        if (history?.length > 0) {
          histList.innerHTML = history.map(h => {
            const sign = h.pointsDelta >= 0 ? '+' : '';
            const ptsCls = h.pointsDelta >= 0 ? 'pos' : 'neg';
            const date = new Date(h.tournamentDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
            const avgInfo = h.tournamentAvgRating ? ` · avg ${h.tournamentAvgRating}` : '';
            return `
              <div class="history-row history-row-tap" onclick="openAchievementTournament(${h.tournamentId})">
                <div class="history-row-info">
                  <div class="history-row-name">${h.tournamentName}</div>
                  <div class="history-row-meta">${h.tournamentLevel} · ${date}${avgInfo}</div>
                </div>
                <div class="history-row-pts ${ptsCls}">${sign}${h.pointsDelta}</div>
              </div>`;
          }).join('');
        } else {
          histList.innerHTML = '<div class="history-empty">Немає записів</div>';
        }
      }
    } else {
      if (chartBody) chartBody.innerHTML = '<div class="history-empty">Немає турнірних результатів</div>';
      if (histList) histList.innerHTML = '<div class="history-empty">Немає записів</div>';
    }

    if (activityResult.status === 'fulfilled') {
      const entry = activityResult.value?.find(e => e.userId === player.id);
      if (actVal) actVal.textContent = entry ? entry.activityPoints : '—';
      if (actLbl) actLbl.textContent = entry ? `Активність · #${entry.rank}` : 'Активність';
    }

    if (showH2hTab) {
      const h2hEl = document.getElementById('pp-h2h-content');
      if (h2hEl) {
        if (h2hResult?.status === 'fulfilled') {
          h2hEl.innerHTML = renderH2hStats(h2hResult.value, player);
        } else {
          h2hEl.innerHTML = '<div class="history-empty">Не вдалося завантажити статистику</div>';
        }
      }
    }
  }
}

function ppSwitchTab(tab) {
  document.querySelectorAll('.pp-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
  const profilePanel = document.getElementById('pp-panel-profile');
  const h2hPanel = document.getElementById('pp-panel-h2h');
  if (profilePanel) profilePanel.hidden = tab !== 'profile';
  if (h2hPanel) h2hPanel.hidden = tab !== 'h2h';
}

function renderH2hStats(stats, player) {
  const total = (stats.partneredTournaments || 0) + (stats.opponentTournaments || 0);
  if (total === 0) {
    return '<div class="history-empty" style="padding:32px 0;text-align:center">Ви ще не грали разом у жодному турнірі</div>';
  }

  const firstName = player.name ? player.name.split(' ')[0] : player.name;
  const partnerTourneys = (stats.tournaments || []).filter(e => e.relationship === 'PARTNERS');
  const rivalTourneys   = (stats.tournaments || []).filter(e => e.relationship === 'OPPONENTS');

  let html = '';

  // AI analysis
  const hasAnalysis = !!stats.analysis;
  const generatedAt = stats.analysisGeneratedAt ? new Date(stats.analysisGeneratedAt) : null;
  const cooldownMs = 7 * 24 * 60 * 60 * 1000;
  const withinCooldown = generatedAt && (Date.now() - generatedAt.getTime() < cooldownMs);
  const nextAvailable = withinCooldown
    ? generatedAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' })
    : null;

  let analysisBtnHtml;
  if (hasAnalysis && withinCooldown) {
    const genDate = generatedAt.toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
    analysisBtnHtml = `<span class="h2h-analysis-meta">Оновлено ${genDate} · наступне через 7 дн.</span>`;
  } else {
    analysisBtnHtml = `<button class="chip-btn" id="pp-h2h-analyze-btn" onclick="ppGenerateH2hAnalysis(${player.id})">Проаналізувати</button>`;
  }

  html += `
    <div class="h2h-analysis-section">
      <div class="h2h-analysis-header">
        <span class="h2h-analysis-title">Аналіз</span>
        ${analysisBtnHtml}
      </div>
      <div id="pp-h2h-analysis-text">${hasAnalysis ? `<p class="h2h-analysis-body">${stats.analysis.replace(/\n/g, '<br>')}</p>` : ''}</div>
    </div>`;

  // Team section
  if ((stats.partneredTournaments || 0) > 0) {
    const pw = stats.partneredWins || 0, pl = stats.partneredLosses || 0;
    const pct = (pw + pl) > 0 ? Math.round(100 * pw / (pw + pl)) : 0;
    html += '<div class="h2h-section-label">Команда</div>';
    html += '<div class="h2h-summary">';
    html += `<div class="h2h-stat"><div class="h2h-stat-val">${stats.partneredTournaments}</div><div class="h2h-stat-lbl">Турнірів разом</div></div>`;
    html += `<div class="h2h-stat"><div class="h2h-stat-val clr-pos">${pw}W / ${pl}L</div><div class="h2h-stat-lbl">${pct}% wins</div></div>`;
    html += '</div>';
    if (partnerTourneys.length > 0) {
      html += '<div class="history-card" style="margin-bottom:16px">';
      html += partnerTourneys.map(e => {
        const date = new Date(e.tournamentDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
        const badge = `<span class="h2h-badge h2h-badge-partner">${e.wins}W / ${e.losses}L</span>`;
        return `
          <div class="history-row">
            <div class="history-row-info">
              <div class="history-row-name">${e.tournamentName}</div>
              <div class="history-row-meta">${e.tournamentLevel} · ${date}${e.position ? ` · #${e.position} місце` : ''}</div>
            </div>
            ${badge}
          </div>`;
      }).join('');
      html += '</div>';
    }
  }

  // Rivalry section
  if ((stats.opponentTournaments || 0) > 0) {
    const myW = stats.currentUserWonCount || 0, theirW = stats.targetUserWonCount || 0;
    html += '<div class="h2h-section-label">Суперництво</div>';
    html += '<div class="h2h-summary">';
    html += `<div class="h2h-stat"><div class="h2h-stat-val">${stats.opponentTournaments}</div><div class="h2h-stat-lbl">Протистоянь</div></div>`;
    html += `<div class="h2h-stat"><div class="h2h-stat-val">${myW} – ${theirW}</div><div class="h2h-stat-lbl">Я vs ${esc(firstName)}</div></div>`;
    html += '</div>';
    if (rivalTourneys.length > 0) {
      html += '<div class="history-card" style="margin-bottom:16px">';
      html += rivalTourneys.map(e => {
        const date = new Date(e.tournamentDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
        let badge;
        if (e.currentUserWon === true) {
          badge = `<span class="h2h-badge h2h-badge-win">Я #${e.currentUserPosition}</span>`;
        } else if (e.currentUserWon === false) {
          badge = `<span class="h2h-badge h2h-badge-loss">Я #${e.currentUserPosition}</span>`;
        } else {
          badge = `<span class="h2h-badge">#${e.currentUserPosition ?? '?'}</span>`;
        }
        return `
          <div class="history-row">
            <div class="history-row-info">
              <div class="history-row-name">${e.tournamentName}</div>
              <div class="history-row-meta">${e.tournamentLevel} · ${date}</div>
            </div>
            ${badge}
          </div>`;
      }).join('');
      html += '</div>';
    }
  }

  return html;
}

async function ppGenerateH2hAnalysis(targetPlayerId) {
  const btn = document.getElementById('pp-h2h-analyze-btn');
  const textEl = document.getElementById('pp-h2h-analysis-text');
  if (!btn || !textEl) return;
  btn.disabled = true;
  btn.textContent = '...';
  textEl.innerHTML = '<div class="history-loading">Аналізуємо...</div>';
  try {
    const result = await API.users.h2hAnalysis(targetPlayerId);
    textEl.innerHTML = `<p class="h2h-analysis-body">${result.analysis.replace(/\n/g, '<br>')}</p>`;
    // Replace button with meta label
    const header = btn.closest('.h2h-analysis-header');
    if (header) {
      const genDate = new Date(result.generatedAt).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short' });
      btn.replaceWith(Object.assign(document.createElement('span'), {
        className: 'h2h-analysis-meta',
        textContent: `Оновлено ${genDate} · наступне через 7 дн.`,
      }));
    }
  } catch (e) {
    const msg = e?.data?.message || 'Не вдалося отримати аналіз';
    textEl.innerHTML = `<div class="history-empty">${msg}</div>`;
    btn.disabled = false;
    btn.textContent = 'Проаналізувати';
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
      <div class="activity-row lb-row-tap" onclick="_actRowTap('${e.userId}','${esc(e.displayName)}')">
        <div class="activity-rank ${e.rank === 1 ? 'top1' : e.rank === 2 ? 'top2' : e.rank === 3 ? 'top3' : ''}">
          ${e.rank === 1 ? '★' : e.rank}
        </div>
        <div class="activity-avatar">
          ${e.photoUrl ? `<img src="${esc(e.photoUrl)}" alt="">` : initials(e.displayName)}
        </div>
        <div class="activity-info">
          <div class="activity-name">${esc(e.displayName)}</div>
          <div class="activity-sub">${e.tournamentsPlayed} ${e.tournamentsPlayed === 1 ? 'турнір' : e.tournamentsPlayed < 5 ? 'турніри' : 'турнірів'}</div>
        </div>
        <div>
          <div class="activity-pts">${e.activityPoints}</div>
          <div class="activity-pts-label">Активність</div>
        </div>
      </div>
    `).join('');
  } catch (e) {
    wrap.innerHTML = `<div class="activity-empty" style="color:var(--error)">${esc(e.message)}</div>`;
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
        <div class="profile-guest-name">${esc(name)}</div>
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
  const myRatingEntry = ratingsData?.find(p => p.id === u.id);
  const level = myRatingEntry?.level || levelFromPoints(u.ratingPoints);
  const tier = tierClass(level);
  const globalRank = ratingsData ? ratingsData.findIndex(p => p.id === u.id) + 1 : 0;
  const colorLabel = { RED: 'Червоний', YELLOW: 'Жовтий', GREEN: 'Зелений' };
  const colorDot   = { RED: '🔴', YELLOW: '🟡', GREEN: '🟢' };

  container.innerHTML = `
    <div class="profile-hero ${tier}">
      <div class="profile-avatar">
        ${u.photoUrl ? `<img src="${esc(u.photoUrl)}" alt="">` : initials(u.displayName)}
      </div>
      <div class="profile-info">
        <div class="profile-name">${esc(u.displayName)}</div>
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
          <div class="raketo-claimed-rating">Raketo ${u.raketoRating?.toFixed(1)} · ${colorLabel[u.raketoColor] || ''}</div>
          <div class="raketo-claimed-detail">${u.gender === 'MALE' ? 'Чоловік' : 'Жінка'} · стартові бали: <strong>${u.startingPoints || 0}</strong> (${u.raketoColor === 'YELLOW' ? '×0.875' : u.raketoColor === 'RED' ? '×0.75' : '×1.0'} від базового)</div>
        </div>
      </div>
    ` : `
      <div class="raketo-link-banner">
        <div class="raketo-link-banner-icon">🎾</div>
        <div class="raketo-link-banner-body">
          <div class="raketo-link-banner-title">Підключіть профіль Raketo</div>
          <div class="raketo-link-banner-text">
            Raketo — додаток для падел-рейтингу. Підключіть профіль, щоб отримати стартові бали та реєструватися на турніри.<br><br>
            <strong>Як підключити:</strong><br>
            1. Відкрийте додаток <strong>Raketo</strong><br>
            2. Налаштування → вкажіть Telegram: <strong>@${u.username || 'ваш_username'}</strong><br>
            3. Натисніть кнопку нижче
          </div>
        </div>
      </div>
      <button class="claim-points-btn" id="btn-claim-points">
        <div class="claim-points-btn-left">
          <div class="claim-points-btn-title">Імпортувати рейтинг з Raketo</div>
          <div class="claim-points-btn-sub">Натисніть після того як вказали Telegram у Raketo</div>
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
      <div class="ach-name">${esc(t.name)}</div>
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
    const names = rPlayers.map(p => `<span class="ach-name-tap" onclick="_tournamentPlayerTap('${p.id || ''}','${esc(p.name)}')">${esc(p.name)}</span>`).join('<span class="separator"> / </span>');
    const isWinner = r.pos === 1;
    return `<div class="ach-result-row${isWinner ? ' ach-result-winner' : ''}">
      <span class="ach-result-medal">${medal}</span>
      <div class="ach-result-names">${names}</div>
      ${r.pts !== 0 ? `<span class="ach-result-pts ${r.pts > 0 ? 'pos' : 'neg'}">${r.pts > 0 ? '+' : ''}${r.pts}</span>` : ''}
    </div>`;
  }).join('');

  content.innerHTML = `
    <div class="ach-hero">
      <div class="ach-wreath-stage">
        <img src="assets/laurel_wreath.svg" class="ach-wreath" aria-hidden="true">
        <div class="ach-stage">
          <div class="ach-loader" id="ach-loader"><div class="ach-loader-ring"></div></div>
          <canvas id="ach-trophy-canvas" class="ach-trophy-canvas"></canvas>
        </div>
      </div>
      <div class="ach-hero-brand">★ BLACKSEA PADEL · ODESA ★</div>
    </div>

    <div class="ach-info-block">
      <div class="ach-info-name">${esc(t.name)}</div>
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

  const SZ  = 180;
  const DPR = Math.min(window.devicePixelRatio || 1, 2);

  // ── Renderer ────────────────────────────────────────────────────
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setSize(SZ, SZ);
  renderer.setPixelRatio(DPR);
  renderer.outputEncoding    = THREE.sRGBEncoding;
  renderer.toneMapping       = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.80;

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
          // top — warm white sky
          data[i]=180; data[i+1]=165; data[i+2]=120;
        } else if (t < 0.65) {
          // mid — gold horizon
          const s = (t - 0.35) / 0.30;
          data[i]   = Math.round(180 - s * 50);
          data[i+1] = Math.round(165 - s * 90);
          data[i+2] = Math.round(120 - s * 85);
        } else {
          // bottom — dark navy
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

  // ── Lights — warm gold balanced lighting ─────────────────────────
  scene.add(new THREE.AmbientLight(0xfff8dc, 0.40));

  const lightDefs = [
    { pos: [ 2,  6,  4], col: 0xfffbe0, int: 1.8 },  // key  (front-top-right)
    { pos: [-3,  3,  2], col: 0xffd040, int: 0.80 }, // fill (left warm gold)
    { pos: [ 0, -2,  3], col: 0xffe080, int: 0.50 }, // bounce (below front)
    { pos: [ 1,  2, -4], col: 0x99aacc, int: 0.35 }, // rim (cool blue back)
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
      model.position.y -= 0.18; // push down so cup sits inside wreath centre

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
  const sorted = [...history].sort((a, b) => new Date(a.tournamentDate) - new Date(b.tournamentDate));

  const pts = [{ value: startingPoints, date: null }];
  let running = startingPoints;
  for (const h of sorted) {
    running = (h.totalPointsAfter > 0 ? h.totalPointsAfter : null) ?? (running + (h.pointsDelta || 0));
    pts.push({ value: running, date: new Date(h.tournamentDate) });
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
      const date = new Date(h.tournamentDate).toLocaleDateString('uk-UA', { day: 'numeric', month: 'short', year: 'numeric' });
      const avgInfo = h.tournamentAvgRating ? ` · avg ${h.tournamentAvgRating}` : '';
      return `
        <div class="history-row history-row-tap" onclick="openAchievementTournament(${h.tournamentId})">
          <div class="history-row-info">
            <div class="history-row-name">${h.tournamentName}</div>
            <div class="history-row-meta">${h.tournamentLevel} · ${date}${avgInfo}</div>
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

function raketoPreview(rating, color) {
  if (!rating || rating <= 0) return { pts: 0 };
  const raw = 1000 + (rating - 1.0) / 3.0 * 2000;
  const multiplier = { GREEN: 1.0, YELLOW: 0.875, RED: 0.75 }[color] ?? 1.0;
  const pts = Math.round(raw * multiplier / 50) * 50;
  return { pts: Math.max(0, pts) };
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
          ? `<img src="${esc(u.photoUrl)}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${initStr}</span>`
          : initStr}
      </div>
      <div class="raketo-result-body">
        <div class="raketo-result-name">${esc(u.name)}</div>
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
      previewLevel.textContent = 'Стартові бали у рейтингу BSP';
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
      lookupBox.innerHTML = `<div class="raketo-no-result">Помилка при зверненні до Raketo: ${esc(e.message)}</div>`;
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
        <button class="admin-action-btn" id="btn-migrate-v2">
          <svg class="admin-action-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          <span class="admin-action-label">Перерахувати рейтинг v2</span>
          <span class="admin-action-arrow">›</span>
        </button>
      </div>
    </div>
  `;
}

