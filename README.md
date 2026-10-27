# LafaekTOEFL AI Coach

Open-source TOEFL iBT practice app with all 12 TOEFL 2026 task types, personalised study plans, AI-generated
practice, server-side scoring, and progress and usage tracking.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · PostgreSQL (Prisma 6) ·
Meta Model API (text, images, speech-to-text) · ElevenLabs (text-to-speech) · Amazon S3 (private media) ·
Nodemailer (Gmail SMTP) · Vitest.

Specs: `LAFAEK_TOEFL_FRONTEND_UI_UX_SPEC.md`, `LAFAEK_TOEFL_BACKEND_IMPLEMENTATION_SPEC.md`.
Status and blockers: [`BACKEND_PROGRESS.md`](BACKEND_PROGRESS.md). Audit: [`BACKEND_AUDIT.md`](BACKEND_AUDIT.md).

## Setup

```bash
npm install                 # also runs `prisma generate`
cp .env.example .env.local  # fill in values locally; never commit .env.local
npm run db:deploy           # apply migrations (uses DATABASE_URL from the environment)
npm run db:seed             # load the shared, hand-written starter set (idempotent)
npm run dev                 # web app on http://localhost:3000
npm run worker              # background generation worker (separate terminal)
```

`npm run verify:providers` checks Meta, ElevenLabs, SMTP and AWS access with minimal calls and prints no secrets.

### Environment

All variables are listed in `.env.example`. Anything without `NEXT_PUBLIC_` is server-only. The app validates its
configuration lazily per feature. A missing integration (for example `S3_BUCKET`) disables only that feature, and the
error names the variable, never its value.

## How it works

```text
Browser ──fetch──▶ Next.js route handlers (app/api/*) ──▶ PostgreSQL (source of truth)
                         │                                  ▲
                         ├─ Meta: AI coaching, speech-to-text│
                         └─ S3: short-lived signed URLs     │
Worker (npm run worker) ── claims jobs (FOR UPDATE SKIP LOCKED) ─┘
   ├─ Meta text: generate → Zod validate → bounded repair → store
   ├─ Meta image → S3          └─ ElevenLabs speech → S3
```

- **Auth.** Email and password. Passwords are hashed with `scrypt`. Sign-up is confirmed with a 6-digit email code that
  is stored only as an HMAC, expires after 10 minutes, allows 5 attempts and works once. Sessions are a random token in
  an `HttpOnly`, `SameSite=Lax` cookie (`__Host-` and `Secure` in production); only its SHA-256 is stored. Every
  mutation checks `Origin`. Login, OTP, generation, feedback and uploads are rate-limited in PostgreSQL. Forgot-password
  points to the configured administrator (`ADMIN_CONTACT_EMAIL`); there is no self-service reset yet.
- **Authorization.** The `(app)` layout requires a valid server session. Every query is scoped to the signed-in user, and
  "not yours" returns the same 404 as "not found".
- **Content.**
  - Each learner sees the shared **starter set** (hand-written, original) plus their own **personalised items**.
  - Personalised items are generated once per study plan (one batch per user and plan version, behind an idempotency key).
  - Answer keys stay on the server; objective tasks are scored with versioned logic (`objective-1`).
- **Generation jobs.** A batch has 12 task-pack jobs, plus audio and image jobs per item. Jobs use leases with
  heartbeats, expired-lease recovery, exponential backoff with jitter, a per-user concurrency limit, and checkpoints per
  item. Completed items are never regenerated.
  - Usage events are idempotent by provider request ID.
  - **One study plan per account per 30 days** (`STUDY_PLAN_COOLDOWN_DAYS`). Editing or replacing the plan within
    that period is refused with `PLAN_LIMIT`, and the Study Plan page disables both buttons and shows the date. A
    per-user advisory lock stops concurrent saves from bypassing the limit. A new plan after the period gets its
    own generation batch; earlier questions stay available.
- **Audio.** Meta has no text-to-speech model, so the owner approved ElevenLabs. There is one MP3 per script line,
  played as a playlist through 5-minute signed URLs. Until an item has audio, the player uses the browser's voice and
  says so; in that case the script is sent to the browser, otherwise it is withheld.
- **Speaking.** The browser converts recordings to 16 kHz mono WAV. Meta `muse-voice-transcribe-1.0` transcribes them.
  Listen and Repeat shows a word-alignment similarity score. Recordings are discarded after transcription unless the
  learner turns on _Keep my speaking recordings_ and S3 is configured.
- **Writing.** Mechanical checks (length, structure, greeting/closing, opinion, reasons) are labelled "not AI scoring".
  AI coaching is optional, needs a click, is rate-limited, and is labelled practice feedback.

## Commands

| Command                                                       | What it does                                                                    |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `npm run lint` / `npm run typecheck` / `npm run build`        | Quality gates                                                                   |
| `npm test`                                                    | Unit and integration tests (integration uses the isolated `lafaek_test` schema) |
| `E2E_BASE_URL=http://localhost:3200 npx vitest run tests/e2e` | HTTP end-to-end tests against a server started with the test schema             |
| `node scripts/check-secrets.mjs`                              | Fails if any secret value appears in client bundles or git-tracked files        |
| `npm run db:status` / `npm run db:deploy`                     | Migration status / apply                                                        |
| `npm run worker` / `npm run worker:prod`                      | Generation worker (`--once` drains and exits)                                   |

