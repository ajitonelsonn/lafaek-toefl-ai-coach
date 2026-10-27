# LafaekTOEFL AI Coach — Frontend (Phase 1)

Open-source TOEFL preparation app. This phase is **frontend-only**: every page and interaction works
in the browser with sample content and simulated services. Nothing connects to Meta AI, PostgreSQL,
SMTP, or S3, and the app needs no credentials or `.env` file to run.

The master specification is `LAFAEK_TOEFL_FRONTEND_UI_UX_SPEC.md`.

## Run it

```bash
npm install
npm run dev          # http://localhost:3000
npm run build && npm start
npm run lint         # ESLint (flat config)
npm run typecheck    # tsc --noEmit
npm run assets:crop  # regenerate public/assets from logo_icon/ and ilu/
```

Optional: copy `.env.example` to `.env.local` and set `NEXT_PUBLIC_ADMIN_CONTACT_EMAIL` to show a real
"Contact Admin" link on `/forgot-password`. Without it, the page shows a generic "contact the site
administrator" message. No address is invented.

**Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Lucide icons.
`sharp` is a dev dependency, used only by the asset crop script.

## Routes and reference screenshots

| Route | Reference (`ilu/`) |
|---|---|
| `/` | `Landing Page.png` |
| `/login` · `/signup` · `/verify-email` · `/forgot-password` | `login-page.png` · `singup page.png` · `next otp verification.png` · `Forgot Password — Contact Administrator..png` |
| `/dashboard` | `dashboard_page.png` |
| `/practice` | `Practice Center page.png` |
| `/practice/[slug]` (12 routes) | The 12 `… — Practice Page.png` files, plus `example/build-sentence-example/` for Build a Sentence |
| `/study-plan` | `Study Plan — Personalized TOEFL Learning.png` |
| `/vocabulary` | `Vocabulary — Practice and Review.png` |
| `/mock-test` · `/mock-test/session` · `/mock-test/results` | `Mock Test — Full TOEFL Practice Exam.png` (session and results are new states) |
| `/progress` | `Progress — Scores and Performance Analytics.png` |
| `/usage` | `reource-page.png` (built as the account usage dashboard, as the spec requires) |
| `/profile` · `/settings` | `profile-page.png` · `Settings-page.png` |

The 12 practice slugs are `complete-the-words`, `read-in-daily-life`, `read-academic-passage`,
`listen-choose-response`, `listen-conversation`, `listen-announcement`, `listen-academic-talk`,
`build-sentence`, `write-email`, `academic-discussion`, `listen-repeat`, and `take-interview`.

## Where things live

```text
app/(public)/          landing + auth pages (AuthLayout)
app/(app)/             authenticated shell (AppShell: Sidebar, Topbar, MobileNav)
components/ui/         Button, Input/Textarea/Select, Card, ProgressBar/Ring, StatusBadge, Dialog/ConfirmDialog,
                       Toast, Toggle, Tabs/ChipGroup, Empty/Loading/Error states, TipCard, Icon3D
components/practice/   PracticeLayout, CountdownTimer, QuestionNavigation, ChoiceList, AudioPlayer,
                       RecordingControl, ResultsPanel, usePracticeSession, tasks/* (one per interaction)
components/generation/ GenerationStatus, GenerationProgress
components/charts/     LineChart, ColumnChart, BarList (single-series SVG with hover and keyboard tooltips)
lib/config/            practice-types.ts (the 12 types, counts, slugs), navigation, site, assets, usage limits
lib/mock-data/         ALL sample content: questions, practice guides, vocabulary, mock test, usage
lib/services/          typed interfaces (types.ts), mock implementations (mock/), registry (index.ts)
lib/store/             demo-store.ts: localStorage-backed demo state (non-sensitive only)
scripts/crop-assets.mjs  derives public/assets from the supplied images
public/assets/ASSET_MANIFEST.md  every crop, with its source region and use
```

