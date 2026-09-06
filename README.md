# ScriptForge

A controller-script hub: custom accounts, a searchable script library with
upload/download/versioning, and a browser-based device connection page built on
the Web Serial API. Built fresh — not a clone of any existing product.

Stack: Next.js 14 (App Router) · better-sqlite3 · bcryptjs · jose (JWT) ·
Vitest · Playwright.

## Features

- **Accounts**: email + password auth, bcrypt hashing, JWT session cookie,
  email verification, password reset, rate limiting (per-IP, in-memory).
- **Account center** (`/account`): display name, change password, resend
  verification, delete account.
- **Script library** (`/scripts`): search + game/favorites filters, sort
  (recent / most downloaded / A–Z), pagination, per-row favorite toggles.
- **Script detail**: source view, one-click copy, visual **flow preview**
  (animated step simulator), version history — the library ships seeded with
  2 sample scripts.
- **Upload** (`/scripts/upload`, admins via `ADMIN_EMAILS`): verified admins
  only, content validated.
- **Editing** (`/scripts/{id}/edit`): owners + admins can edit; content
  changes bump the version and record a changelog entry (custom `.gpc`
  step-command syntax). Saving with no content change leaves the version alone.
- **Downloads**: login required **and** verified email required (403 otherwise).
- **Device hub** (`/device`): Web Serial connect, preset list, hex log toggle,
  and an in-page preview of any library script's step flow.
- **Security**: CSRF protection on all non-GET `/api/*` calls (double-submit
  cookie), a Content-Security-Policy plus other security response headers, no
  `X-Powered-By`. Changing or resetting your password invalidates every other
  session immediately (session-version invalidation).

## Setup

```bash
npm install
copy .env.example .env.local   # fill in AUTH_SECRET (openssl rand -hex 32)
npm run dev
```

Visit http://localhost:3000. Emails (verification/reset) log to the console
until you set `RESEND_API_KEY` in `.env.local`.

## Env vars

| Var               | Required | Purpose                                                        |
|-------------------|----------|----------------------------------------------------------------|
| `AUTH_SECRET`     | Yes      | JWT signing secret; app throws at startup if missing.           |
| `ADMIN_EMAILS`    | No       | Comma-separated emails allowed to upload scripts.               |
| `APP_URL`         | No       | Base URL used in email links (default `http://localhost:3000`). |
| `DATABASE_PATH`   | No       | SQLite file path (default `data.sqlite`).                       |
| `RESEND_API_KEY`  | No       | Real email via Resend; unset → mail logs to console.            |
| `MAIL_FROM`       | No       | From-address for Resend sends.                                  |
| `SENTRY_DSN`      | No       | Wire-up point in `lib/logger.ts`.                               |

## Scripts

| Command                    | What it does                                   |
|----------------------------|------------------------------------------------|
| `npm run dev`              | Dev server on :3000                            |
| `npm run build`            | Production build                               |
| `npm start`                | Serve the production build                     |
| `npm test`                 | Vitest unit/route suite (75 tests)             |
| `npm run test:e2e`         | Playwright smoke suite (isolated `e2e-data.sqlite`, port 3100) |

E2E needs a browser once: `npx playwright install chromium`.

## Production notes

- `npm run build && npm start`, with `DATABASE_PATH` pointing somewhere
  persistent and `RESEND_API_KEY` set for real mail.
- Security headers — including a Content-Security-Policy (strict in production
  builds; `'unsafe-eval'` is only added for the dev runtime) — are set from
  `next.config.js`. `allowedDevOrigins` covers `localhost`/`127.0.0.1`.
- SQLite is fine for a single-node hobby deployment; move `lib/db.ts`
  queries to Postgres before you expect concurrency.

## Tests

- `lib/__tests__/` — unit tests (`validate`, `rate-limit`) and a full route
  suite (auth, account self-service, scripts CRUD/versions/download/upload,
  favorites, health, CSRF) against a mocked `lib/db`.
- `e2e/smoke.spec.js` — browser flows: homepage, health, library sorting,
  detail + preview/history, unverified download gate, register → account
  settings → password change → re-login, device presets persistence + preview.

## Layout

```
app/
  page.tsx                     homepage / hero
  login/ signup/ forgot-password/ reset-password/   auth pages
  scripts/                     library, upload (admin), [id] detail + edit
  account/                     settings: profile, password, delete, resend
  device/                      Web Serial page + flow preview
  api/                         auth, account/*, scripts/*, csrf, health
middleware.ts                  CSRF enforcement via lib/csrf.ts
lib/                           db, auth, admin, validate, rate-limit, mail, logger
e2e/                           Playwright smoke suite
.github/workflows/ci.yml       build + unit + e2e on push/PR
```