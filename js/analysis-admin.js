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

    const tournamentMeta = (tournamentsData || []).find(t => t.id === tournamentId);
    const isCupTournament = tournamentMeta?.type === 'CUP';

    if (!isCupTournament && currentUser && currentUser.raketoDocId) {
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
            playerContent.innerHTML = `<div class="analysis-error">${esc(e.message || 'Помилка генерації')}</div>`;
          }
        });
      }
    }
  } catch (e) {
    content.innerHTML = `<div class="analysis-error">${esc(e.message || 'Помилка завантаження')}</div>`;
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
        <span class="chart-player-name">${esc(p.name)}</span>
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

// Strict HTML escaper for user-controlled values interpolated into innerHTML.
// Safe for text content and for single/double-quoted attribute contexts
// (escaping " and ' prevents attribute breakout / handler injection).
function esc(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Like esc() but preserves multi-line prose by turning newlines into <br>.
// Used for long-form AI analysis text blocks.
function escapeHtml(str) {
  return esc(str).replace(/\n/g, '<br>');
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

    list.innerHTML = finished.map(t => {
      const isCup = t.type === 'CUP';
      const canGenerate = isCup || !!t.raketoId;
      return `
      <div class="aa-item" data-id="${t.id}" data-date="${t.date}">
        <div class="aa-item-header">
          <div class="aa-item-name">${esc(t.name)}</div>
          <div class="aa-item-date">${fmt(t.date)}</div>
        </div>
        ${isCup
          ? `<div class="aa-linked">
               <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
               Кубок — аналіз з даних BSP
             </div>`
          : t.raketoId
            ? `<div class="aa-linked">
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round"><path d="M20 6L9 17l-5-5"/></svg>
                 Ракето підключено
                 <button class="aa-unlink-btn" style="margin-left:auto;font-size:10px;color:var(--text-muted);background:none;border:none;cursor:pointer;padding:0">Змінити</button>
               </div>`
            : ''}
        ${!isCup ? `
        <div class="aa-picker" style="display:none">
          <div class="aa-date-row">
            <input type="date" class="form-input aa-date-input" value="${t.date}" style="flex:1;font-size:13px">
            <button class="btn-secondary aa-search-btn" style="flex-shrink:0;font-size:12px;padding:0 14px">Шукати</button>
          </div>
          <div class="aa-results"></div>
        </div>
        ${!t.raketoId ? `<button class="btn-secondary aa-find-btn" style="width:100%;font-size:12px;margin-top:6px">Знайти в Ракето</button>` : ''}` : ''}
        <button class="btn-primary aa-generate-btn" ${!canGenerate ? 'disabled' : ''} style="width:100%;margin-top:6px;font-size:12px">
          ${t.hasAnalysis ? 'Перегенерувати аналіз' : 'Згенерувати аналіз'}
        </button>
        ${t.hasAnalysis ? `<div class="aa-status">Аналіз готовий · ${fmtDatetime(t.analysisGeneratedAt)}</div>` : ''}
      </div>`;
    }).join('');

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
                <div class="aa-pick-court">${esc(r.courtName)}</div>
                <div class="aa-pick-players">${r.players.map(esc).join(' · ')}</div>
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
          results.innerHTML = `<div style="font-size:12px;color:var(--error);padding:6px 0">${esc(e.message || 'Помилка')}</div>`;
        } finally {
          searchBtn.disabled = false; searchBtn.textContent = 'Шукати';
        }
      };

      if (findBtn)   findBtn.addEventListener('click', openPicker);
      if (unlinkBtn) unlinkBtn.addEventListener('click', openPicker);
      if (searchBtn) searchBtn.addEventListener('click', doSearch);

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
    list.innerHTML = `<div style="color:var(--error);font-size:13px">${esc(e.message || 'Помилка')}</div>`;
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
  document.getElementById('btn-migrate-v2').addEventListener('click', runMigrateV2);
  initAdminImportModal();
}

/* ── Migrate v2 ─────────────────────────────────────────────────── */

