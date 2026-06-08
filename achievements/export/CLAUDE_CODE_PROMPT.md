# Implement the Blacksea Padel achievement system

You are working in the **BSP** Telegram-mini-app codebase (vanilla JS, no build
step). Your job is to wire in a finished, self-contained achievement system that
ships in this package and integrate it into the player profile. Do **not**
redesign the visuals — the crest, catalog, grid, and animations are already built
and validated; you are integrating them and computing earned/locked from real data.

---

## 0. What ships in this package (copy as-is, do not rewrite)

```
js/bsp-crest.js          # houseCrest() SVG renderer — no dependencies
js/bsp-achievements.js   # catalog + computeStats + renderGrid + playUnlock + revealStagger
css/bsp-achievements.css # namespaced .bsp-* styles + animations
```

Copy these three files into the app:

- `js/bsp-crest.js`        → `BSP/js/bsp-crest.js`
- `js/bsp-achievements.js` → `BSP/js/bsp-achievements.js`
- `css/bsp-achievements.css`→ `BSP/css/bsp-achievements.css`

They expose globals on `window`: `BSPCrest` and `BSPAchievements`. Read the JSDoc
at the top of each file for the full API. **Never** `<script src>` a `.jsx`; these
are plain JS.

---

## 1. Load the files (`BSP/index.html`)

The required Google Fonts (Playfair Display, Montserrat, Courier Prime) are
**already loaded** in `<head>` — do not add them again.

**1a.** After the app stylesheet (`<link rel="stylesheet" href="css/app.css?v=21">`,
~line 17) add:

```html
<link rel="stylesheet" href="css/bsp-achievements.css?v=1">
```

**1b.** The page loads feature scripts with `defer` near the bottom (~lines
781–785, in order: core, tournaments, players, analysis-admin, app). Add the two
new scripts **before** `js/players.js` so the globals exist when players.js runs:

```html
<script src="js/bsp-crest.js?v=1" defer></script>
<script src="js/bsp-achievements.js?v=1" defer></script>
<script src="js/players.js?v=44" defer></script>   <!-- bump the version query -->
```

(`defer` scripts execute in document order, so crest → achievements → players is
guaranteed.)

---

## 2. Where it goes in the UI

Decision (already made by the product owner): **a new full achievements grid on
the player profile, keeping the existing tournament-win cups list above it.**

The profile already renders an empty mount point:

- Own profile: `<div id="profile-achievements"></div>` (in `renderProfile()`),
  filled in `loadHistory()` (~line 1342):
  `achEl.innerHTML = renderAchievements(currentUser.id, currentUser.displayName); wireAchievements(achEl);`
- Other player profile: `<div id="pp-achievements"></div>`, filled the same way
  (~line 439): `achEl.innerHTML = renderAchievements(player.id, player.name); wireAchievements(achEl);`

So **everything routes through `renderAchievements(playerId, playerName)` and
`wireAchievements(container)`** in `BSP/js/players.js`. You only edit those two
functions — both call sites keep working unchanged.

---

## 3. Edit `renderAchievements()` (`BSP/js/players.js`, ~line 990)

Today it returns only the cups list, and returns `''` when the player has no
wins. Change it to: **(a)** keep the cups section exactly as-is when wins exist,
then **(b)** always append the new achievements grid.

Replace the function body so it ends like this (keep the existing `wins`/`cups`
computation — only the `return` changes, and add the stats block):

```js
function renderAchievements(playerId, playerName) {
  const source = tournamentsData || TOURNAMENTS;
  const MONTHS = ['Січ','Лют','Бер','Кві','Тра','Чер','Лип','Сер','Вер','Жов','Лис','Гру'];

  // ── existing: tournament-win cups ──────────────────────────────
  const wins = source
    .filter(t => t.status === 'FINISHED' && (t.results || []).some(r =>
      r.pos === 1 && (r.players || []).some(p =>
        (playerId && String(p.id) === String(playerId)) || (p.name && p.name === playerName))))
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const cupsHtml = wins.map(t => {
    const d = new Date(t.date);
    const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
    return `<div class="ach-cup cup-gold" data-tid="${t.id}" role="button" tabindex="0">
      ${trophySvg('cup-gold')}
      <div class="ach-name">${esc(t.name)}</div>
      <div class="ach-date">${dateStr}</div>
    </div>`;
  }).join('');

  const cupsSection = wins.length ? `<div class="achievements-section">
    <div class="achievements-title">Перемоги</div>
    <div class="achievements-list">${cupsHtml}</div>
  </div>` : '';

  // ── new: full achievement grid ─────────────────────────────────
  const ratingEntry = (ratingsData || []).find(p =>
    (playerId && String(p.id) === String(playerId)) || p.name === playerName);
  const level = ratingEntry?.level
    || (playerId === currentUser?.id ? levelFromPoints(currentUser?.ratingPoints) : 'E');
  const rank = ratingsData
    ? ratingsData.findIndex(p =>
        (playerId && String(p.id) === String(playerId)) || p.name === playerName) + 1
    : 0;

  const stats = BSPAchievements.computeStats({
    playerId, playerName,
    tournaments: source,
    level,
    rank,
    isMonthLeader: false   // see §6 — wire to activity API later if desired
  });

  const gridSection = BSPAchievements.renderGrid(stats);

  return cupsSection + gridSection;
}
```

