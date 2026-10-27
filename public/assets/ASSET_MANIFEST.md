# Asset manifest

Every file in `public/assets/` is derived from the supplied sources by `scripts/crop-assets.mjs`
(`npm run assets:crop`). The originals in `logo_icon/` and `ilu/` are never modified.
Runtime code references these files through `lib/config/assets.ts`.

## Source inspection

| Source | Size | Type | Notes |
|---|---|---|---|
| `logo_icon/logo.png` | 1254×1254 | RGBA, 70% transparent | Mascot + open book (rows 155–882), wordmark (rows 880–1105). |
| `logo_icon/all_icon.png` | 1536×1024 | RGBA, 78% transparent | Composite sheet: 82 labelled 3D icons in 6 rows, each with a text label below. |
| `logo_icon/all_background.png` | 1663×946 | RGB | Composite sheet: 9 illustration panels separated by white gutters, each with a caption below. |
| `ilu/*.png` (26 files) | ~1663×946 | RGB | Page reference screenshots (see the route map in `README.md`). |

## Logo — `assets/logo/`

| File | Source & crop | Used for |
|---|---|---|
| `logo.png` | Exact copy of `logo_icon/logo.png` | Reference copy |
| `logo-full-trimmed.png` | `logo.png`, transparent padding trimmed | Landing "About" section |
| `logo-mark.png` | `logo.png` rows 150–878, trimmed | Mascot mark: horizontal lockup, landing hero, dashboard hero, Practice Center header, 404, favicon |
| `logo-wordmark.png` | `logo.png` rows 879–1111, trimmed; the book tip (x 608–652, rows 879–883) masked out | Wordmark in the horizontal lockup (`components/brand/Logo.tsx`) |

The book tip overlaps the wordmark's first rows vertically but not horizontally, so the mark is cut at
row 878 and the 5-pixel tip is removed from the wordmark crop. Both crops were checked visually.

## Backgrounds — `assets/backgrounds/`

Panel gutters were measured programmatically (rows/columns that are >97% white). Each panel is inset
2 px so no gutter or caption is included.

| File | Sheet region (x, y) | Used for |
|---|---|---|
| `login.png` / `login-scene.png` | 0–401, 0–425 (scene: from y 140) | `/login` illustration |
| `signup.png` / `signup-scene.png` | 413–826 (scene: from y 150) | `/signup` illustration |
| `otp.png` / `otp-scene.png` | 839–1243 (scene: from y 150) | `/verify-email` illustration |
| `forgot-password.png` / `forgot-password-scene.png` | 1255–1662 (scene: from y 140) | `/forgot-password` illustration |
| `dashboard.png` | 0–327, 489–881 | Catalogued, not currently shown (see README) |
| `progress.png` | 335–731, 489–881 | `/progress` empty state |
| `resources.png` | 742–1009, 489–881 | Catalogued, not currently shown |
| `profile.png` | 1020–1327, 489–881 | `/profile` side panel; "Interviewer (mascot)" on Take an Interview |
| `settings.png` | 1339–1662, 489–881 | `/settings` side panel |

`*-scene.png` crops start below the baked-in "LafaekTOEFL" wordmark, because the auth layout renders
the real logo above the illustration.

## Icons — `assets/icons/` (82 files)

Each icon was cropped from its own alpha band (labels sit in separate bands, so no text is included).
Cell boundaries are the midpoints between icon centres. The bounding box comes from connected
components with alpha > 40, ignoring thin divider lines. Each crop is padded to a square with
transparent pixels. All 82 were reviewed on a contact sheet.

| Row (sheet y) | Icons |
|---|---|
| Navigation (75–159) | home, practice, mock-test, progress, resources, profile, settings, login, signup, otp-verify, forgot-password, logout |
| Practice / feature (273–361) | listening, reading, speaking, writing, ai-practice, ai-coach, tips, test-strategy, feedback, discussion, saved, favorite, history |
| Action (458–527) | start, pause, stop, next, previous, retry, volume-on, volume-off, speed, download, upload, share, edit, delete |
| Status (615–690) | success, error, warning, info, loading, online, offline, premium, streak, achievement, goal, score, analytics, calendar |
| Account (777–839) | email, password, show, hide, user, users, key, security, phone, message, help, support, contact-admin, continue |
| Resource (919–979) | video, pdf, link, image, document, audio, voice, quiz, practice-test, score-chart, report, website, external-link, search, filter |

Main uses: skill icons on the landing page; page-header tiles (calendar, practice, goal, progress,
analytics, profile, settings, score); Tip cards (tips); usage metrics (ai-coach, image, audio, message,
quiz, practice-test, history); auth feature row (goal, analytics, tips); results (achievement, success).
Small interface icons (navigation, buttons) use Lucide for consistency at 16–24 px.

## Visuals from the page screenshots — `assets/crops/`

These visuals exist only in `ilu/` screenshots. They are cropped at about 1× display size.

| File | Source screenshot (x, y, w, h) | Used for |
|---|---|---|
| `sidebar-motto.png` | `dashboard_page.png` (16, 762, 216, 152) | Sidebar "Practice · Learn · Improve · Succeed!" card |
| `listening-conversation.png` | `Listen to a Conversation …png` (312, 272, 526, 248) | Conversation scene (illustrated, fictional people) |
| `listening-announcement.png` | `Listen to an Announcement …png` (312, 272, 520, 240) | Announcement scene |
| `writing-email-hiking.png` | `Write an Email …png` (312, 270, 366, 258) | Write an Email task illustration |
| `speaking-office-printer.png` | `Listen and Repeat …png` (646, 304, 330, 348) | Listen and Repeat situation |
| `vocabulary-environment.png` | `Vocabulary …png` (922, 396, 280, 288) | Flashcard image for "environment" |
| `avatar-speaker-a.png`, `avatar-speaker-b.png` | `Build a Sentence …png` (328, 330/411, 74, 74) | Cartoon speaker avatars |
| `header-study-plan.png`, `header-vocabulary.png`, `header-mock-test.png`, `header-progress.png`, `header-usage.png` | Header art from the matching screenshots | Page header art (edges softened with a CSS mask, `.art-fade`) |

### Deliberately not reused

- **Photographs of people** (the Academic Discussion avatars, the lecturer photo, the interviewer photo):
  these are not licensed brand assets. Initials avatars, a neutral "lecture slide" illustration, and
  the mascot are used instead.
- **Whole screenshots** are never displayed as page content.