To change the 12 practice types or their reference counts, edit `lib/config/practice-types.ts`. Cards,
navigation, search, the mock test, and study plans all read from that file.

To connect a backend, implement the interfaces in `lib/services/types.ts` and swap them in
`lib/services/index.ts`. UI components do not import the mock modules directly.

## Implementation decisions

- **Sample vs planned counts.** The reference counts (10, 50, 40 …) are shown as "planned".
  Progress is measured against the bundled sample set (57 items across the 12 types), so learners can
  actually finish it. Every practice page is labelled "Sample questions".
- **Audio.** No audio files exist, so `AudioPlayer` reads the transcript with the browser's speech voice
  and says so. It plays once ("like the real test"), with a "Replay (practice only)" option and an
  optional transcript. When `MediaRef.url` is set (for example, a signed S3 URL later), it plays the
  file instead.
- **Recording.** `RecordingControl` uses the real microphone (MediaRecorder). The audio stays in the
  tab as an object URL and is never uploaded. If the microphone is blocked or unsupported, a clearly
  labelled *simulated* recording is offered.
- **Build a Sentence** follows the exam style in `example/build-sentence-example/`: one underlined
  blank per word group, a plain word bank, click (or drag) to fill, and feedback per slot (your word
  struck through with a red underline, the correct word in green). A "Why this order?" explanation is
  added after checking.
- **Writing feedback** is a set of rule-based checks (length, sentences, greeting/closing, opinion,
  reference to classmates). It is explicitly labelled as *not* AI scoring.
- **Auth is simulated.** Any valid-looking credentials work and any 6-digit OTP is accepted, with a
  notice on each form. Passwords and OTP codes are never stored. Only name and email are kept in
  localStorage. Routes are not guarded, because a client-only guard would not be real security.
- **Generation status.** Finishing a study plan starts *simulated* jobs for all 12 types (one fails
  on purpose so the retry state can be seen). Practice is never blocked on generation.
- **Mock test** is a short demo test (9 items) built from samples. The full-length structure is shown
  for reference. Results are "practice estimates", not TOEFL scores. Writing and Speaking are marked
  "not scored".
- **Usage page** uses demo numbers. Limits appear only where `lib/config/usage.ts` defines one. There
  are no billing or "upgrade plan" elements.
- **Images of people.** Photographs from the screenshots (discussion avatars, lecturer, interviewer)
  were not reused. Initials avatars, a neutral slide illustration, and the mascot are used instead.
- **Theme.** Light, Dark, and "Same as my device" are all supported through semantic CSS variables.
  Illustrations keep their light backgrounds in dark mode.

## Verification (this phase)

- `npm run lint`: no problems. `npm run typecheck`: no errors. `npm run build`: 31 pages generated.
- All 28 routes were loaded in headless Chrome at 1440, 1024, 768, and 390 px. There was no horizontal
  overflow, and no console errors or warnings.
- Scripted flows passed: sign-up validation → sign-up → OTP → dashboard (with a check that the password
  and OTP are absent from storage); Build a Sentence wrong and correct answers; a full Read in Daily
  Life set to results; Complete the Words scoring; Write an Email checks; Listen and Repeat recording;
  study-plan wizard → plan → generation progress; vocabulary know/bookmark/quiz; mock test submit →
  results; progress with real data; dark theme saved and applied; mobile drawer open/close (Esc).

## Known limitations

- No real AI generation, scoring, audio files, email, persistence, or authentication (by design for Phase 1).
- Demo state lives in one browser's localStorage. Clearing site data resets it.
- Speech-synthesis voices vary by browser and OS. Some browsers have none, so the transcript is the fallback.
- Screenshot-derived crops are at about 1× resolution, so they look slightly soft on high-DPI screens.
  Higher-resolution source art would fix this.
- Sample content is small (2–7 items per type). The mock test is a 9-item demo, not a full-length test.
- The language setting shows English only.
- `dashboard.png` and `resources.png` from the background sheet are cropped and catalogued but not
  currently displayed.
