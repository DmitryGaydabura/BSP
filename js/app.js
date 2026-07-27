/* ════════════════════════════════════════════════════════════════
   TAB NAVIGATION
════════════════════════════════════════════════════════════════ */

const TABS = {
  home:     'tab-home',
  results:  'tab-results',
  matches:  'tab-matches',
  ratings:  'tab-ratings',
  profile:  'tab-profile',
  activity: 'tab-activity',
};
// Activity lives inside the Ratings screen (segment toggle) — highlight the
// ratings nav button while it is open.
const NAV_KEY = { activity: 'ratings' };
let currentTab = 'home';
let rendered = { home: true, results: false, matches: false, ratings: false, profile: false, activity: false };

const tabScroll = {}; // remembered scroll position per tab

function renderTabContent(tab) {
  if (tab === 'home')     renderHome();
  if (tab === 'results')  renderResults();
  if (tab === 'matches')  renderMatches();
  if (tab === 'ratings')  renderRatings();
  if (tab === 'profile')  renderProfile();
  if (tab === 'activity') renderActivity();
}

function switchTab(tab, opts = {}) {
  if (tab === currentTab) return;

  const content = document.getElementById('content');
  tabScroll[currentTab] = content.scrollTop;

  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active', 'tab-enter'));
  const panel = document.getElementById(TABS[tab]);
  panel.classList.add('active');
  if (!opts.noAnim) panel.classList.add('tab-enter');

  document.querySelectorAll('.nav-tab').forEach(b => b.classList.remove('active'));
  document.querySelector(`.nav-tab[data-tab="${NAV_KEY[tab] || tab}"]`)?.classList.add('active');

  content.scrollTop = tabScroll[tab] || 0;

  const refresh = () => {
    if (tab === 'home') {
      renderHome(); // cheap: uses cached data, keeps «next game» fresh
    } else if (tab === 'profile') {
      renderProfile();
    } else if (tab === 'results') {
      // Stale-while-revalidate: show the cached list instantly, refetch silently
      // (so pair changes from the bot still appear — without a skeleton flash)
      renderResults();
      refreshTournamentsSilently();
    } else if (tab === 'matches') {
      renderMatches();
      refreshMatchesSilently();
    } else if (tab === 'ratings') {
      refreshRatingsSilently();
    }
  };

  if (!rendered[tab]) {
    renderTabContent(tab);
    rendered[tab] = true;
  } else if (opts.deferRefresh) {
    // Swipe navigation: the panel is already on screen — re-rendering while the
    // release animation plays causes a visible hitch. Refresh right after it settles.
    setTimeout(refresh, 120);
  } else {
    refresh();
  }

  currentTab = tab;
  updateNavIcons();
  syncPillThumbs();
}

function updateNavIcons() {
  // Icon colors are fully CSS-driven (stroke: currentColor on .nav-icon);
  // clear any inline strokes left from earlier renders.
  document.querySelectorAll('.nav-tab svg').forEach(svg => { svg.style.stroke = ''; });
}

document.querySelectorAll('.nav-tab').forEach(btn => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// Drop the one-shot entrance class once it has played, so later class/display
// churn (e.g. becoming the incoming panel of a swipe) can't replay it.
document.getElementById('content').addEventListener('animationend', e => {
  if (e.animationName === 'tab-in') e.target.classList.remove('tab-enter');
});

updateNavIcons();

/* ════════════════════════════════════════════════════════════════
   TELEGRAM BACK BUTTON
════════════════════════════════════════════════════════════════ */
if (tg) {
  tg.BackButton.onClick(() => {
    // Back navigation: detail page → home tab → close app
    if (typeof tPageId !== 'undefined' && tPageId) {
      closeTournamentPage();
      if (currentTab !== 'home') tg.BackButton.show();
      return;
    }
    if (typeof mPageId !== 'undefined' && mPageId) {
      closeMatchPage();
      if (currentTab !== 'home') tg.BackButton.show();
      return;
    }
    if (currentTab !== 'home') {
      switchTab('home');
      tg.BackButton.hide();
    } else {
      tg.close();
    }
  });

  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => {
      if (btn.dataset.tab !== 'home') tg.BackButton.show();
      else tg.BackButton.hide();
    });
  });
}

