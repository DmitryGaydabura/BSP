# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Blacksea Padel club app — a **Telegram Mini App** served as a GitHub Pages static site. The frontend in this repo (`BSP/`) talks to a Spring Boot backend at a separate repo (`bsp-backend/`). Both repos are on the same machine at `/Users/dg/IdeaProjects/`.

**There is no build step.** The frontend is plain HTML/CSS/JS. Editing files is all that's needed; deploy = `git push` to `main`.

## Running locally

**Frontend:** open `index.html` directly in a browser, or serve with any static server. Point `config.js` at a running backend:
```js
window.BSP_API_URL = 'http://localhost:8080/api';
```

**Backend** (`/Users/dg/IdeaProjects/bsp-backend`):
```bash
docker-compose up -d                # start Postgres
# Then run BspApplication via IntelliJ (mvn CLI does not work — see note below)
export TELEGRAM_SKIP_VALIDATION=true  # bypass Telegram auth for local testing
```
- **Do not use `mvn` from the CLI** — Maven 3.6.3 in `.m2/wrapper` fails to compile Java 21. Use IntelliJ's bundled Maven or run `BspApplication` directly from the IDE.
- First admin: `UPDATE users SET role='ADMIN' WHERE telegram_id=<id>;`

**Backend tests** (service-layer only, ~130 pure Mockito tests):
```bash
# Compile + run headlessly via javac+launcher recipe in architecture notes
# Controller (@WebMvcTest) tests require real `mvn test` — cannot run headlessly
```

## Frontend file layout

All JS files share one global scope (classic `<script defer>` tags, no modules). They must stay in load order:

| File | Responsibility |
|---|---|
| `js/core.js` | App-state globals (`currentUser`, `apiAvailable`, `apiLoading`), Telegram WebApp init, `apiBootstrap()`, fallback data arrays, shared helpers (`fmt`, `ratioClass`), live polling (`startLivePoll`/`stopLivePoll`/`syncLivePoll`) |
| `js/americano.js` | Shared create/edit modal for all four self-hosted formats (`amSetFormat`, `AM_FORMAT_BTNS`, `amIsLadderFormat`) + the americano rounds/score modal |
| `js/winners-court.js` | Court-ladder modal for **both** WINNERS_COURT and KING_OF_THE_COURT (`openWinnersCourtModal`, `wcCourtBlock`, `wcCourtRanking`) |
| `js/tournaments.js` | Tournaments tab: compact rows (`buildTournamentRow`/`buildFinishedRow`) + full-screen detail page `#t-page` (`openTournamentPage`, `buildTournamentDetailCard`, `buildFinishedDetailCard`, `wireTournamentCardActions`), `normalizeTournament`, `myEnrollmentState`, `attemptJoinTournament` |
| `js/home.js` | Home tab (`renderHome`) — default screen: next-game hero, rank/activity tiles, live banner, last result |
| `js/players.js` | Ratings screen (`renderRatings`, `renderRatingsSkeleton`), player profile sheet, H2H modal, activity screen, `updateMemberCount` |
| `js/analysis-admin.js` | All admin modals: create/edit tournament, submit results, cup start, admin user management, analysis, Raketo import. Tournament levels cache. `openModal` z-baseline is 200 (above `#t-page` at 150). |
| `js/app.js` | Tab navigation (home-first; `NAV_KEY` maps activity→ratings nav highlight), Рейтинг↔Активність segment toggle, Telegram BackButton (page → home → close), registration confirm screen, toast, cup detail modal + score entry, bootstrap `.then()` handler |
| `js/api.js` | Thin REST client — all `fetch` calls live here. Reads `window.BSP_API_URL` from `config.js`. |
| `css/app.css` | All styles — single file |
| `config.js` | Sets `window.BSP_API_URL` — the only file that changes between local/prod |