async function runMigrateV2() {
  const btn = document.getElementById('btn-migrate-v2');
  const label = btn.querySelector('.admin-action-label');
  const original = label.textContent;
  if (!confirm('Це перерахує всі стартові бали та турнірні очки по новій формулі. Продовжити?')) return;
  label.textContent = 'Виконується...';
  btn.disabled = true;
  try {
    const result = await API.ratings.migrateV2();
    alert(`Міграція завершена!\nГравців: ${result.usersProcessed}\nТурнірів: ${result.tournamentsProcessed}`);
    ratingsData = null;
    await renderRatings();
  } catch (e) {
    alert('Помилка міграції: ' + (e.message || 'невідома'));
  } finally {
    label.textContent = original;
    btn.disabled = false;
  }
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
        ? `<img src="${esc(u.photoUrl)}" alt="" onerror="this.style.display='none';this.nextSibling.style.display='flex'"><span style="display:none;width:100%;height:100%;align-items:center;justify-content:center">${initStr}</span>`
        : initStr}
    </div>
    <div class="raketo-result-body">
      <div class="raketo-result-name">${esc(u.name)}</div>
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
    resultsBox.innerHTML = `<div class="raketo-no-result">Помилка: ${esc(e.message)}</div>`;
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
  const el = document.getElementById(id);
  const topZ = Math.max(100, ...[...document.querySelectorAll('.modal-overlay.open')]
    .map(m => parseInt(m.style.zIndex) || 100));
  el.style.zIndex = topZ + 10;
  el.classList.add('open');
}
function closeModal(id) {
  const el = document.getElementById(id);
  el.style.zIndex = '';
  el.classList.remove('open');
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

function toggleRatingInfo() {
  document.getElementById('rating-info-block').classList.toggle('rating-info-block--open');
}

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
      const typeLabel = t.type === 'SINGLE' ? 'Один.' : t.type === 'CUP' ? 'Куб.' : 'Пар.';
      return `<option value="${t.id}">${esc(t.name)} [${t.levelLabel || t.level || ''} · ${typeLabel}]</option>`;
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
      results.innerHTML = `<div style="font-size:11px;color:var(--error)">${esc(e.message || 'Помилка')}</div>`;
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
      .map(u => `<option value="${u.id}">${esc(u.displayName)}</option>`).join('');
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
  const searchInput = document.getElementById('users-search-input');
  if (searchInput) searchInput.value = '';
  list.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:8px 0">Завантаження...</div>';
  try {
    const rawUsers = await API.users.list();
    // Sort alphabetically (Ukrainian locale) once; search filters without re-sorting
    const users = [...rawUsers].sort((a, b) =>
      (a.displayName || '').localeCompare(b.displayName || '', 'uk'));
    const levelOptHtml = LEVEL_OPTIONS.map(l => `<option value="${l.value}">${l.label}</option>`).join('');

    function renderUsers(query) {
      const q = (query || '').toLowerCase().trim();
      const visible = q
        ? users.filter(u =>
            (u.displayName || '').toLowerCase().includes(q) ||
            (u.username || '').toLowerCase().includes(q))
        : users;

      if (!visible.length) {
        list.innerHTML = `<div style="color:var(--text-muted);font-size:13px;padding:12px 0;text-align:center">Нічого не знайдено</div>`;
        return;
      }

      list.innerHTML = visible.map(u => `
      <div class="user-list-item" data-user-id="${u.id}" style="flex-wrap:wrap;gap:6px${u.adminImported && !u.telegramId ? ';opacity:0.75' : ''}">
        <div class="user-list-avatar">
          ${u.photoUrl ? `<img src="${esc(u.photoUrl)}" alt="">` : initials(u.displayName)}
        </div>
        <div class="user-list-info">
          <div class="user-list-name">${esc(u.displayName)}${u.adminImported && !u.telegramId ? ' <span style="font-size:10px;color:var(--text-dim);font-weight:600">Raketo·не зареєстрований</span>' : ''}</div>
          <div class="user-list-pts">${u.ratingPoints} pts (старт: ${u.startingPoints || 0})${u.username ? ` · <span style="color:var(--gold)">@${u.username}</span>` : ''}${u.raketoTelegramUsername && u.raketoTelegramUsername !== u.username ? ` · Raketo:@${u.raketoTelegramUsername}` : ''}</div>
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
          <input class="form-input merge-search-input" placeholder="Пошук гравця..." style="width:100%;font-size:12px;padding:6px 10px;margin-bottom:6px">
          <div class="user-merge-candidates" style="max-height:200px;overflow-y:auto;display:flex;flex-direction:column;gap:3px"></div>
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

        // Pre-sort candidates alphabetically; they stay sorted while search filters
        const sortedCandidates = users
          .filter(u => String(u.id) !== userId)
          .sort((a, b) => a.displayName.localeCompare(b.displayName, 'uk'));

        const searchInput = item.querySelector('.merge-search-input');

        function renderCandidates(query) {
          const q = query.toLowerCase();
          const visible = q
            ? sortedCandidates.filter(u =>
                u.displayName.toLowerCase().includes(q) ||
                (u.username || '').toLowerCase().includes(q))
            : sortedCandidates;

          if (!visible.length) {
            candidatesEl.innerHTML = `<div style="font-size:11px;color:var(--text-muted);padding:6px 0">Не знайдено</div>`;
            return;
          }

          candidatesEl.innerHTML = visible.map(u => {
            const typeLabel = u.adminImported && !u.telegramId ? 'Raketo-імпорт' : 'Telegram';
            const typeColor = u.adminImported && !u.telegramId ? 'var(--gold)' : 'var(--success)';
            const handle   = u.username ? ` · @${u.username}` : '';
            return `<div class="merge-candidate" data-target-id="${u.id}"
              style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;background:var(--card-bg);cursor:pointer;font-size:12px;border:1px solid transparent">
              <div style="flex:1;min-width:0">
                <div style="font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.displayName)}</div>
                <div style="font-size:10px;color:var(--text-muted)">${u.ratingPoints} pts · <span style="color:${typeColor}">${typeLabel}</span>${handle}</div>
              </div>
              <span style="font-size:11px;color:var(--text-muted);flex-shrink:0">Обрати →</span>
            </div>`;
          }).join('');

          // Wire candidate clicks via event delegation
          candidatesEl.querySelectorAll('.merge-candidate').forEach(cand => {
            cand.addEventListener('mouseenter', () => { cand.style.borderColor = 'var(--border-strong)'; });
            cand.addEventListener('mouseleave', () => { cand.style.borderColor = 'transparent'; });
            cand.addEventListener('click', async () => {
              const targetId = cand.dataset.targetId;
              const keepUser = users.find(u => String(u.id) === userId);
              const delUser  = sortedCandidates.find(u => String(u.id) === targetId);
              if (!confirm(`Об'єднати акаунти?\n\n"${delUser.displayName}" буде видалено.\nВсі матчі та рейтинг перенесуться до "${keepUser.displayName}".`)) return;

              cand.style.opacity = '0.5';
              try {
                await API.users.mergeUsers(userId, targetId);
                showToast(`Акаунти об'єднано`, 'success');
                openUsersModal();
              } catch (e) {
                alert('Помилка: ' + (e.message || 'unknown'));
                cand.style.opacity = '1';
              }
            });
          });
        }

        renderCandidates('');
        searchInput.value = '';
        searchInput.addEventListener('input', () => renderCandidates(searchInput.value.trim()));

        mergeArea.style.display = 'block';
        searchInput.focus();
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
               <div style="font-weight:600">${esc(r.name)}</div>
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
          resultsBox.innerHTML = `<div style="font-size:11px;color:var(--error)">${esc(e.message || 'Помилка')}</div>`;
        } finally {
          searchBtn.disabled = false; searchBtn.textContent = 'Шукати';
        }
      };

      searchBtn.addEventListener('click', doRlSearch);
      searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doRlSearch(); });
    });
    } // end renderUsers

    renderUsers('');
    if (searchInput) {
      searchInput.addEventListener('input', () => renderUsers(searchInput.value));
    }
  } catch (e) {
    list.innerHTML = `<div style="color:var(--error);font-size:13px">${esc(e.message)}</div>`;
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
    sel.innerHTML = active.map(t => `<option value="${t.id}">${esc(t.name)} [${t.level || ''}]</option>`).join('');

    await renderParticipantList(sel.value);
  } catch (e) {
    sel.innerHTML = `<option>Помилка: ${esc(e.message)}</option>`;
  }
}

