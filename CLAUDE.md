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
| `js/core.js` | App-state globals (`currentUser`, `apiAvailable`, `apiLoading`), Telegram WebApp init, `apiBootstrap()`, fallback data arrays, shared helpers (`fmt`, `ratioClass`) |
| `js/tournaments.js` | Tournaments tab: compact rows (`buildTournamentRow`/`buildFinishedRow`) + full-screen detail page `#t-page` (`openTournamentPage`, `buildTournamentDetailCard`, `buildFinishedDetailCard`, `wireTournamentCardActions`), `normalizeTournament`, `myEnrollmentState`, `attemptJoinTournament` |
| `js/home.js` | Home tab (`renderHome`) — default screen: next-game hero, rank/activity tiles, live banner, last result |
| `js/players.js` | Ratings screen (`renderRatings`, `renderRatingsSkeleton`), player profile sheet, H2H modal, activity screen, `updateMemberCount` |
| `js/analysis-admin.js` | All admin modals: create/edit tournament, submit results, cup start, admin user management, analysis, Raketo import. Tournament levels cache. `openModal` z-baseline is 200 (above `#t-page` at 150). |
| `js/app.js` | Tab navigation (home-first; `NAV_KEY` maps activity→ratings nav highlight), Рейтинг↔Активність segment toggle, Telegram BackButton (page → home → close), registration confirm screen, toast, cup detail modal + score entry, bootstrap `.then()` handler |
| `js/api.js` | Thin REST client — all `fetch` calls live here. Reads `window.BSP_API_URL` from `config.js`. |
| `css/app.css` | All styles — single file |
| `config.js` | Sets `window.BSP_API_URL` — the only file that changes between local/prod |

**Navigation model:** bottom tabs Головна · Турніри · Рейтинг · Профіль (Головна is default; Активність is not a tab — it's a segment inside Рейтинг). Tournament lists render compact `.t-row` rows; tapping opens the full-screen `#t-page` detail (z-index 150) whose body is the old interactive card with all join/pair/admin actions. After any data mutation `renderResults()` refetches and `refreshOpenTournamentPage()` re-renders an open detail page.

**Cache-busting:** all `<script>` and `<link>` tags in `index.html` use `?v=N`. Bump the version whenever you change a file.

## Key patterns

**Loading state:** `apiLoading = true` in `core.js` until `apiBootstrap()` resolves. `renderRatings()` and `renderResults()` show shimmer skeleton while `apiLoading` is true; show offline state if `!apiAvailable` after bootstrap completes. No mock data is rendered to users — the `RATINGS`/`TOURNAMENTS` fallback arrays in `core.js` exist only as a reference.

**XSS escaping:** all user-controlled values interpolated into `innerHTML` must go through `esc()` (defined in `players.js`). `escapeHtml()` = `esc()` + `\n→<br>` for AI analysis prose only.

**Global functions in templates:** inline `onclick="globalFn()"` handlers work because all top-level functions stay global. This is intentional.

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
security/     → JWT filter + Telegram initData HMAC-SHA256 validation
```

**Tournament flow:** `DRAFT → ACTIVE → FINISHED` (regular); `DRAFT → GROUP_STAGE → PLAYOFF → FINISHED` (CUP).

**Pair registration** (PAIR and CUP in DRAFT): players join solo → send pair request via deep link → partner approves in Telegram DM → `PairRequestService.approveRequest` links both `TournamentParticipant` records via the `partner` field and saves a `TournamentPair`. `TournamentType.isPairBased()` covers both PAIR and CUP — use this, not `== PAIR`.

**Rating calculation:** `K = 200 × (avgParticipantRating / 1500)`. `delta = K × (actualPerf − expectedPerf)`. Stored in `RatingHistory`. Player levels (C/C−/D+/D) are percentile-based, computed fresh on each recalculate. `finalizedAvgRating` is snapshotted at finalization.

**Telegram announcements:** `TournamentAnnouncement` records track (tournament, chatId, messageId). `refreshAnnouncements()` edits them in-place. Individual "player X looking for partner" messages are tracked in `ParticipantJoinNotification` — used by `notifyPairApproved` and `clearJoinButtons` to remove the inline keyboard button once a pair is formed. All bot notification methods are `@Async`.

**DB migrations:** Liquibase, files in `src/main/resources/db/changelog/changes/`, numbered `001–021`. Add new changesets as `0NN-description.xml` and include in `db.changelog-master.xml`.

## Design system

«Court Paper» light theme. Key tokens: `--paper: #F4F2EA` (background), `--card: #FFFFFF` (cards), `--ink: #15302B` (text/borders), `--accent: #0E7C5B` (sea green, primary accent), `--lime: #D9EF55` (selection/#1 highlight). Legacy var names (`--gold`, `--navy-deep`, `--navy-mid`, …) are kept as aliases in `:root` because JS templates inline them — remap values there, never rename. Fonts: Unbounded (display/headings), Golos Text (body), JetBrains Mono (scores/ratings). The old navy/gold spec in `Blacksea Padel Design System/README.md` is superseded by `css/app.css` tokens.

Content language is **Ukrainian** (Cyrillic). Player names and technical identifiers stay in English.

## Deployment

- **Frontend:** push to `main` → GitHub Pages auto-deploys to `https://dmitrygaydabura.github.io/BSP/`
- **Backend:** Railway — `config.js` points at `https://bsp-backend-production.up.railway.app/api`
- To test in Telegram, run `ngrok http 8080` and update `config.js` with the ngrok HTTPS URL