New migrations: change `prisma/schema.prisma`, then create a migration with `prisma migrate diff` (Render users
usually cannot create the shadow database that `migrate dev` needs) and apply it with `db:deploy`.

## Deployment

- **Web (Vercel).**
  - Set the variables from `.env.example` per environment (Development, Preview, Production) in Vercel's settings.
  - Use Render's _external_ database URL with `sslmode=require`.
  - Run `prisma migrate deploy` once per release, not from every instance.
- **Worker (Render Background Worker).** Vercel cannot host it, because Vercel only runs short request handlers.
  Without the worker, generation jobs stay queued.
  - Build command: `npm ci --include=dev`. `tsx` and `prisma` are devDependencies.
  - Start command: `npm run worker:prod`.
  - Environment: the same variables as Vercel, with `NODE_ENV=production`.
  - Alternative or supplement: a cron job can `POST /api/internal/worker/tick` with
    `Authorization: Bearer $WORKER_TICK_SECRET`. It processes one job per call, and the queue itself stays in PostgreSQL.
- **Live deployment.** The web app runs at `https://lafaek-toefl-ai-coach.vercel.app`, and the worker is
  `lafaek-toefl-ai-coach-worker` on Render. See `BACKEND_PROGRESS.md` → _Production deployment_.
- **S3.** Use a private bucket with Block Public Access and SSE. Give the IAM user least privilege for that one bucket
  (`s3:PutObject`, `s3:GetObject`, `s3:DeleteObject`, `s3:ListBucket`). Add a lifecycle rule for expired recordings.
  Browser uploads are not used, so no CORS is needed.
- **Admin.** Set `role = 'admin'` on a user in the database. `GET /api/admin/jobs` lists failed or blocked jobs;
  `POST /api/admin/jobs/:id/retry` retries one and writes an audit event.

## Data retention

| Data                                            | Kept                                            | Deletion                                                                        |
| ----------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------- |
| OTP codes                                       | HMAC only, 10-minute validity                   | Superseded codes are invalidated; rows go when the account is deleted           |
| Sessions                                        | 30 days (`SESSION_TTL_DAYS`)                    | Revoked on logout; all deleted with the account                                 |
| Recordings                                      | Only with opt-in consent and configured storage | Learner can delete each one (`DELETE /api/media/:id`); deleted with the account |
| Practice answers, plans, generated items, usage | While the account exists                        | `DELETE /api/account` deletes all rows (cascade) and queues S3 cleanup          |
| Rate-limit counters                             | 2 days                                          | Pruned by the worker                                                            |

## Costs and scoring caveats

- **Costs.** Meta text calls return token usage (stored as actual units). The model's reasoning makes output tokens
  large: about 6,000 per item in testing. ElevenLabs returns no usage data, so characters and seconds are stored as
  _estimates_. No prices are configured, so the app shows no cost figures. `GENERATION_ITEMS_PER_TASK` (default 2) and
  `GENERATION_DAILY_USER_LIMIT` are the hard limits.
- **Scores.** All scores and feedback are **practice estimates, never official ETS/TOEFL scores**. The 100-word
  discussion length is shown as a practice guideline. Speaking similarity compares transcripts and is not a
  pronunciation analysis.

## Frontend structure

```text
app/(public)/      landing, login, signup, verify-email, forgot-password
app/(app)/         authenticated pages (server components fetch data via lib/server)
app/api/           route handlers (Zod-validated, request IDs, sanitized errors)
components/        UI, layout, practice engine (tasks/*), generation status, charts
lib/config/        practice-types.ts (the 12 types), navigation, assets, mock-test durations
lib/content/       curated vocabulary and practice instructions
lib/practice/      client-safe DTOs (never contain answer keys)
lib/server/        server-only: env, db, auth, providers, storage, content, generation, insights
prisma/            schema, migrations, starter content and converter
scripts/           worker, seed, provider checks, e2e generation check, secret scan, asset crop
tests/             unit, integration (isolated schema), e2e (HTTP)
```

UI routes: `/`, `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/dashboard`, `/practice`,
`/practice/[slug]` (12 task types), `/study-plan`, `/vocabulary`, `/mock-test`, `/mock-test/session`,
`/mock-test/results`, `/progress`, `/usage`, `/profile`, `/settings`. The asset crop provenance is in
`public/assets/ASSET_MANIFEST.md`.

## Known limitations

See `BACKEND_PROGRESS.md` → _Blockers_. In short:

- The ElevenLabs key cannot list voices, so a fixed set of premade voices (`ELEVENLABS_VOICE_IDS`) is used and accent
  selection isn't applied.
- Starter-set items have no generated audio yet; they use the browser-voice fallback.
- No self-service password reset.
- Google sign-in is not implemented.
- The mock test uses the starter set and is a short practice test.
