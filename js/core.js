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

function applyAppTheme(scheme) {
  const pref = getThemePref();
  const resolved = pref === 'system' ? scheme : pref;
  const navy = resolved === 'dark';
  document.documentElement.dataset.theme = navy ? 'navy' : 'paper';
  const bg = navy ? '#0D1B2E' : '#F4F2EA';
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

if (tg) {
  tg.ready();
  tg.expand();
  applyAppTheme(tg.colorScheme);
  tg.onEvent('themeChanged', () => applyAppTheme(tg.colorScheme));
} else {
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
  applyAppTheme(mq?.matches ? 'dark' : 'light');
  mq?.addEventListener?.('change', e => applyAppTheme(e.matches ? 'dark' : 'light'));
}

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