/* Segment toggles (Рейтинг ↔ Активність inside the ratings screen).
   Each panel holds its own static copy of the toggle, so on switch the pill
   in the incoming panel is placed at the previous segment first, then slides. */
document.querySelectorAll('.seg-btn[data-seg]').forEach(btn => {
  btn.addEventListener('click', () => {
    const from = btn.dataset.seg === 'activity' ? 'ratings' : 'activity';
    switchTab(btn.dataset.seg);
    slideSegThumbFrom(from);
  });
});

function slideSegThumbFrom(fromSeg) {
  const seg = document.querySelector('.tab-panel.active .seg');
  const thumb = seg?.querySelector('.pill-thumb');
  const fromBtn = seg?.querySelector(`.seg-btn[data-seg="${fromSeg}"]`);
  if (!thumb || !fromBtn || !fromBtn.offsetWidth) return;
  thumb.style.transition = 'none';
  thumb.style.width = fromBtn.offsetWidth + 'px';
  thumb.style.transform = `translateX(${fromBtn.offsetLeft}px)`;
  void thumb.offsetWidth; // reflow so the jump isn't animated
  thumb.style.transition = '';
  positionPillThumb(seg);
}

/* ════════════════════════════════════════════════════════════════
   SWIPE NAVIGATION — the panels follow the finger (like Telegram
   chat folders): the neighbor panel is pre-rendered and dragged in
   alongside the current one, then the release snaps or springs back.
   Skipped while #t-page or a modal is open, and for gestures that
   start inside a horizontally scrollable element (tables etc.).
════════════════════════════════════════════════════════════════ */
const SWIPE_TAB_ORDER = ['home', 'results', 'matches', 'ratings', 'profile'];

(() => {
  const content = document.getElementById('content');
  if (!content) return;

  let sx = 0, sy = 0;            // gesture start
  let mode = 0;                  // 0 idle · 1 armed · 2 dragging
  let dir = 0;                   // +1 = next tab (swipe left), −1 = previous
  let d = 0, W = 0;
  let outPanel = null, inPanel = null, targetTab = null;
  let prevX = 0, prevT = 0, vel = 0;
  let settling = false;          // release animation still playing

  const insideHScroll = (el) => {
    for (; el && el !== content; el = el.parentElement) {
      if (el.scrollWidth > el.clientWidth + 1) {
        const ox = getComputedStyle(el).overflowX;
        if (ox === 'auto' || ox === 'scroll') return true;
      }
    }
    return false;
  };

  content.addEventListener('touchstart', (e) => {
    mode = 0;
    if (settling || e.touches.length !== 1) return;
    if (typeof tPageId !== 'undefined' && tPageId) return;
    if (typeof mPageId !== 'undefined' && mPageId) return;
    if (document.querySelector('.modal-overlay.open')) return;
    if (insideHScroll(e.target)) return;
    sx = prevX = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    prevT = e.timeStamp;
    vel = 0;
    mode = 1;
  }, { passive: true });

  content.addEventListener('touchmove', (e) => {
    if (!mode) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    const dx = x - sx;
    const dy = y - sy;

    if (mode === 1) {
      if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { mode = 0; return; } // vertical scroll wins
      if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.2) return;

      const pos = SWIPE_TAB_ORDER.indexOf(NAV_KEY[currentTab] || currentTab);
      dir = dx < 0 ? 1 : -1;
      targetTab = SWIPE_TAB_ORDER[pos + dir];
      if (pos === -1 || !targetTab) { mode = 0; return; }

      // Pre-render the target BEFORE it becomes visible — rendering during the
      // animation is what caused the visible hitch.
      if (!rendered[targetTab]) { renderTabContent(targetTab); rendered[targetTab] = true; }

      W = content.clientWidth;
      outPanel = document.querySelector('.tab-panel.active');
      inPanel = document.getElementById(TABS[targetTab]);
      // Align the incoming panel so its remembered scroll offset sits at the viewport top
      inPanel.style.top = (content.scrollTop - (tabScroll[targetTab] || 0)) + 'px';
      inPanel.classList.add('drag-peek');
      outPanel.classList.add('dragging');
      inPanel.classList.add('dragging');
      mode = 2;
    }

    if (mode === 2) {
      e.preventDefault();
      d = dir === 1 ? Math.min(0, dx) : Math.max(0, dx);
      outPanel.style.transform = `translateX(${d}px)`;
      inPanel.style.transform = `translateX(${d + dir * W}px)`;
      vel = (x - prevX) / Math.max(1, e.timeStamp - prevT);
      prevX = x; prevT = e.timeStamp;
    }
  }, { passive: false });

  const endDrag = () => {
    if (mode !== 2) { mode = 0; return; }
    mode = 0;
    const flick = dir === 1 ? vel < -0.35 : vel > 0.35;
    const commit = Math.abs(d) > W * 0.3 || (flick && Math.abs(d) > 20);
    const tt = targetTab;
    const op = outPanel, ip = inPanel;

    settling = true;
    op.style.transition = ip.style.transition = 'transform 0.24s var(--ease)';
    if (commit) {
      op.style.transform = `translateX(${-dir * W}px)`;
      ip.style.transform = 'translateX(0)';
      setTimeout(() => {
        // Finalize in one frame: .active lands on a panel that is already
        // displayed and noAnim skips the entrance animation — no flash.
        switchTab(tt, { deferRefresh: true, noAnim: true });
        cleanup(op, ip);
        if (tg) { if (tt !== 'home') tg.BackButton.show(); else tg.BackButton.hide(); }
      }, 250);
    } else {
      op.style.transform = 'translateX(0)';
      ip.style.transform = `translateX(${dir * W}px)`;
      setTimeout(() => cleanup(op, ip), 250);
    }
  };

  function cleanup(op, ip) {
    [op, ip].forEach(p => {
      p.classList.remove('dragging', 'drag-peek');
      p.style.transform = '';
      p.style.transition = '';
      p.style.top = '';
    });
    outPanel = inPanel = targetTab = null;
    settling = false;
  }

  content.addEventListener('touchend', endDrag);
  content.addEventListener('touchcancel', endDrag);
})();

