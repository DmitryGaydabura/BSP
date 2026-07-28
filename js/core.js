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

/* ── Telegram WebApp init + theme ──────────────────────────────── */
const tg = window.Telegram?.WebApp;

// Theme follows the Telegram color scheme (browser: prefers-color-scheme) by
// default, but the user can pin it to light/dark from the profile screen —
// that choice is saved in localStorage and wins over auto-detection.
// light → «Court Paper» (current), dark → «navy» (legacy navy/gold palette).
const THEME_PREF_KEY = 'bsp_theme_pref'; // 'light' | 'dark' | 'system'

function getThemePref() {
  return localStorage.getItem(THEME_PREF_KEY) || 'system';
}

function autoColorScheme() {
  if (tg) return tg.colorScheme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/* ── Clubs (multi-club) ─────────────────────────────────────────
   The app serves more than one padel club. Tournaments and the activity
   feed are scoped per club (backend `?club=` filter); the player base,
   ratings and casual matches are shared across all clubs. Each club has
   its own identity (logo/name) and its own light+dark palette, selected
   by the `data-club` attribute on <html> (empty = default Blacksea). */
const CLUB_KEY = 'bsp_club'; // 'BLACKSEA' | 'YELLOW'
const CLUBS = {
  BLACKSEA: {
    id: 'BLACKSEA', name: 'Blacksea Padel', sub: '★ Odesa, Ukraine ★', initials: 'BS',
    logo: 'assets/logo.jpg', dataClub: '',
    bg: { light: '#F4F2EA', dark: '#0D1B2E' },
  },
  YELLOW: {
    id: 'YELLOW', name: 'Yellow Padel Club', sub: '★ Odesa, Ukraine ★', initials: 'YP',
    logo: 'assets/yellow_club_logo.jpg', dataClub: 'yellow',
    bg: { light: '#FBF7E4', dark: '#171308' },
  },
};
const CLUB_ORDER = ['BLACKSEA', 'YELLOW'];
let currentClub = (() => {
  try { const c = localStorage.getItem(CLUB_KEY); if (c && CLUBS[c]) return c; } catch { /* private mode */ }
  return 'BLACKSEA';
})();
function clubInfo() { return CLUBS[currentClub] || CLUBS.BLACKSEA; }

// Reflect the active club into the header (logo + name) and the <html> data-club
// attribute that drives the club palette. Re-applies the theme so the browser/TG
// chrome color matches the club.
function applyClub() {
  const club = clubInfo();
  if (club.dataClub) document.documentElement.dataset.club = club.dataClub;
  else delete document.documentElement.dataset.club;
  const img = document.querySelector('#header .logo-img');
  if (img) { img.src = club.logo; img.alt = club.name; }
  const nameEl = document.querySelector('#header .logo-name');
  const subEl = document.querySelector('#header .logo-sub');
  if (nameEl) nameEl.textContent = club.name;
  if (subEl) subEl.textContent = club.sub;
  // Section eyebrows (tab headers) carry the club name; a data-suffix keeps
  // per-eyebrow tails like "· Odesa".
  document.querySelectorAll('.section-eyebrow[data-club-eyebrow]').forEach(el => {
    el.textContent = club.name + (el.dataset.suffix ? ' ' + el.dataset.suffix : '');
  });
  document.title = club.name;
  applyAppTheme(autoColorScheme());
}

// Switch to another club: persist the choice, re-theme, and refetch the
// club-scoped data (tournaments + activity) for whatever tab is on screen.
async function switchClub(clubId) {
  if (!CLUBS[clubId] || clubId === currentClub) return;
  currentClub = clubId;
  try { localStorage.setItem(CLUB_KEY, clubId); } catch { /* private mode */ }
  applyClub();
  try { tg?.HapticFeedback?.impactOccurred('medium'); } catch { /* old client */ }
  if (typeof showToast === 'function') showToast(clubInfo().name, 'info');

  // Tournaments and activity are club-specific — drop their caches so the next
  // read refetches for the new club. Ratings/matches are shared and left alone.
  if (typeof tournamentsData !== 'undefined') tournamentsData = null;
  if (typeof activityCache !== 'undefined') activityCache = {};

  const tab = (typeof currentTab !== 'undefined') ? currentTab : 'home';
  if (tab === 'home' && typeof renderHome === 'function') renderHome();
  else if (tab === 'results' && typeof renderResults === 'function') renderResults();
  else if (tab === 'activity' && typeof renderActivity === 'function') renderActivity();
  else if (tab === 'profile' && typeof renderProfile === 'function') renderProfile();
}

// Cycle to the next club (tapping the header logo). Works for any number of clubs.
function cycleClub() {
  const idx = CLUB_ORDER.indexOf(currentClub);
  switchClub(CLUB_ORDER[(idx + 1) % CLUB_ORDER.length]);
}

function applyAppTheme(scheme) {
  const pref = getThemePref();
  const resolved = pref === 'system' ? scheme : pref;
  const navy = resolved === 'dark';
  document.documentElement.dataset.theme = navy ? 'navy' : 'paper';
  const bg = navy ? clubInfo().bg.dark : clubInfo().bg.light;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', bg);
  if (tg) {
    try { tg.setHeaderColor(bg); tg.setBackgroundColor(bg); } catch { /* old client */ }
  }
}

function setThemePref(pref) {
  if (pref === 'system') localStorage.removeItem(THEME_PREF_KEY);
  else localStorage.setItem(THEME_PREF_KEY, pref);
  applyAppTheme(autoColorScheme());
}

// Header sun/moon toggle: pins an explicit light/dark preference
// (overrides system-follow from that point on).
document.getElementById('theme-toggle')?.addEventListener('click', () => {
  const dark = document.documentElement.dataset.theme === 'navy';
  setThemePref(dark ? 'light' : 'dark');
  try { tg?.HapticFeedback?.impactOccurred('light'); } catch { /* old client */ }
});

// Tapping the header logo switches clubs (Blacksea ↔ Yellow Padel Club).
document.querySelector('#header .logo-img')?.addEventListener('click', cycleClub);

if (tg) {
  tg.ready();
  tg.expand();
  // Android-only fix: Telegram's WebView wraps the app in a native vertical-swipe
  // gesture (minimize / pull-to-refresh). On the short Home screen (scrollTop 0)
  // a downward drag re-instantiates the WebView, so Android users get a "home
  // screen keeps reloading" loop and can never settle in. iOS has no such gesture.
  // disableVerticalSwipes() (Bot API 7.7+) turns it off; guard for old clients.
  try {
    if (typeof tg.disableVerticalSwipes === 'function'
        && (!tg.isVersionAtLeast || tg.isVersionAtLeast('7.7'))) {
      tg.disableVerticalSwipes();
    }
  } catch { /* old client — method unsupported */ }
  applyAppTheme(tg.colorScheme);
  tg.onEvent('themeChanged', () => applyAppTheme(tg.colorScheme));
} else {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  applyAppTheme(mq?.matches ? 'dark' : 'light');
  mq?.addEventListener?.('change', e => applyAppTheme(e.matches ? 'dark' : 'light'));
}

// Reflect the persisted club into the header + palette on load (also re-applies theme).
applyClub();

/* ── App state ─────────────────────────────────────────────────── */
let currentUser = null;   // UserDto from API when logged in
const playerNameOf = p => [p?.firstName, p?.lastName].filter(Boolean).join(' ') || p?.displayName || p?.username || 'Гравець';
let apiAvailable = false; // whether the backend responded
let apiLoading   = true;  // true until apiBootstrap() resolves
let achievementsConfig = null; // array of enabled achievement IDs (null = not yet fetched)

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
   TELEGRAM LOGIN — Mini App + web version
   ────────────────────────────────────────────────────────────────
   Inside Telegram the Mini App is handed signed `initData` for free, so login
   is automatic. On the public web version there is no initData, so we use the
   Telegram Login Widget: the user confirms in Telegram and lands back on this
   page — two flows, same signed payload:
     • popup    — window on oauth.telegram.org, result via Telegram.Login.auth
                  callback. Must be opened synchronously from a click or the
                  browser blocks it.
     • redirect — full-page navigation to oauth.telegram.org, result comes back
                  in `#tgAuthResult`. Used when the widget script is not ready
                  and as the manual «вікно не відкрилось» fallback (popups are
                  unreliable on mobile Safari).
   Requires the bot domain registered via @BotFather /setdomain.
════════════════════════════════════════════════════════════════ */

const IS_TG_MINI_APP = !!tg?.initData;
const TG_OAUTH_URL = 'https://oauth.telegram.org/auth';

// Loaded only in the browser — inside Telegram the widget is never needed, and
// keeping it out avoids a second script touching window.Telegram.
let _tgWidgetLoad = null;
function loadTgWidget() {
  if (_tgWidgetLoad) return _tgWidgetLoad;
  _tgWidgetLoad = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://telegram.org/js/telegram-widget.js?22';
    s.async = true;
    s.onload = resolve;
    s.onerror = () => reject(new Error('telegram-widget.js failed to load'));
    document.head.appendChild(s);
  });
  return _tgWidgetLoad;
}
// Preload at startup so the script is ready by the time the user taps «Ввійти»
// (awaiting it inside the click handler would lose the popup permission).
if (!IS_TG_MINI_APP) loadTgWidget().catch(() => { /* redirect flow still works */ });