**Navigation model:** bottom tabs Головна · Турніри · Рейтинг · Профіль (Головна is default; Активність is not a tab — it's a segment inside Рейтинг). Tournament lists render compact `.t-row` rows; tapping opens the full-screen `#t-page` detail (z-index 150) whose body is the old interactive card with all join/pair/admin actions. After any data mutation `renderResults()` refetches and `refreshOpenTournamentPage()` re-renders an open detail page.

**Profile model:** one identity card (`.pf-card`: hero + Рейтинг/Старт/Активність stat strip), Raketo status, achievements, chart, history, quiet support/logout. Admin actions are NOT inline — a single «Адмін-панель» entry opens the static `#modal-admin-console` sheet (grouped Турніри/Гравці/Система; `wireAdminPanel` wires its buttons once via `adminConsoleWired`). «Створити американо» lives at the top of the Дружні subtab (`.t-create-row` in `renderFriendlyList`), not in the profile.

**Cache-busting:** all `<script>` and `<link>` tags in `index.html` use `?v=N`. Bump the version whenever you change a file.

## Key patterns

**Loading state:** `apiLoading = true` in `core.js` until `apiBootstrap()` resolves. `renderRatings()` and `renderResults()` show shimmer skeleton while `apiLoading` is true; show offline state if `!apiAvailable` after bootstrap completes. No mock data is rendered to users — the `RATINGS`/`TOURNAMENTS` fallback arrays in `core.js` exist only as a reference.

**XSS escaping:** all user-controlled values interpolated into `innerHTML` must go through `esc()` (defined in `players.js`). `escapeHtml()` = `esc()` + `\n→<br>` for AI analysis prose only.

**Global functions in templates:** inline `onclick="globalFn()"` handlers work because all top-level functions stay global. This is intentional.

**Dialogs & feedback:** never use native `alert()`/`confirm()` — use `await uiConfirm(msg)` / `await uiAlert(msg)` from `core.js` (Telegram popups with browser fallback) and `showToast(msg, 'success'|'error'|'info')` for outcomes. **Data freshness:** tab revisits use stale-while-revalidate — `refreshTournamentsSilently()` / `refreshRatingsSilently()` refetch in the background and re-render only on change (never flash a skeleton over cached data); `ratingsFetchedAt` feeds the honest «Оновлено N тому» label via `fmtAgo()`.

**Live results (no reload):** every screen showing a running tournament registers a named poll via `startLivePoll(key, fetchFn, onChange, {seed})` from `core.js` — the tournament detail page (`tournament-page`), the cup modal (`cup`), the americano modal (`americano`) and the court-ladder modal (`court-ladder`). A poll refetches every `LIVE_POLL_MS` (12 s), diffs the serialized payload and re-renders only on a real change; it pauses while `document.hidden` and refetches immediately on resume. Rules when adding one:
- stop it when the surface closes — modals fire a `bsp:closed` event from `closeModal()`; pages call `stopLivePoll` directly — and when the tournament reaches a terminal status;
- call `syncLivePoll(key, state)` after adopting a payload your own mutation returned, so the next tick doesn't repaint over it;
- preserve `scrollTop` around `innerHTML` in any renderer a poll can drive.

Polling (not websockets) is deliberate: the payload changes a few times an hour, and a socket would add a second transport, its own auth handshake and reconnect logic behind Railway's proxy for no user-visible gain.

**Login — two surfaces:** inside Telegram the Mini App gets signed `initData` and `apiBootstrap()` logs in automatically. On the **web version** (same GitHub Pages URL opened in a browser) there is no initData, so the Telegram Login Widget is used and the user stays on the page. `loginWithTelegram()` in `core.js` picks the flow: Mini App initData → popup (`Telegram.Login.auth`, desktop) → full-page redirect to `oauth.telegram.org` (mobile, and the «Увійти без вікна» fallback; the result comes back in `#tgAuthResult` and is consumed by `consumeTgAuthRedirect()` at the top of `apiBootstrap`). Rules:
- the popup MUST be opened synchronously from the click handler — never `await` anything before calling `loginWithTelegram()`;
- the widget script is lazy-loaded, browser-only, and preloaded at startup (`loadTgWidget`), because awaiting it inside the click would lose the popup permission;
- `window.BSP_TG_BOT_ID` lives in `config.js`; the bot's domain must be registered via @BotFather `/setdomain` (one domain per bot — a local/ngrok host needs its own test bot, so the widget cannot be tested on localhost);
- backend: `POST /api/auth/telegram/web` → `TelegramAuthValidator.validateWidget()`. The widget signs with `secret = SHA256(botToken)`, not the initData `HMAC(key="WebAppData")` scheme, and the hash covers **every** field received — that is why the payload is passed around as a `Map`, not a DTO;
- guests can browse (public GET endpoints) but not act — `attemptJoinTournament` sends them to the profile tab to log in. After login/logout call `refreshAfterAuthChange()`, which drops the data caches and re-renders the current tab.

**Admin UI:** most admin controls render conditionally on `currentUser?.role === 'ADMIN'` checks inline in the template strings.

## Backend architecture

```
controller/   → thin @RestController classes, auth via @PreAuthorize
service/      → all business logic
  TournamentService    — CRUD, results, finalize, admin pair/unpair, Raketo import
  PairRequestService   — pair request send/approve/reject/cancel
  CupService           — cup start, group/playoff scoring, confirm, finalize
  RatingService        — Elo-inspired rating calculation, recalculate-all
  TelegramBotService   — all bot messages (announcements, join/leave/pair notifications)
  RaketoService        — scraping Raketo profiles
  AnalysisService      — Claude API calls for tournament/player analysis
entity/       → JPA entities; Tournament, TournamentParticipant (holds partner link), TournamentPair (holds position/score)
dto/          → request/response shapes; TournamentDto.from(t) is the main factory
repository/   → Spring Data JPA interfaces
bot/          → BspBot (TelegramLongPollingBot), BotRegistrar; handles inline keyboard callbacks for pair approve/reject
security/     → JWT filter + Telegram auth validation (Mini App initData + Login Widget)
```

**Tournament flow:** `DRAFT → ACTIVE → FINISHED` (regular); `DRAFT → GROUP_STAGE → PLAYOFF → FINISHED` (CUP).

**Changing format:** `PUT /api/tournaments/{id}/type` (admin, DRAFT only) switches a tournament between any of the seven types while every participant stays enrolled. `TournamentService.changeType` dissolves partner links, registration pairs and pending pair requests when leaving the pair-based family, drops the cup group plan when leaving CUP, and re-derives the engine settings the new format needs (points per match, rounds, calibration, capacity snapped to 4/8/12/16 for americano or whole courts of four for a ladder). `update` routes its own `type` field through the same path, so an admin edit can no longer silently re-type a started tournament. UI: the «Змінити формат» sheet (`#modal-change-type`, `openChangeTypeModal` in `analysis-admin.js`) opened from the detail page's admin actions — the format toggle inside the americano create/edit modal stays locked. No Telegram message is sent; the existing announcement is only edited in place.

**Court ladders** (`TournamentType.isCourtLadder()` — WINNERS_COURT + KING_OF_THE_COURT): courts ranked 1 (top) .. K; a win on court *c* is worth `K − c + 1` points. Both live in `winners_court_matches` and are driven by `WinnersCourtService` behind the `/api/tournaments/{id}/winners-court` endpoints — the format is picked by `type` in `WinnersCourtCreateRequest` (same pattern as AMERICANO/TEAM_AMERICANO). Differences:
- **WINNERS_COURT** — one match per court per round (`sub_round` always 1); the winning pair moves up, the losing pair down. Needs an odd `pointsPerMatch` so a draw is impossible.
- **KING_OF_THE_COURT** — two sub-rounds per court per round (`sub_round` 1..2, `KingOfCourtScheduler`): `A+B vs C+D`, then `A` re-partners with a randomly drawn opponent. The four are then ranked by points *personally scored* across both games (ties: wins → head-to-head → rating → id); top two move up, bottom two down. Draws are allowed (`TournamentType.allowsDraws()`).

**Calibration rounds** (`tournaments.calibration_rounds`, both ladder formats): the first N rounds move players between courts but contribute no points, wins or losses to the standings — they exist purely to sort players onto the right court before scoring starts. Must be `< roundsCount` when one is set. `WinnersCourtMatchDto.pointsPerWin` is 0 for them and `WinnersCourtRoundDto.calibration` flags them for the UI.

**Open-ended ladders** (both formats): `roundsCount` is optional. Left empty, the ladder has no planned length — `canAdvanceRound` and `canFinalize` are both true after every completed scored round, so the organiser picks «наступний раунд» or «завершити» each time and plays as many rounds as the session allows. `canFinalize` stays false while only calibration rounds have been played (finalizing there would freeze a table of zeroes); `finalizeWinnersCourt` enforces the same rule.

**Pair registration** (PAIR and CUP in DRAFT): players join solo → send pair request via deep link → partner approves in Telegram DM → `PairRequestService.approveRequest` links both `TournamentParticipant` records via the `partner` field and saves a `TournamentPair`. `TournamentType.isPairBased()` covers both PAIR and CUP — use this, not `== PAIR`.

**Rating calculation:** `K = 200 × (avgParticipantRating / 1500)`. `delta = K × (actualPerf − expectedPerf)`. Stored in `RatingHistory`. Player levels (C/C−/D+/D) are percentile-based, computed fresh on each recalculate. `finalizedAvgRating` is snapshotted at finalization.

**Telegram announcements:** `TournamentAnnouncement` records track (tournament, chatId, messageId). `refreshAnnouncements()` edits them in-place. Individual "player X looking for partner" messages are tracked in `ParticipantJoinNotification` — used by `notifyPairApproved` and `clearJoinButtons` to remove the inline keyboard button once a pair is formed. All bot notification methods are `@Async`.

**DB migrations:** Liquibase, files in `src/main/resources/db/changelog/changes/`, numbered `001–032`. Add new changesets as `0NN-description.xml` and include in `db.changelog-master.xml`.

## Design system

Two themes driven by the Telegram color scheme (browser fallback: `prefers-color-scheme`): **light = «Court Paper»** (paper `#F4F2EA`, ink `#15302B`, sea-green accent `#0E7C5B`, lime `#D9EF55`), **dark = «navy»** — the legacy navy/gold palette (`#0D1B2E` field, gold `#C9A84C` accent). `html[data-theme="paper"|"navy"]` is set pre-paint by an inline head script and kept in sync by `applyAppTheme()` in `core.js` (subscribes to Telegram `themeChanged`). All theme-dependent colors MUST be tokens — never hardcode hex in component rules. Pairing tokens keep fills readable in both themes: `--ink-fill` (dark card fill in BOTH themes) + `--on-ink`, `--on-accent`, `--on-lime`, `--lime-ink`/`--lime-line`, `--bronze(-soft)`, `--sea-soft`, `--stone-*`/`--dplus-*` (level badges), `--skel-hi`, `--header-bg`. Legacy var names (`--gold`, `--navy-deep`, `--navy-mid`, …) are kept as aliases in `:root` because JS templates inline them — remap values there, never rename. Fonts: Unbounded (display/headings), Golos Text (body), JetBrains Mono (scores/ratings).

Content language is **Ukrainian** (Cyrillic). Player names and technical identifiers stay in English.

## Deployment

- **Frontend:** push to `main` → GitHub Pages auto-deploys to `https://dmitrygaydabura.github.io/BSP/`
- **Backend:** Railway — `config.js` points at `https://bsp-backend-production.up.railway.app/api`
- To test in Telegram, run `ngrok http 8080` and update `config.js` with the ngrok HTTPS URL