/* ════════════════════════════════════════════════════════════════
   SLIDING PILL THUMBS — one absolutely-positioned pill per toggle
   container glides behind the active button instead of the active
   background teleporting. Containers: .seg, #results-subtabs, #bottom-nav.
════════════════════════════════════════════════════════════════ */
const PILL_CONTAINERS = '.seg, #results-subtabs, #bottom-nav';

function positionPillThumb(wrap) {
  const btn = wrap.querySelector('.seg-btn.active, .results-subtab.active, .nav-tab.active');
  const thumb = wrap.querySelector(':scope > .pill-thumb');
  if (!btn || !thumb || !btn.offsetWidth) return; // container hidden — position when shown
  thumb.style.width  = btn.offsetWidth + 'px';
  thumb.style.height = btn.offsetHeight + 'px';
  thumb.style.top    = btn.offsetTop + 'px';
  thumb.style.transform = `translateX(${btn.offsetLeft}px)`;
  thumb.classList.add('thumb-ready');
}

function syncPillThumbs() {
  document.querySelectorAll(PILL_CONTAINERS).forEach(positionPillThumb);
}

document.querySelectorAll(PILL_CONTAINERS).forEach(wrap => {
  const thumb = document.createElement('span');
  thumb.className = 'pill-thumb';
  wrap.prepend(thumb);
  // Reposition after the container's own click handlers moved .active
  wrap.addEventListener('click', () => requestAnimationFrame(() => positionPillThumb(wrap)));
});
window.addEventListener('resize', syncPillThumbs);
syncPillThumbs();

