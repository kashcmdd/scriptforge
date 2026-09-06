# ScriptForge — Handoff Notes

Controller-script hub: custom accounts, a script library with upload/download/
versioning, and a Web Serial device-connect page. Built fresh as a from-scratch
starter — not a clone of any existing product.

Stack: Next.js 14 (App Router), better-sqlite3, bcryptjs, jose (JWT), Vitest,
Playwright.

## Setup
```bash
npm install
copy .env.example .env.local   # then set AUTH_SECRET (openssl rand -hex 32)
npm run dev
```
Visit http://localhost:3000. Email (verification/reset) logs to the console
unless `RESEND_API_KEY` is set. `npm test` for the unit/route suite,
`npm run test:e2e` for Playwright (needs `npx playwright install chromium`
once) — e2e runs against an isolated `e2e-data.sqlite` on port 3100 so it never
touches your dev database.

## Env vars
| Var | Required | Purpose |
|---|---|---|
| `AUTH_SECRET` | Yes | JWT signing secret. App throws on startup if missing. |
| `ADMIN_EMAILS` | No | Comma-separated emails allowed to upload scripts at `/scripts/upload`. |
| `APP_URL` | No | Base URL used to build email links. Defaults to `http://localhost:3000`. |
| `DATABASE_PATH` | No | SQLite file path. Defaults to `data.sqlite`. Used by e2e for isolation. |
| `RESEND_API_KEY` | No | Real email via Resend; without it mail just logs to the console (dev mode). |
| `MAIL_FROM` | No | From-address for Resend sends. |
| `SENTRY_DSN` | No | Wire-up point in `lib/logger.ts`; empty until you have a DSN. |

## What's implemented and verified working
Everything below was actually run against a live server and checked. Rounds
marked **live** were exercised end-to-end via curl/browser; **unit** = covered
by the Vitest route suite (`lib/__tests__/api-routes.test.ts`, 75 tests).