Notes:
- `ratingsData`, `currentUser`, `levelFromPoints`, `esc`, `trophySvg`,
  `tournamentsData`, `TOURNAMENTS` are all already in scope in players.js.
- If `BSPAchievements` is somehow undefined (script failed to load), guard so the
  cups still render: wrap the grid block in `if (window.BSPAchievements) { … }`.

---

## 4. Edit `wireAchievements()` (`BSP/js/players.js`, ~line 1252)

Keep the existing cup tap-to-open-modal wiring. Add two things at the end:

```js
function wireAchievements(container) {
  // … existing cup tap / keyboard handlers stay unchanged …

  // entrance animation for the new grid
  if (window.BSPAchievements) BSPAchievements.revealStagger(container);

  // unlock celebration for achievements earned since the user last looked
  playNewlyEarned(container);
}
```

Add this helper (client-side "newly earned" detection via localStorage, so the
celebration only fires the first time an achievement flips to earned):

```js
function playNewlyEarned(container) {
  if (!window.BSPAchievements || !currentUser) return;
  // Only celebrate on the signed-in user's own profile.
  const isOwn = container.id === 'profile-achievements';
  if (!isOwn) return;

  const key = `bsp_seen_ach_${currentUser.id}`;
  let seen;
  try { seen = JSON.parse(localStorage.getItem(key) || '[]'); } catch { seen = []; }
  const seenSet = new Set(seen);

  const earnedCards = [...container.querySelectorAll('.bsp-ach.is-earned')];
  const earnedIds = earnedCards.map(c => c.dataset.achId);

  // first ever load: record silently, don't fire a burst for everything
  if (seen.length === 0) {
    localStorage.setItem(key, JSON.stringify(earnedIds));
    return;
  }

  const fresh = earnedCards.filter(c => !seenSet.has(c.dataset.achId));
  fresh.forEach((card, i) => setTimeout(() => {
    // card is already rendered as earned; replay the celebration on it
    card.classList.add('is-locked');               // momentarily lock so the flip reads
    card.classList.remove('is-earned');
    BSPAchievements.playUnlock(card);
  }, 500 + i * 900));

  localStorage.setItem(key, JSON.stringify(earnedIds));
}
```

> The grid renders each earned achievement already in its earned state. To make a
> *newly* earned one feel earned, the helper above briefly re-locks it then calls
> `playUnlock`, which flips it back with the crest reveal + gleam + particle burst.
> If you prefer no re-lock flourish, just call `BSPAchievements.playUnlock(card)`
> on cards rendered as locked when the backend reports a fresh unlock (see §6).

---

## 5. Data mapping & per-achievement logic (already implemented in `computeStats`)

`computeStats` derives everything from the player's tournament rows plus a few
scalars you pass in. The catalog (5 groups, 20 items) and its thresholds:

| Group | Achievement | id | Earned when | Progress |
|---|---|---|---|---|
| Турнірні перемоги | Перша перемога | `first_win` | ≥1 tournament win (pos 1) | — |
| | Чемпіон | `champion` | ≥1 win | — |
| | Володар Кубка | `cup_winner` | win a tournament whose name/category contains "cup"/"кубок" | — |
| | Чемпіон сезону | `season_champ` | `rank === 1` | — |
| | Подіум | `podium` | ≥1 top-3 finish | — |
| | Бездоганний | `flawless` | **approx:** ≥1 win (no per-match data) — see ⚠ | — |
| Серії та форма | Хет-трик | `hat_trick` | best win-streak ≥ 3 | x/3 |
| | Вогняна серія | `fire_streak` | best win-streak ≥ 5 | x/5 |
| | Незупинний | `unstoppable` | best win-streak ≥ 10 | x/10 |
| Участь та активність | Дебютант | `debut` | ≥1 tournament played | — |
| | Завсідник | `regular` | ≥25 played | x/25 |
| | Ветеран | `veteran` | ≥50 played | x/50 |
| | Гравець місяця | `player_month` | `isMonthLeader === true` | — |
| | Залізна воля | `iron_will` | ≥6 consecutive active months | x/6 |
| | Душа клубу | `club_soul` | ≥15 distinct partners | x/15 |
| Рівні майстерності | Рівень D+ | `level_dplus` | level ≥ D+ | — |
| | Рівень C− | `level_cminus` | level ≥ C− | — |
| | Рівень C | `level_c` | level ≥ C | — |
| Особливі | Щасливчик | `lucky` | finished 7th ×3 | x/3 |
| | Гросмейстер | `grandmaster` | `rank` in 1–3 | — |