/* ════════════════════════════════════════════════════════════════
   MODAL SHEET — swipe down to dismiss (finger-following drag).
   Engages on a downward drag anywhere on the sheet, except when the
   scrollable .modal-body is not at its top (then it just scrolls).
════════════════════════════════════════════════════════════════ */
document.querySelectorAll('.modal-overlay').forEach(overlay => {
  const sheet = overlay.querySelector('.modal-sheet');
  if (!sheet) return;

  let sx = 0, sy = 0, dy = 0, mode = 0; // 0 idle · 1 armed · 2 dragging
  let body = null, prevY = 0, prevT = 0, vel = 0;

  sheet.addEventListener('touchstart', e => {
    mode = 0;
    if (e.touches.length !== 1) return;
    body = e.target.closest('.modal-body');
    sx = e.touches[0].clientX;
    sy = prevY = e.touches[0].clientY;
    prevT = e.timeStamp;
    dy = 0; vel = 0;
    mode = 1;
  }, { passive: true });

  sheet.addEventListener('touchmove', e => {
    if (!mode) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dy = y - sy;

    if (mode === 1) {
      if (body && body.scrollTop > 0) { mode = 0; return; }       // let the body scroll
      if (dy < -8 || Math.abs(dy) < Math.abs(x - sx)) { if (dy < -8) mode = 0; return; }
      if (dy < 10) return;
      sheet.style.transition = 'none';
      mode = 2;
    }

    e.preventDefault();
    sheet.style.transform = `translateY(${Math.max(0, dy)}px)`;
    vel = (y - prevY) / Math.max(1, e.timeStamp - prevT);
    prevY = y; prevT = e.timeStamp;
  }, { passive: false });

  const endSheetDrag = () => {
    if (mode !== 2) { mode = 0; return; }
    mode = 0;
    const commit = dy > 120 || (vel > 0.5 && dy > 40);
    sheet.style.transition = 'transform 0.25s var(--ease)';
    if (commit) {
      sheet.style.transform = 'translateY(110%)';
      setTimeout(() => {
        closeModal(overlay.id);
        sheet.style.transition = '';
        sheet.style.transform = '';
      }, 240);
    } else {
      sheet.style.transform = '';
      setTimeout(() => { sheet.style.transition = ''; }, 260);
    }
  };
  sheet.addEventListener('touchend', endSheetDrag);
  sheet.addEventListener('touchcancel', endSheetDrag);
});

/* ════════════════════════════════════════════════════════════════
   T-PAGE EDGE SWIPE — drag from the left edge pulls the tournament
   detail page rightward following the finger; past the threshold it
   closes (mirrors the Telegram/iOS back gesture).
════════════════════════════════════════════════════════════════ */
(() => {
  const page = document.getElementById('t-page');
  if (!page) return;

  let sx = 0, sy = 0, dx = 0, mode = 0, W = 0;
  let prevX = 0, prevT = 0, vel = 0;

  page.addEventListener('touchstart', e => {
    mode = 0;
    if (e.touches.length !== 1 || !tPageId) return;
    sx = prevX = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    if (sx > 36) return; // edge zone only — keeps inner horizontal scrolls usable
    prevT = e.timeStamp;
    dx = 0; vel = 0;
    W = page.clientWidth;
    mode = 1;
  }, { passive: true });

  page.addEventListener('touchmove', e => {
    if (!mode) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dx = x - sx;

    if (mode === 1) {
      if (Math.abs(y - sy) > Math.abs(dx)) { mode = 0; return; }
      if (dx < 10) return;
      page.style.transition = 'none';
      mode = 2;
    }

    e.preventDefault();
    page.style.transform = `translateX(${Math.max(0, dx)}px)`;
    vel = (x - prevX) / Math.max(1, e.timeStamp - prevT);
    prevX = x; prevT = e.timeStamp;
  }, { passive: false });

  const endPageDrag = () => {
    if (mode !== 2) { mode = 0; return; }
    mode = 0;
    const commit = dx > W * 0.3 || (vel > 0.5 && dx > 40);
    page.style.transition = 'transform 0.25s var(--ease)';
    if (commit) {
      page.style.transform = 'translateX(100%)';
      setTimeout(() => {
        closeTournamentPage();
        page.style.transition = '';
        page.style.transform = '';
      }, 250);
    } else {
      page.style.transform = '';
      setTimeout(() => { page.style.transition = ''; }, 260);
    }
  };
  page.addEventListener('touchend', endPageDrag);
  page.addEventListener('touchcancel', endPageDrag);
})();