| Feature | Where | Verification |
|---|---|---|
| Signup / login / logout, bcrypt + JWT session cookie | `lib/auth.ts`, `app/api/auth/*` | Live + unit (dupe→409, wrong pass→401, weak pass→400, 6th signup→429) |
| Rate limiting (in-memory, per-IP) | `lib/rate-limit.ts` | Live + unit |
| Email verification (+ resend) | `app/api/auth/verify`, `/resend-verify` | Live (token flows, DB `email_verified=1`) + unit |
| Password reset | `app/api/auth/{request,reset}-password` | Unit incl. old password stops working; live pass done earlier |
| **Session invalidation** (new) | `lib/auth.ts` `tv` claim + `users.session_version`, bumped by password change + reset | Live: a second session is 401 after the password changes; new credentials work |
| **Account self-service** (new round) | `app/api/account/{profile,password,delete}`, `/account` | Unit (display name persists, password change invalidates old, delete removes user+favorites+re-homes scripts); e2e covers display name + password change + re-login; live: delete → login 401 |
| Verified-only downloads & uploads | `app/api/scripts/[id]/download`, `/upload` | Unit (unverified→403, verified→200; upload admin+verified only); e2e asserts the unverified gate on the detail page |
| Library search/game/favor  filters, sort, pagination | `app/scripts/page.tsx`, `lib/db.ts` `listScripts` | Live (favorites filter, per-fav) + unit (`?sort=az`, `?page=`) |
| Script upload (admins) with body validation + GPC syntax | `app/api/scripts/upload` | Live (admin ok, non-admin 403) + unit |
| **Script editing + versioning** (new round) | `app/api/scripts/[id]` PATCH/DELETE, `/versions`, edit page | Unit (owner+admin PATCH bumps v1→v2 with changelog; non-owner→403; delete clears versions; version list; no-op save does **not** bump version; DELETEs are transactional) |
| Script detail: copy, **flow preview**, version history | `app/scripts/[id]`, `copy-button`, `script-preview` | e2e (preview + history present on seeded detail page) |
| Favorites CRUD | `app/api/scripts/[id]/favorite` | Live (`{ok,favorited:true}`) + unit |
| Device hub: Web Serial, presets, hex log, library flow preview | `app/device/page.tsx` | e2e (preset saved → persists across reload; preview renders step counter) |
| **CSRF** on all non-GET `/api/*` (auth entry points exempt) | `middleware.ts`, `lib/csrf.ts`, `/api/csrf`, `lib/csrf-client.ts` | Unit (missing→403, valid token→passes); e2e exercises via browser |
| Security headers + CSP | `next.config.js` | Live (CSP present; `'unsafe-eval'` only in dev for Next's dev runtime — strict in production builds) |
| Health endpoint | `app/api/health` | e2e (`{ok:true,db:"ok"}`) |
| Global error boundary | `app/error.tsx` | Implemented |

## Known gaps — needs a decision or credentials before "done"
1. **Postgres migration** — `lib/db.ts` is SQLite; fine for single-node/hobby,
   not for concurrent real users. Move the queries (they're all in one file)
   and re-run the full suites.
2. **Next.js major upgrade** — `npm audit` still flags high-severity transitive
   PostCSS advisories that only clear with a Next major bump. Breaking change
   (route handlers, `cookies()`); budget a dedicated pass.
3. **Real device protocol** — the device page opens a Serial port and
   echoes/sends raw text only; it doesn't speak the target hardware's real
   command format. Needs the device's protocol spec.
4. **Production email + error monitoring** — console-log mail unless
   `RESEND_API_KEY` is set; `lib/logger.ts` has the Sentry hook point.
5. **Next.js major upgrade / `npm audit`** — some advisories only clear with a
   major bump. Breaking change (route handlers, `cookies()`); budget a
   dedicated pass — this repo is not under version control.
6. **Rate limiter is in-memory** — per-IP bucket in `lib/rate-limit.ts`;
   fine for one node, resets on restart. Pair with a shared store (or Postgres)
   if you add more than one instance.

## Elsewhere caught up since the "gaps" list was written (now shipped)
- **CSP** — production-strict `Content-Security-Policy` header from
  `next.config.js` (`'unsafe-eval'` dev-only for the Next dev runtime).
- **`allowedDevOrigins`** — added `localhost`/`127.0.0.1`/`0.0.0.0`.
- **Session invalidation** on password change/reset (`users.session_version`).
- **Account self-delete** (`/account` danger zone, two-step inline confirm).
- **Script DELETE** now transactional (favorites, versions, script).
- **PATCH no-op** no longer bumps the version.
- **GPC parser** extracted to `lib/gpc.ts` with its own Vitest suite.
- **DB indexes** for game / downloads / created_at / created_by / favorites.
- **Inline confirm** on script delete + aria-labels on device preset controls.

## Elsewhere caught up since the "gaps" list was written (now shipped)

## Verification checklist (repeat after changes)
Run against a live `npm run dev`. Note the **CSRF rule**: every state-changing
call to `/api/*` — except login, signup, request-reset, reset-password — needs
`GET /api/csrf` first and its returned token sent as the `x-csrf-token`
header. Downloads also require a verified email now.

```bash
rm -f data.sqlite   # fresh db, then start dev

# token (cookie jar + header for the state-changing calls below)
curl -s -c c.txt localhost:3000/api/csrf > csrf.json
TOKEN=$(node -e "console.log(JSON.parse(require('fs').readFileSync('csrf.json','utf8')).token)")

# signup
curl -s -c c.txt -X POST localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123"}'
# wrong password -> 401 / weak password -> 400 / duplicate email -> 409
# upload as admin (must be in ADMIN_EMAILS) with csrf header -> 200 {id,version:1}
curl -s -b c.txt -X POST localhost:3000/api/scripts/upload \
  -H "Content-Type: application/json" -H "x-csrf-token: $TOKEN" \
  --data-binary @upload.json
# unverified download -> 403; mark user verified in data.sqlite, then -> 200
# PATCH script as owner/admin (csrf) bumps version; /api/scripts/1/versions lists history
curl -s -b c.txt -X PATCH localhost:3000/api/scripts/1 \
  -H "Content-Type: application/json" -H "x-csrf-token: $TOKEN" \
  --data-binary @patch.json
# mold to your files: upload.json = {"title":"t","game":"g","body":"set_val F 11\nwait 10"}
```

Also run `npm run build` (catches server/client issues `dev` won't), `npm test`
(unit/route suite), and `npm run test:e2e` before considering a change complete.

## File map
```
app/
  page.tsx                     homepage / hero
  layout.tsx, globals.css      shared layout + design tokens (appended: toolbar,
                               chips, pagination, preview/steps, history, presets)
  login/ signup/ forgot-password/ reset-password/   auth pages
  scripts/
    page.tsx                   library (search/filters/sort/pagination)
    [id]/page.tsx              detail: meta, gate, preview, source, history, edit
    [id]/edit/page.tsx         edit form (owners + admins)
    upload/page.tsx            admin upload
    script-preview.tsx         animated step-flow simulator
    copy-button.tsx fav-button.tsx code-view.tsx
  account/page.tsx             settings; profile-form.tsx password-form.tsx
                               delete-account.tsx (two-step confirm)
  device/page.tsx              Web Serial + presets + flow preview
  api/auth/                    signup, login, logout, verify, resend-verify,
                               request-reset, reset-password
  api/account/{profile,password}   account self-service
  api/scripts/{upload,[id]/download,[id]/favorite,[id]/versions,[id]}   scripts API
  api/csrf/  api/health/       CSRF token + health endpoints
  error.tsx                    global error boundary
middleware.ts                  CSRF enforcement on /api/* (auth routes exempt)
lib/
  db.ts         SQLite + schema (users.display_name/*session_version*,
                scripts.version/updated_at, script_versions, indexes),
                createScript/updateScript/listScripts/listScriptVersions
  auth.ts       session/JWT helpers (requires AUTH_SECRET); `tv` claim + DB
                session_version check invalidates old sessions after a pw change
  gpc.ts        `.gpc` step parser shared by preview + device flow simulator
  admin.ts      ADMIN_EMAILS gate
  csrf.ts       double-submit CSRF (x-csrf-token header vs csrf_token cookie)
  csrf-client.ts  client helper: fetch token, attach header to non-GET fetches
  validate.ts   email/password validation
  rate-limit.ts in-memory rate limiter
  mail.ts       console mail in dev, Resend in prod
  logger.ts     structured logging, Sentry hook point
  __tests__/    validate, rate-limit, gpc, api-routes (75 tests, mocked db)
e2e/smoke.spec.js              Playwright browser flows
playwright.config.js           port 3100, isolated e2e-data.sqlite
.github/workflows/ci.yml       build + unit + e2e on push/PR
next.config.js                 security headers
```