function updateSlotsIndicator(currentCount, maxParticipants, isPair) {
  const el = document.getElementById('pm-slots');
  if (!el) return;
  if (isPair) {
    const pairSlots = maxParticipants ? Math.floor(maxParticipants / 2) : null;
    const usedPairs = Math.ceil(currentCount / 2); // rough count; pairRegs.length is better but not always available here
    if (!pairSlots) { el.textContent = `${currentCount} учасників`; el.style.color = 'var(--text-muted)'; return; }
    const free = pairSlots - usedPairs;
    el.textContent = `${usedPairs} / ${pairSlots} пар · ${free <= 0 ? 'заповнено' : free + ' вільних'}`;
    el.style.color = free <= 0 ? 'var(--error, #e05050)' : free <= 1 ? '#e09050' : 'var(--gold)';
    return;
  }
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
    const tournament = pmTournaments.find(t => String(t.id) === String(tournamentId));
    const isPair = tournament?.type === 'PAIR';

    if (isPair) {
      // Fetch full tournament to get pairRegistrations with partner info
      const fullT = await API.tournaments.get(tournamentId);
      const pairRegs    = fullT.pairRegistrations || [];
      const pairResRegs = fullT.pairReserveRegistrations || [];
      pmParticipantIds = new Set([...pairRegs, ...pairResRegs].flatMap(pr => [pr.player1?.id, pr.player2?.id].filter(Boolean)));

      updateSlotsIndicator(pairRegs.length, tournament?.maxParticipants, true);

      const renderAdminPairRows = (regs, isReserve) => {
        const solos = regs.filter(pr => !pr.player2);
        return regs.map(pr => {
          if (pr.player2) {
            const label = isReserve ? `<span class="pm-reserve-tag">резерв</span>` : '';
            return `<div class="pm-pair-row">
              <div class="pm-pair-names-col">
                <span class="pm-pair-name">${esc(pr.player1.displayName)}</span>
                <span class="pm-pair-slash">/</span>
                <span class="pm-pair-name">${esc(pr.player2.displayName)}</span>
                ${label}
              </div>
              <button class="pm-unlink-btn" data-tid="${tournamentId}" data-uid="${pr.player1.id}"
                      title="Розпарити">↔</button>
              <button class="pm-remove-btn" data-tournament-id="${tournamentId}" data-user-id="${pr.player1.id}"
                      title="Видалити ${esc(pr.player1.displayName)}">✕</button>
            </div>`;
          }
          // Solo player — show partner picker from same pool
          const soloOptions = solos
            .filter(s => s.player1.id !== pr.player1.id)
            .map(s => `<option value="${s.player1.id}">${esc(s.player1.displayName)}</option>`)
            .join('');
          const hasSoloPartners = soloOptions.length > 0;
          const label = isReserve ? `<span class="pm-reserve-tag">резерв</span>` : '';
          return `<div class="pm-pair-row pm-solo-row">
            <span class="pm-pair-name" style="flex:1">${esc(pr.player1.displayName)}</span>
            <span class="pm-solo-label">без пари</span>
            ${label}
            ${hasSoloPartners
              ? `<select class="pm-partner-select" data-tid="${tournamentId}" data-uid="${pr.player1.id}">
                  <option value="">Об'єднати з...</option>
                  ${soloOptions}
                </select>`
              : ''}
            <button class="pm-remove-btn" data-tournament-id="${tournamentId}" data-user-id="${pr.player1.id}">✕</button>
          </div>`;
        }).join('');
      };

      if (!pairRegs.length && !pairResRegs.length) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Учасників ще немає</div>';
      } else {
        const confirmedHtml = pairRegs.length
          ? renderAdminPairRows(pairRegs, false)
          : '';
        const reserveHtml = pairResRegs.length
          ? `<div class="pm-section-label" style="margin-top:10px;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--text-muted)">Резерв</div>` + renderAdminPairRows(pairResRegs, true)
          : '';
        container.innerHTML = confirmedHtml + reserveHtml;

        // Wire unlink buttons
        container.querySelectorAll('.pm-unlink-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            btn.disabled = true;
            try {
              await API.tournaments.adminUnpair(btn.dataset.tid, btn.dataset.uid);
              await renderParticipantList(btn.dataset.tid);
            } catch (e) {
              alert('Помилка: ' + (e.message || 'unknown'));
              btn.disabled = false;
            }
          });
        });

        // Wire partner select dropdowns
        container.querySelectorAll('.pm-partner-select').forEach(sel => {
          sel.addEventListener('change', async () => {
            const partnerId = sel.value;
            if (!partnerId) return;
            sel.disabled = true;
            try {
              await API.tournaments.adminPair(sel.dataset.tid, sel.dataset.uid, partnerId);
              await renderParticipantList(sel.dataset.tid);
            } catch (e) {
              alert('Помилка: ' + (e.message || 'unknown'));
              sel.disabled = false;
              sel.value = '';
            }
          });
        });

        // Wire remove buttons
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
    } else {
      // Non-PAIR: existing flat list
      const participants = await API.tournaments.getParticipants(tournamentId);
      pmParticipantIds = new Set(participants.map(u => u.id));
      updateSlotsIndicator(participants.length, tournament?.maxParticipants, false);

      if (!participants.length) {
        container.innerHTML = '<div style="color:var(--text-muted);font-size:13px;padding:4px 0">Учасників ще немає</div>';
      } else {
        container.innerHTML = participants.map(u => `
          <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--border-sub)">
            <span style="flex:1;font-size:13px">${esc(u.displayName)}</span>
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
    }

    renderAddableList();
  } catch (e) {
    container.innerHTML = `<div style="color:var(--error);font-size:13px">${esc(e.message)}</div>`;
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
      <span style="flex:1;font-size:13px">${esc(u.displayName)}</span>
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