/* M-PAGE EDGE SWIPE — same gesture as above, for the casual match detail page. */
(() => {
  const page = document.getElementById('m-page');
  if (!page) return;

  let sx = 0, sy = 0, dx = 0, mode = 0, W = 0;
  let prevX = 0, prevT = 0, vel = 0;

  page.addEventListener('touchstart', e => {
    mode = 0;
    if (e.touches.length !== 1 || !mPageId) return;
    sx = prevX = e.touches[0].clientX;
    sy = e.touches[0].clientY;
    if (sx > 36) return; // edge zone only — keeps inner horizontal scrolls usable
    prevT = e.timeStamp;
    dx = 0; vel = 0;
    W = page.clientWidth;
    mode = 1;
  }, { passive: true });

  page.addEventListener('touchmove', e => {
    if (!mode) return;
    const x = e.touches[0].clientX;
    const y = e.touches[0].clientY;
    dx = x - sx;

    if (mode === 1) {
      if (Math.abs(y - sy) > Math.abs(dx)) { mode = 0; return; }
      if (dx < 10) return;
      page.style.transition = 'none';
      mode = 2;
    }

    e.preventDefault();
    page.style.transform = `translateX(${Math.max(0, dx)}px)`;
    vel = (x - prevX) / Math.max(1, e.timeStamp - prevT);
    prevX = x; prevT = e.timeStamp;
  }, { passive: false });

  const endPageDrag = () => {
    if (mode !== 2) { mode = 0; return; }
    mode = 0;
    const commit = dx > W * 0.3 || (vel > 0.5 && dx > 40);
    page.style.transition = 'transform 0.25s var(--ease)';
    if (commit) {
      page.style.transform = 'translateX(100%)';
      setTimeout(() => {
        closeMatchPage();
        page.style.transition = '';
        page.style.transform = '';
      }, 250);
    } else {
      page.style.transform = '';
      setTimeout(() => { page.style.transition = ''; }, 260);
    }
  };
  page.addEventListener('touchend', endPageDrag);
  page.addEventListener('touchcancel', endPageDrag);
})();

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

  // Pair-based registration (PAIR, and CUP / TEAM_AMERICANO while in DRAFT): show
  // both options (solo + join a waiting player) in the body
  const pairOptsEl = document.getElementById('reg-confirm-pair-options');
  const submitBtn = document.getElementById('reg-confirm-submit');
  const isPairReg = tIsPairReg(tournament);

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
    cupStartLive();
  } catch (e) {
    body.innerHTML = `<div style="color:#e05252;padding:20px;text-align:center">Помилка: ${esc(e.data?.message || e.message)}</div>`;
  }
}

/* Live scores: with the cup modal open, group and playoff results entered by
   the admin appear here without a reload. See startLivePoll in core.js. */
const CUP_POLL_KEY = 'cup';

function cupStartLive() {
  const live = cupState && (cupState.status === 'GROUP_STAGE' || cupState.status === 'PLAYOFF');
  if (!live) { stopLivePoll(CUP_POLL_KEY); return; }
  const tid = cupTournamentId;
  startLivePoll(CUP_POLL_KEY,
    () => API.cup.get(tid),
    fresh => {
      if (String(cupTournamentId) !== String(tid)) return;
      cupState = fresh;
      renderCupModal();
      if (fresh.status === 'FINISHED') stopLivePoll(CUP_POLL_KEY);
    },
    { seed: cupState });
}

document.getElementById('modal-cup')
  .addEventListener('bsp:closed', () => stopLivePoll(CUP_POLL_KEY));