// Phones take the redirect flow: mobile browsers (iOS Safari above all) block or
// mangle the OAuth popup, and the widget gives no way to detect that.
const TG_PREFERS_REDIRECT = !!window.matchMedia?.('(pointer: coarse)').matches
  || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

/* Popup login. Resolves with the widget user object; rejects with
   `{ cancelled: true }` when the user closes the Telegram window. */
function tgWidgetPopupLogin() {
  return new Promise((resolve, reject) => {
    const auth = window.Telegram?.Login?.auth;
    if (!auth || !window.BSP_TG_BOT_ID) { reject(new Error('widget-unavailable')); return; }
    // When window.open is blocked the widget does nothing at all and its callback
    // never fires — time out instead of leaving the button dead forever.
    const timer = setTimeout(
      () => reject(new Error('Вікно Telegram не відкрилось — спробуйте «Увійти без вікна»')),
      120000);
    auth({ bot_id: String(window.BSP_TG_BOT_ID), request_access: 'write' }, user => {
      clearTimeout(timer);
      if (user) resolve(user);
      else reject(Object.assign(new Error('cancelled'), { cancelled: true }));
    });
  });
}

/* Redirect login — navigates away, so the returned promise never settles. */
function tgWidgetRedirectLogin() {
  if (!window.BSP_TG_BOT_ID) {
    showToast('Вхід недоступний: не налаштований Telegram-бот', 'error');
    // `silent` — the caller must not toast again, this one is already explained
    return Promise.reject(Object.assign(new Error('missing BSP_TG_BOT_ID'), { silent: true }));
  }
  const back = location.href.split('#')[0];
  location.href = `${TG_OAUTH_URL}?bot_id=${encodeURIComponent(window.BSP_TG_BOT_ID)}`
    + `&origin=${encodeURIComponent(location.origin)}`
    + `&request_access=write`
    + `&return_to=${encodeURIComponent(back)}`;
  return new Promise(() => {});
}

