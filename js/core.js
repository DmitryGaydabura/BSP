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