function renderCupModal() {
  if (!cupState) return;
  syncLivePoll(CUP_POLL_KEY, cupState);   // whatever is on screen is the new baseline
  const body = document.getElementById('cup-modal-body');
  const prevScroll = body.scrollTop;
  const isAdmin = currentUser?.role === 'ADMIN';
  const status = cupState.status;

  let html = '';

  // ── Group Stage ──────────────────────────────────────────────

  if (cupState.groups && cupState.groups.length > 0) {
    html += `<div class="cup-section-title">Груповий етап</div>`;
    const allowGroupEdit = isAdmin && (status === 'GROUP_STAGE' || status === 'PLAYOFF');
    cupState.groups.forEach(group => {
      html += renderCupGroup(group, allowGroupEdit);
    });

    if (isAdmin && status === 'PLAYOFF') {
      html += `<div class="cup-bracket-note">Групові результати можна виправити й після старту плей-офф — сітка при цьому не змінюється автоматично (за потреби скористайтесь «Редагувати пари»).</div>`;
    }

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

    // Detect a same-group first-round match (e.g. two pairs from group A meeting in a semifinal).
    const pairGroupName = cupPairGroupMap();
    const sameGroupR1 = (cupState.mainBracket || []).some(m =>
      m.roundOrder === 1 && m.pair1Id && m.pair2Id
      && pairGroupName[m.pair1Id] && pairGroupName[m.pair1Id] === pairGroupName[m.pair2Id]);
    const playoffStarted = [...(cupState.mainBracket || []), ...(cupState.consolationBracket || [])]
      .some(m => m.score1 != null);

    if (sameGroupR1 && isAdmin && status === 'PLAYOFF' && !playoffStarted) {
      html += `<div class="cup-bracket-warn">⚠️ У першому раунді зустрічаються пари з однієї групи. Натисніть «Редагувати пари», щоб виправити.</div>`;
    }

    if (cupState.mainBracket && cupState.mainBracket.length > 0) {
      html += renderPlayoffBracket(cupState.mainBracket, isAdmin && status === 'PLAYOFF', false);
    }

    if (isAdmin && status === 'PLAYOFF' && !playoffStarted) {
      html += `<button class="btn-secondary cup-reseed-btn" style="width:100%;margin-top:8px">✏️ Редагувати пари</button>`;
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
  body.scrollTop = prevScroll;   // a live refresh must not yank the reader back to the top

  // Right-edge fade hints that the bracket scrolls; hidden once fully scrolled
  body.querySelectorAll('.cup-bracket-wrap').forEach(wrap => {
    const sc = wrap.querySelector('.cup-bracket');
    const upd = () => wrap.classList.toggle('bracket-at-end',
      sc.scrollLeft + sc.clientWidth >= sc.scrollWidth - 8);
    sc.addEventListener('scroll', upd, { passive: true });
    upd();
  });

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

      if (!(await uiConfirm('Підтвердити груповий етап і згенерувати плей-офф сітку?'))) return;
      confirmBtn.disabled = true;
      const ok = await cupConfirmGroups(null);
      if (!ok) confirmBtn.disabled = false;
    });
  }

  // Wire reseed (manual edit of playoff pairs)
  const reseedBtn = body.querySelector('.cup-reseed-btn');
  if (reseedBtn) {
    reseedBtn.addEventListener('click', () => openReseedModal());
  }

  // Wire finalize
  const finalizeBtn = body.querySelector('#cup-modal-finalize-btn');
  if (finalizeBtn) {
    finalizeBtn.addEventListener('click', async () => {
      if (!(await uiConfirm('Завершити кубок та нарахувати рейтинг?'))) return;
      finalizeBtn.disabled = true;
      try {
        cupState = await API.cup.finalize(cupTournamentId);
        tournamentsData = null;
        renderCupModal();
        stopLivePoll(CUP_POLL_KEY);
        showToast('Кубок завершено! Рейтинг нараховано 🏆');
      } catch (e) {
        showToast(e.data?.message || e.message || 'Помилка', 'error');
        finalizeBtn.disabled = false;
      }
    });
  }
}

// ── Cup helpers ───────────────────────────────────────────────────

/** Map of pairId → group display name, built from the current cup state. */
function cupPairGroupMap() {
  const map = {};
  (cupState?.groups || []).forEach(g => (g.pairs || []).forEach(p => { map[p.id] = g.name; }));
  return map;
}

// ── Manual reseed (edit playoff pairs) ────────────────────────────

let cupReseedCtx = null; // { matchups: [[seed1,seed2],...], seedToPair: {seed:pairId}, sel: seedNum|null }

/** Open the modal to manually rearrange the main-bracket first-round pairs. */
function openReseedModal() {
  const r1 = (cupState.mainBracket || [])
    .filter(m => m.roundOrder === 1)
    .sort((a, b) => a.matchOrder - b.matchOrder);

  const seedToPair = {};
  r1.forEach(m => {
    if (m.pair1Id && m.seed1) seedToPair[m.seed1] = m.pair1Id;
    if (m.pair2Id && m.seed2) seedToPair[m.seed2] = m.pair2Id;
  });
  const matchups = r1.map(m => [m.seed1, m.seed2]);

  cupReseedCtx = { matchups, seedToPair, sel: null };
  renderReseedModal();
  openModal('modal-cup-reseed');
}