/* Logs in from any surface. MUST be called synchronously from a click handler
   (no awaits before it) or the popup is blocked. */
function loginWithTelegram() {
  if (IS_TG_MINI_APP) {
    return API.auth.loginWithTelegram(tg.initData).then(adoptAuth);
  }
  if (TG_PREFERS_REDIRECT || !window.Telegram?.Login?.auth) return tgWidgetRedirectLogin();
  return tgWidgetPopupLogin()
    .then(user => API.auth.loginWithTelegramWeb(user))
    .then(adoptAuth);
}

function adoptAuth(res) {
  API.setToken(res.token);
  currentUser = res.user;
  apiAvailable = true;
  return res.user;
}

/* Consumes the `#tgAuthResult=<base64 user json>` the redirect flow leaves on
   the URL. Returns true when it produced a session. */
async function consumeTgAuthRedirect() {
  const m = /[#&]tgAuthResult=([^&]+)/.exec(location.hash || '');
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);
  try {
    let b64 = decodeURIComponent(m[1]).replace(/-/g, '+').replace(/_/g, '/');
    while (b64.length % 4) b64 += '=';
    // Decode as UTF-8 — names are usually Cyrillic
    const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
    const user = JSON.parse(new TextDecoder().decode(bytes));
    adoptAuth(await API.auth.loginWithTelegramWeb(user));
    return true;
  } catch (e) {
    console.warn('Telegram web login failed', e);
    return false;
  }
}