Win-streak, played count, podiums, distinct partners, 7th-places, consecutive
active months, and cup detection are all computed from `tournaments`. A tournament
"belongs" to the player if any result row contains them by `id` (preferred) or
exact `name`. Partner detection reads the other names in the player's own pair.

**Level ladder** (`LEVEL_ORDER`): `E < D < D+ < C- < C < C+ < B- < B < B+ < A < A+`.
The minus sign `−` is normalized to `-`.

### ⚠ Assumptions to verify against your backend

1. **`flawless` ("Бездоганний")** is approximated as "won a tournament" because
   per-match win/loss data isn't in the tournament results shape. If the backend
   knows a player won without dropping a match, override it (see §6).
2. **`player_month` ("Гравець місяця")** needs the monthly activity leader. Pass
   `isMonthLeader: true` when known (the app has `API.activity.monthly(...)`).
3. **`first_win` vs `champion`** both fire at the first win by design (the catalog
   defines them as distinct badges). Leave as-is unless the product wants a ladder.
4. **`season_champ` / `grandmaster`** use the live rating rank, not a frozen
   per-season standing. If you track season-end standings, override `season_champ`.

---

## 6. Optional: backend-authoritative earned/progress

`renderGrid(stats, { overrides })` accepts a map that wins over the computed
values, so you can move truth to the server incrementally without changing the UI:

```js
const overrides = {
  flawless:     { earned: true },
  player_month: { earned: false },
  regular:      { value: 22 }       // show 22/25 from the server
};
BSPAchievements.renderGrid(stats, { overrides });
```

If/when the backend exposes an achievements endpoint, build `overrides` from it.
Until then, the auto-computed values are the source of truth.

---

## 7. Acceptance criteria

- [ ] `bsp-crest.js`, `bsp-achievements.js`, `bsp-achievements.css` copied in and
      referenced from `index.html` (CSS after app.css; the two scripts deferred
      **before** players.js; players.js `?v=` bumped).
- [ ] Opening **my profile** shows the tournament-win cups (if any) **and** the new
      grid below: 5 sections (Турнірні перемоги, Серії та форма, Участь та
      активність, Рівні майстерності, Особливі), 20 cards total, with the
      "N з 20 досягнень" summary.
- [ ] Earned achievements show the full-colour crest + "✓ Виконано" tag; locked
      ones show the desaturated crest with the padlock cresting the shield.
- [ ] Count-based locked achievements (`regular`, `veteran`, `club_soul`,
      `fire_streak`, `unstoppable`, `iron_will`, `lucky`) show a gold progress bar
      with `current/target`.
- [ ] Grid animates in with a staggered rise on open; cards are **visible even if
      JS is disabled / the animation never runs** (no permanently-hidden content).
- [ ] Hovering an earned card sweeps a gleam and lifts it slightly.
- [ ] Visiting another player's profile shows their grid (no unlock celebration —
      that only fires on the signed-in user's own profile).
- [ ] When the signed-in user earns a new achievement (e.g. after a win that flips
      a threshold), the next time their profile loads, that card plays the unlock
      celebration (crest flip + gleam + particle burst) exactly once. Subsequent
      loads do not replay it (localStorage `bsp_seen_ach_<userId>`).
- [ ] `prefers-reduced-motion: reduce` disables the entrance, flip, and particles
      (the grid renders fully, just without motion).
- [ ] No new console errors. The cups list and the existing 3D-trophy
      `openAchievementTournament` modal still work unchanged.

---

## 8. Don'ts

- Don't edit the three package files' internals — integrate around them.
- Don't recompute or restyle crests inline; always call `BSPCrest.houseCrest(...)`.
- Don't introduce a build step, framework, or new dependency.
- Don't add tiers (bronze/silver/gold) — category colours only, per the design.
- Don't remove or restructure the existing cups list or the tournament modal.