function renderReseedModal() {
  const { matchups, seedToPair, sel } = cupReseedCtx;
  const groupName = cupPairGroupMap();
  const pairName = {};
  (cupState.mainBracket || []).forEach(m => {
    if (m.pair1Id) pairName[m.pair1Id] = m.pair1Name;
    if (m.pair2Id) pairName[m.pair2Id] = m.pair2Name;
  });

  const chip = (seed) => {
    const pid = seedToPair[seed];
    if (!pid) return `<div class="rs-chip rs-bye">прохід</div>`;
    const isSel = sel === seed;
    return `<button class="rs-chip${isSel ? ' rs-chip-sel' : ''}" data-seed="${seed}">
      <span class="rs-chip-name">${esc(pairName[pid] || '—')}</span>
      <span class="rs-chip-grp">гр. ${esc(groupName[pid] || '?')}</span>
    </button>`;
  };

  let html = '';
  matchups.forEach(([s1, s2], i) => {
    const pid1 = seedToPair[s1], pid2 = seedToPair[s2];
    const same = pid1 && pid2 && groupName[pid1] && groupName[pid1] === groupName[pid2];
    html += `<div class="rs-match${same ? ' rs-match-bad' : ''}">
      <div class="rs-match-title">${i + 1}${same ? ' · ⚠️ одна група' : ''}</div>
      <div class="rs-match-row">${chip(s1)}<span class="rs-vs">vs</span>${chip(s2)}</div>
    </div>`;
  });
  document.getElementById('cup-reseed-body').innerHTML = html;

  document.querySelectorAll('#cup-reseed-body .rs-chip[data-seed]').forEach(btn => {
    btn.addEventListener('click', () => onReseedChipClick(Number(btn.dataset.seed)));
  });
}

function onReseedChipClick(seed) {
  if (cupReseedCtx.sel == null) {
    cupReseedCtx.sel = seed;
  } else if (cupReseedCtx.sel === seed) {
    cupReseedCtx.sel = null; // deselect
  } else {
    // swap the two seeds' pairs
    const stp = cupReseedCtx.seedToPair;
    const a = cupReseedCtx.sel, b = seed;
    const tmp = stp[a]; stp[a] = stp[b]; stp[b] = tmp;
    cupReseedCtx.sel = null;
  }
  renderReseedModal();
}

async function submitReseed() {
  const stp = cupReseedCtx.seedToPair;
  // Seed order: ascending seed number over the real (non-bye) seeds
  const seeds = Object.keys(stp).map(Number).filter(s => stp[s]).sort((a, b) => a - b);
  const seedPairIds = seeds.map(s => stp[s]);
  const btn = document.getElementById('cup-reseed-save');
  btn.disabled = true;
  try {
    cupState = await API.cup.reseedPlayoff(cupTournamentId, { seedPairIds });
    closeModal('modal-cup-reseed');
    renderCupModal();
    showToast('Сітку оновлено ✓');
  } catch (e) {
    showToast(e.data?.message || e.message || 'Помилка', 'error');
  } finally {
    btn.disabled = false;
  }
}

document.getElementById('cup-reseed-save').addEventListener('click', submitReseed);

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

  let html = `<div class="cup-bracket-wrap"><div class="cup-bracket">`;

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

  html += `</div></div>`;
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
    cupStartLive();

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
    renderHome();
  }
}

async function handlePairJoinDeepLink(tournamentId, targetParticipantId) {
  try {
    const tournament = await API.tournaments.get(tournamentId);
    // CUP and TEAM_AMERICANO use the same partner-invite flow as PAIR while in DRAFT
    const isPairReg = tournament && tIsPairReg(tournament);
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

renderHome();

apiBootstrap().then(async () => {
  apiLoading = false;
  if (apiAvailable) {
    ratingsData = null;
    guestsData = null;
    try { achievementsConfig = await API.achievements.getConfig(); } catch { achievementsConfig = []; }
  } else {
    achievementsConfig = [];
  }
  renderHome(); // replace skeleton with real data or offline state

  // Re-render other tabs if the user navigated there before bootstrap finished
  if (currentTab === 'ratings') renderRatings();
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
  } else if (apiAvailable) {
    // Skip on first run — onboarding already owns the screen this session;
    // unseen announcements stay unseen and surface on the next app open.
    checkUnseenAnnouncements();
  }
  // Show Raketo link banner on every app open until the user links their account
  initRaketoLinkBanner();

  initHomescreenBanner();
});