/* Re-renders the app after the identity changed (login/logout). */
async function refreshAfterAuthChange() {
  if (typeof ratingsData !== 'undefined') ratingsData = null;
  if (typeof tournamentsData !== 'undefined') tournamentsData = null;
  if (typeof matchesData !== 'undefined') matchesData = null;
  try { achievementsConfig = await API.achievements.getConfig(); } catch { achievementsConfig = []; }

  const tab = (typeof currentTab !== 'undefined') ? currentTab : 'home';
  if (tab === 'results' && typeof renderResults === 'function') renderResults();
  else if (tab === 'ratings' && typeof renderRatings === 'function') renderRatings();
  else if (tab === 'activity' && typeof renderActivity === 'function') renderActivity();
  else if (tab === 'matches' && typeof renderMatches === 'function') renderMatches();
  if (typeof renderHome === 'function') renderHome();
  if (typeof renderProfile === 'function') renderProfile();
  if (typeof updateMemberCount === 'function') updateMemberCount();
}

/* ════════════════════════════════════════════════════════════════
   API BOOTSTRAP — auto-login on startup
════════════════════════════════════════════════════════════════ */

async function apiBootstrap() {
  // Returning from the redirect login flow — that payload wins over any stored token
  if (await consumeTgAuthRedirect()) return;

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
      adoptAuth(await API.auth.loginWithTelegram(initData));
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

/* Native-feeling dialogs: Telegram popups (Bot API 6.2+) with browser
   fallback. Always await these — they resolve like confirm()/alert(). */
function uiConfirm(message) {
  return new Promise(resolve => {
    if (tg?.showConfirm && tg.isVersionAtLeast?.('6.2')) {
      try { tg.showConfirm(message, ok => resolve(!!ok)); return; } catch { /* old client */ }
    }
    resolve(window.confirm(message));
  });
}

function uiAlert(message) {
  return new Promise(resolve => {
    if (tg?.showAlert && tg.isVersionAtLeast?.('6.2')) {
      try { tg.showAlert(message, () => resolve()); return; } catch { /* old client */ }
    }
    window.alert(message);
    resolve();
  });
}

/* Relative «updated N ago» label (uk) */
function fmtAgo(ts) {
  if (!ts) return '';
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return 'щойно';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} хв тому`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} год тому`;
  return new Date(ts).toLocaleDateString('uk-UA', { day: 'numeric', month: 'long' });
}

function fmt(date) {
  const d = new Date(date);
  return d.toLocaleDateString('uk-UA', { day: 'numeric', month: 'long', year: 'numeric' });
}

// Order-agnostic name matching: every whitespace-separated token in `query` must appear
// somewhere in `name` (case-insensitive). So "Петров Іван" matches "Іван Петров" and vice
// versa, and any single token (first OR last name) matches too.
function nameMatches(name, query) {
  const tokens = (query || '').toLowerCase().split(/\s+/).filter(Boolean);
  if (!tokens.length) return true;
  const hay = (name || '').toLowerCase();
  return tokens.every(t => hay.includes(t));
}

