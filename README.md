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
   ├─ study_schedule:  Meta outline of the learner's calendar → validated → dated days
   ├─ task_pack:       Meta text → Zod validate → bounded repair → store questions
   ├─ vocabulary_pack: Meta picks words from those questions → stored per learner
   ├─ asset_image:     Meta image → S3
   └─ asset_audio:     ElevenLabs speech → S3
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
- **Study plans.**
  - **Dated schedule.** The plan counts the days from the learner's local "today" (`startDate`, accepted within a day
    of the server's date) to the test date. It can be anything from the same day to one year ahead. Every study day
    is placed on the weekdays the learner chose, until the day before the test, and the test day is shown at the end.
    - Without a test date, the length depends on level: 6–12 weeks.
    - If none of the chosen weekdays fall before a very near test, every day until the test is used.
  - **Daily content.** Each study day is filled within the learner's daily minutes, from the week's priority tasks
    (weak skills first), plus vocabulary review.
    - One **mock test** is placed 3–6 days before the test, and long plans get one about every 3 weeks.
    - The last study day before the test is a **light review**.
    - Plans of 2 weeks or less skip the build-up phases and review everything.
    - Code: `lib/server/study-plan-builder.ts`.
  - **AI personalisation.** Saving a plan shows the rule-based schedule at once and queues a `study_schedule` job. In
    the worker, Meta proposes a week-by-week outline: theme, focus skills, priority tasks, mock-test day and tip.
    - The outline is validated against the real calendar: mock tests only on study days, never on the final review
      day, and known task IDs only.
    - It is expanded into days by the same code. Invalid parts keep the rule week.
    - The page shows "Personalising with AI…" until the job finishes.
    - Code: `lib/server/generation/study-schedule.ts`.
  - **Score scale.** Targets use the TOEFL 2026 bands (1–6, see below).
  - **One study plan per account per 30 days** (`STUDY_PLAN_COOLDOWN_DAYS`). Editing or replacing the plan within
    that period is refused with `PLAN_LIMIT`, and the Study Plan page disables both buttons and shows the date. A
    per-user advisory lock stops concurrent saves from bypassing the limit. A new plan after the period gets its own
    generation batch; earlier questions stay available.
- **Generation jobs.** Job types are `study_schedule`, `task_pack` (12 per plan; default counts in
  `PRACTICE_TYPES.referenceCount`, 208 questions per plan), `vocabulary_pack`, `asset_image`, `asset_audio`,
  `delete_user_assets` and `reconcile_media`.
  - Jobs use leases with heartbeats, expired-lease recovery, exponential backoff with jitter, a per-user concurrency
    limit and per-item checkpoints. Completed items are never regenerated.
  - A rejected key or unknown model waits as `PROVIDER_CONFIG` ("Waiting for AI service setup") instead of failing,
    and is re-queued when the worker restarts.
  - On `model_not_found`, Meta calls retry 3 times, then use `META_TEXT_FALLBACK_MODEL` (`muse-spark-1.2`).
  - At start-up and every 10 minutes, the worker checks whether Meta lists our models from its network. If not, it
    skips Meta jobs and still runs audio and clean-up jobs.
  - Usage events are idempotent by provider request ID.
- **Vocabulary.** There is no fixed word list. When a practice type's questions finish, a `vocabulary_pack` job asks
  Meta for up to `VOCABULARY_WORDS_PER_TASK` (default 10) useful words from those questions' texts. Words that do not
  occur in the texts, or that the learner already has, are dropped. They are stored per learner in
  `vocabulary_words`. Worker housekeeping back-fills vocabulary for packs that finished earlier.
  Pronunciation uses ElevenLabs (`POST /api/vocabulary/:id/audio`): the clip is made the first time a word is
  played, in the plan's first accent, stored privately in S3 and served by 5-minute signed URLs. It is
  rate-limited to 120 new clips per hour. The browser voice is only a fallback.
