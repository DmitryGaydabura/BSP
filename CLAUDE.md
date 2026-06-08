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
| `js/tournaments.js` | Results tab rendering (`renderResults`, `renderUpcomingList`, `renderFinishedList`), `normalizeTournament`, pair participants list |
| `js/players.js` | Ratings tab (`renderRatings`, `renderRatingsSkeleton`), player profile sheet, H2H modal, activity tab, `updateMemberCount` |
| `js/analysis-admin.js` | All admin modals: create/edit tournament, submit results, cup start, admin user management, analysis, Raketo import. Tournament levels cache. |
| `js/app.js` | Tab navigation, registration confirm screen, toast, cup detail modal + score entry, bootstrap `.then()` handler |
| `js/api.js` | Thin REST client — all `fetch` calls live here. Reads `window.BSP_API_URL` from `config.js`. |
| `css/app.css` | All styles — single file, ~3500 lines |
| `config.js` | Sets `window.BSP_API_URL` — the only file that changes between local/prod |

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

Navy/gold dark theme. Key tokens: `--navy-deep: #0D1B2E` (background), `--navy-mid: #1A2F4A` (cards), `--gold: #C9A84C` (accent). Fonts: Cinzel (brand name only), Playfair Display (headings), Montserrat (body), Courier Prime (scores/stats). Full design spec in `Blacksea Padel Design System/README.md`.

Content language is **Ukrainian** (Cyrillic). Player names and technical identifiers stay in English.

## Deployment

- **Frontend:** push to `main` → GitHub Pages auto-deploys to `https://dmitrygaydabura.github.io/BSP/`
- **Backend:** Railway — `config.js` points at `https://bsp-backend-production.up.railway.app/api`
- To test in Telegram, run `ngrok http 8080` and update `config.js` with the ngrok HTTPS URL