/** One-shot staggered entrance for a freshly rendered list: each child fades
    in with a small cascade. The class is removed afterwards so later
    stale-while-revalidate re-renders don't re-animate. */
function staggerListIn(el, cap = 12) {
  if (!el || !el.children.length) return;
  [...el.children].forEach((c, i) => c.style.setProperty('--stg', Math.min(i, cap)));
  el.classList.add('stagger-in');
  setTimeout(() => {
    el.classList.remove('stagger-in');
    [...el.children].forEach(c => c.style.removeProperty('--stg'));
  }, 800);
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
   LIVE POLLING — «результати без перезавантаження»

   A running tournament's scores are entered by whoever is holding the
   phone; everyone else should see them appear on their own screen. The
   backend is a plain REST service behind Railway's proxy, so a socket
   would mean a second transport, its own auth handshake and reconnect
   logic for a payload that changes a few times an hour — polling with a
   diff is the cheaper, more robust fit and reuses the existing client.

   Each open live surface (tournament page, cup/americano/ladder modal)
   registers one named poll. A poll refetches on an interval, compares the
   serialized payload with the last one, and only calls back on a real
   change — so nothing repaints while the data is unchanged. Polls pause
   while the app is backgrounded and refetch immediately on return.
════════════════════════════════════════════════════════════════ */

const LIVE_POLL_MS = 12000;
const _livePolls = new Map(); // key → { fetchFn, onChange, ms, timer, last, busy }

/** Register (or replace) a live poll. `fetchFn` must resolve to the payload to diff. */
function startLivePoll(key, fetchFn, onChange, { ms = LIVE_POLL_MS, seed = null } = {}) {
  stopLivePoll(key);
  const entry = { fetchFn, onChange, ms, timer: null, last: seed ? JSON.stringify(seed) : null, busy: false };
  _livePolls.set(key, entry);
  _scheduleLivePoll(key);
}

function stopLivePoll(key) {
  const entry = _livePolls.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  _livePolls.delete(key);
}

function _scheduleLivePoll(key) {
  const entry = _livePolls.get(key);
  if (!entry || document.hidden) return;
  clearTimeout(entry.timer);
  entry.timer = setTimeout(() => _runLivePoll(key), entry.ms);
}

async function _runLivePoll(key) {
  const entry = _livePolls.get(key);
  if (!entry || entry.busy || document.hidden) return;
  if (!apiAvailable) { _scheduleLivePoll(key); return; }
  entry.busy = true;
  try {
    const data = await entry.fetchFn();
    // The poll may have been replaced or stopped while the request was in flight
    if (_livePolls.get(key) !== entry) return;
    const json = JSON.stringify(data);
    if (json !== entry.last) {
      entry.last = json;
      entry.onChange(data);
    }
  } catch { /* offline or a transient error — keep the current view, try again next tick */ }
  finally {
    entry.busy = false;
    // Skip rescheduling when the poll was replaced or stopped while in flight
    if (_livePolls.get(key) === entry) _scheduleLivePoll(key);
  }
}

/** Refetch a poll right now (e.g. after the user's own mutation), keeping the interval running. */
function pokeLivePoll(key) {
  const entry = _livePolls.get(key);
  if (!entry) return;
  clearTimeout(entry.timer);
  _runLivePoll(key);
}

/** Tell a poll that the payload it would fetch is already on screen, so the next
    tick doesn't repaint over a render the user just triggered themselves. */
function syncLivePoll(key, data) {
  const entry = _livePolls.get(key);
  if (entry) entry.last = JSON.stringify(data);
}

// Telegram suspends the webview when the user switches chats — resume with a fresh
// fetch so the first thing they see on return is up to date, not a stale interval.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    _livePolls.forEach(entry => clearTimeout(entry.timer));
  } else {
    _livePolls.forEach((_, key) => _runLivePoll(key));
  }
});