- **Audio.** Meta has no text-to-speech model, so the owner approved ElevenLabs. There is one MP3 per script line,
  played as a playlist through 5-minute signed URLs. Until an item has audio, the player uses the browser's voice and
  says so; in that case the script is sent to the browser, otherwise it is withheld.
- **Speaking.** The browser converts recordings to 16 kHz mono WAV. Meta `muse-voice-transcribe-1.0` transcribes them.
  Listen and Repeat shows a word-alignment similarity score. Recordings are discarded after transcription unless the
  learner turns on _Keep my speaking recordings_ and S3 is configured.
- **Writing.** Mechanical checks (length, structure, greeting/closing, opinion, reasons) are labelled "not AI scoring".
  AI coaching is optional, needs a click, is rate-limited, and is labelled practice feedback.
- **Timing.** Practice tasks have no countdown; only the mock test is timed. Speaking recordings still stop at the
  task's answer time.
- **Interface motion (GSAP).** All of it is off when the device asks for reduced motion (`lib/client/motion.ts`).
  - A crocodile loading screen (`app/(app)/loading.tsx`) appears after 0.15 s and explains slow or missing
    internet. An app-wide offline banner shows the connection state.
  - Pages, landing sections, progress bars and counters, answer feedback, results, flashcards and toasts have short
    entrance effects.

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
  - **Region: Singapore.** Meta's API lists no models to Render's Ohio (US, Amazon) network, but works from
    Singapore. See `BACKEND_PROGRESS.md`.
  - Build command: `npm ci --include=dev`. `tsx` and `prisma` are devDependencies.
  - Start command: `npm run worker:prod`.
  - Environment: the same variables as Vercel, with `NODE_ENV=production`.
  - Alternative or supplement: a cron job can `POST /api/internal/worker/tick` with
    `Authorization: Bearer $WORKER_TICK_SECRET`. It processes one job per call, and the queue itself stays in PostgreSQL.
- **Live deployment.** The web app runs at `https://lafaek-toefl-ai-coach.vercel.app`, and the worker runs on Render
  in Singapore. See `BACKEND_PROGRESS.md` → _Production deployment_.
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
  _estimates_. No prices are configured, so the app shows no cost figures. `GENERATION_ITEMS_PER_TASK` (optional cap; unset = the per-type defaults in `lib/config/practice-types.ts`, 208 per plan) and
  `GENERATION_DAILY_USER_LIMIT` are the hard limits.
- **Score scale.** The app uses the TOEFL iBT 2026 scale: bands from 1 to 6 in 0.5 steps, with CEFR (6 C2,
  5–5.5 C1, 4–4.5 B2, 3–3.5 B1, 2–2.5 A2, 1–1.5 A1). See `lib/config/toefl-scale.ts`. Study-plan targets use it, and
  old 0–120 targets are read as the nearest band.
- **Scores.** All scores and feedback are **practice estimates, never official ETS/TOEFL scores**. The 100-word
  discussion length is shown as a practice guideline. Speaking similarity compares transcripts and is not a
  pronunciation analysis.

## Frontend structure

```text
app/(public)/      landing, login, signup, verify-email, forgot-password
app/(app)/         authenticated pages (server components fetch data via lib/server)
app/api/           route handlers (Zod-validated, request IDs, sanitized errors)
components/        UI, layout, practice engine (tasks/*), generation status, study-plan calendar, motion, charts
lib/config/        practice-types.ts (the 12 types), navigation, assets, mock-test durations
lib/content/       vocabulary categories and practice instructions (no fixed word list)
lib/client/        browser helpers: API client, WAV encoder, GSAP motion setup
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
- AI writing coaching and speaking transcription run in Vercel route handlers. Vercel's default region is in the US,
  where Meta has not served models to cloud servers, so they may fail in production until Meta allows it. A Vercel
  function region near Singapore should work, but it makes every database call cross the Pacific.
- No self-service password reset.
- Google sign-in is not implemented.
- The mock test uses the starter set and is a short practice test.
