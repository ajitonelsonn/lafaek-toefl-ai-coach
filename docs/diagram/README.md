# How LafaekTOEFL AI Coach works

LafaekTOEFL AI Coach is a TOEFL iBT (2026 format) practice app. A learner writes a study plan, and AI builds a personal set of practice questions for all 12 TOEFL task types, with pictures, listening audio, vocabulary and a study schedule. The learner practises, gets instant AI scores for writing and speaking, and can take a full timed mock test. A score of 4.0 or higher earns a certificate that anyone can check online.

On a **Meta Quest**, the same learner can step into the **VR Study Room**: a hands-first virtual classroom with 9 of the TOEFL tasks, using their own study-plan questions and the same scoring.

The seven diagrams below explain how it works, from the big picture down to the database, then the VR room and signing in on the headset.

1. [System architecture](#1-system-architecture)
2. [Content generation](#2-content-generation--from-study-plan-to-practice)
3. [Mock test](#3-mock-test--taking-scoring-and-certificates)
4. [Sign-up, login and sessions](#4-sign-up-login-and-sessions)
5. [Database](#5-database)
6. [VR Study Room on Meta Quest](#6-vr-study-room-on-meta-quest)
7. [Sign in on Quest with a code](#7-sign-in-on-quest-with-a-code)

---

## 1. System architecture

![System architecture](01-architecture.png)

The app runs on four services, each doing what it is best at.

| Service                                        | Where                               | What it does                                                                                                              |
| ---------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| **Web app** (Next.js 15, React 19, TypeScript) | Vercel                              | All pages and API routes: sign-up and login, study plans, practice, instant scoring, mock tests, certificate checks       |
| **VR Study Room** (IWSDK on Three.js, WebXR)   | Vercel, at `/vr/room`               | A static build served next to the web app. It runs in the Meta Quest Browser and calls the same API routes                |
| **Background worker** (Node.js)                | Render, Singapore, 0.5 CPU / 512 MB | Long AI work: writing questions, making pictures and audio, choosing vocabulary, planning the schedule, rating mock tests |
| **Database** (PostgreSQL, through Prisma)      | Render                              | All app data, plus the job queue and the rate limits                                                                      |
| **File storage** (Amazon S3)                   | AWS                                 | Pictures, listening audio, word pronunciation and mock-test recordings in a private bucket                                |

The app uses these AI models:

| Provider   | Model                       | Used for                                                                                                                                           |
| ---------- | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Meta       | `muse-spark-1.3`            | Main text model: writes questions, vocabulary and study schedules; scores and coaches writing and speaking                                         |
| Meta       | `muse-spark-1.2`            | Fallback, used automatically when 1.3 is unavailable                                                                                               |
| Meta       | `muse-image-1.0`            | Pictures for practice questions                                                                                                                    |
| Meta       | `muse-voice-transcribe-1.0` | Speech-to-text for spoken answers                                                                                                                  |
| ElevenLabs | `eleven_multilingual_v2`    | Listening audio and word pronunciation. Voices match each speaker's gender and the learner's chosen accents (US, UK, Australian, Indian, African). |

Gmail SMTP sends the verification and password-reset codes.

**The key design choice:** the web app and the worker never call each other. When the web app needs long work done, it adds a job to a queue table in PostgreSQL, and the worker picks it up. This means:

- Web requests stay fast. Vercel never waits minutes for AI generation, and no request hits a timeout.
- Nothing is lost when the worker restarts. Jobs stay in the database and are picked up again.
- There is no extra queue service to run or pay for.

There are two exceptions where the web app calls the AI directly, because the learner is waiting for the answer:

- Practice answers are scored instantly. Speech-to-text and the AI score take about 10–14 seconds, well within Vercel's limit.
- Verification emails are sent straight away.

**Media is never public.** Files sit in a private S3 bucket. The browser gets a signed link that works for 5 minutes, and only after the server has checked that the file belongs to that learner. The VR room loads its pictures and audio through the web app instead (`/api/media/[id]/file`, same ownership check), because WebGL textures and Web Audio cannot read cross-origin S3 links.

---

## 2. Content generation — from study plan to practice

![Content generation](02-content-generation.png)

This is what happens after a learner saves a study plan. A whole plan takes **10–15 minutes** on one small worker.

1. **The learner creates a study plan:** level, target band, test date, study days, minutes per day and up to 5 accents.
2. **`POST /api/study-plan`** checks the answers, uses 1 plan credit, saves the plan and queues a job to plan the AI study schedule.
3. **`POST /api/generation/start`** creates one _batch_ with 12 `task_pack` jobs, one for each TOEFL task type.
4. **Long lane (`task_pack`).** The worker takes one pack per learner at a time and asks Muse Spark to write questions in small batches (5–10 per call). Every item is checked before it is saved:
   - its format against a schema;
   - that the answer key is valid;
   - for Complete the Words, the letter blanks follow the C-test rule.

   Answer choices are shuffled, so the right answer is not always "A".

5. **Quick lane.** Each saved item queues its own small jobs: `asset_image` makes the picture and `asset_audio` makes the listening audio. When a task type is finished, `vocabulary_pack` picks words from its questions. `study_schedule` plans the weeks. These start while the long packs are still being written, so the learner can begin earlier.
6. **The AI models:**
   - Muse Spark writes the text.
   - Muse Image draws the pictures.
   - ElevenLabs speaks the audio, with a voice that matches each speaker's gender and the learner's accents.
   - Finished files go to S3.
7. **The learner watches progress.** The page refreshes every 5 seconds, and each task type opens as soon as its questions are ready.
8. **`GET /api/generation/[id]`** reads the job states from the database. Internal error details are never sent to the browser.

**How the worker takes jobs:**

- **Two lanes.** The worker runs two lanes side by side: long question packs (3 slots) and quick media jobs (6 slots). Pictures and audio never wait behind a long pack.
- **No double work.** Jobs are claimed under a database lock, so two workers never take the same job.
- **Recovery.** A running job holds a _lease_ and sends a heartbeat. If a worker stops, its jobs are picked up again.
- **Retries.** A failed job is retried up to 3 times. The learner can retry a failed task type from the progress page.
- **Cost tracking.** Every AI call is recorded in `usage_events` (provider, model, tokens or characters).

---

## 3. Mock test — taking, scoring and certificates

![Mock test](03-mock-test.png)

A mock test is a full, timed test made from the learner's own practice items and covering all 12 task types.

1. **Start.** Starting uses 1 mock credit. An unfinished test resumes without using another credit.
2. **`POST /api/mock-test/start`** builds the test form and **signs it (HMAC)**. The answers are checked against the signed form, so the browser cannot change the questions or the answer key.
3. **The timed test.** Reading 30 min, Listening 29 min, Writing 23 min, Speaking 8 min. Like the real test, there is no pause, replay or retry, and right or wrong is not shown during the test.
4. **`POST /api/mock-test/recording`.** Each spoken answer is uploaded to S3 _during_ the test, so submitting stays fast.
5. **Submit.** An animated screen shows the progress while the answers are checked.
6. **`POST /api/mock-test/submit`** checks the signature. It then scores Reading, Listening and Build a Sentence immediately and queues a `mock_scoring` job for the open answers.
7. **The `mock_scoring` job on the worker:**
   1. downloads each recording from S3;
   2. turns speech into text with `muse-voice-transcribe-1.0`;
   3. checks Listen and Repeat by matching the words with the sentence (80% or more counts as correct);
   4. has `muse-spark-1.3` rate the email, the academic discussion and the interview against the ETS 2026 criteria;
   5. **deletes the recordings** from S3;
   6. issues a certificate if the overall band is 4.0 or higher.
8. **Results.** The learner sees a band from 1 to 6 and the CEFR level for each skill. The page refreshes every 8 seconds until the AI rating is done.
9. **`GET /api/mock-test/latest`** returns the result, its scoring status and the certificate.
10. **Anyone can check a certificate.** A school or employer opens the link or QR code printed on the certificate.
11. **`/verify/[code]`** is a public page showing the name, bands, date and whether the certificate is valid or revoked.

**How bands are made:**

- Each task gets a band from 1 to 6, in steps of 0.5.
- A section's band is the average of its tasks.
- The overall band is the average of the 4 sections, rounded to the nearest 0.5 and shown with its CEFR level (4.0 = B2).
- If AI rating fails, the learner still sees the objective scores and can ask for the rating to run again.

---

## 4. Sign-up, login and sessions

![Sign-up, login and sessions](04-auth.png)

**Sign up (steps 1–8):**

- The learner sends name, email and password.
- The server applies a rate limit and hashes the password with **scrypt**.
- It creates a _pending_ user and a 6-digit email code. Only an **HMAC of the code** is stored. The code expires in 10 minutes and allows at most 5 tries.
- Gmail SMTP sends the code.
- When the learner enters it, the server marks the code as used, activates the account and starts a session.

**Log in (steps 9–11):**

- The server checks the password hash.
- Unknown emails take the same time as real ones, so attackers cannot discover which emails have accounts.
- A new session cookie is set.

**Every page and API call (steps 12–14):**

- The browser sends the session cookie: `__Host-lafaek_session`, HttpOnly, Secure, valid for 30 days.
- The database stores only the **SHA-256 hash** of the session token. Even someone who reads the database cannot log in as a learner.
- Requests that change data must also come from our own site (same-origin check).
- Forgot password uses the same email-code flow, and logging out revokes the session.

**Signed-in devices:**

- An account can be signed in on **3 devices** at once. A 4th sign-in signs out the device used longest ago, so a new sign-in always works and nobody gets locked out.
- Settings lists each device (for example "Meta Quest browser" or "Chrome on Mac") with when it was last active, a Sign out button for each, and Sign out all other devices.
- Signing in on a headset with a code instead of a password is shown in [diagram 7](#7-sign-in-on-quest-with-a-code).

Rate limits live in PostgreSQL, so they apply across every Vercel instance. Secrets (API keys, database URL, SMTP password, AWS keys) stay on the server and are never sent to the browser.

---

## 5. Database

![Database](05-database.png)

PostgreSQL on Render holds 21 tables, managed with Prisma. They fall into six groups:

| Group                   | Tables                                                                           | Purpose                                                                                                   |
| ----------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| Account & access        | `users`, `sessions`, `auth_otps`, `user_preferences`, `credit_grants`, `device_links` | Accounts, hashed passwords, hashed sessions and email codes, settings, credits (Starter plus Boost Packs), one-time codes for signing in another device |
| Study plan & generation | `study_plans`, `generation_batches`, `generation_jobs`                           | The learner's plan and the **job queue** the worker reads                                                 |
| Practice content        | `practice_items`, `media_assets`, `vocabulary_words`                             | Each learner's own questions, their pictures and audio (stored as S3 keys), and vocabulary                |
| Learning progress       | `practice_attempts`, `practice_drafts`, `practice_resets`, `vocabulary_progress` | Answers, scores and AI feedback, unsent drafts, per-task resets, known and review words                   |
| Mock test               | `mock_test_results`, `certificates`                                              | The signed test form, bands per section, and certificates with a public code                              |
| Usage & system          | `usage_events`, `rate_limits`, `admin_audit_events`                              | AI cost tracking, rate limiting, admin actions                                                            |

The tables connect like this:

- Every `user_id` points to `users.id`.
- Deleting an account deletes the learner's rows. A `delete_user_assets` job removes their files from S3. `usage_events` keep the cost history without the user.
- `generation_jobs` is both a record and the queue. The worker claims rows under a lock and holds a lease (`lease_owner`, `lease_expires_at`) while it works.
- Media files are never stored in the database, only their S3 object key.
- `device_links` rows live for minutes and hold only hashes; the worker deletes them a day after they expire.

---

## 6. VR Study Room on Meta Quest

![VR Study Room on Meta Quest](06-vr-room.png)

The VR Study Room is a seated virtual classroom inspired by Timor-Leste, with views of Dili through its windows. It is built with **IWSDK** (Meta's Immersive Web SDK, on Three.js) and runs in the **Meta Quest Browser** with WebXR, so there is nothing to install.

**Getting in (panel 1):**

1. The learner opens `lafaektoefl.tech/vr` in the Quest Browser. The page checks that the browser can start immersive VR.
2. If they are signed out, they sign in with a code instead of typing an email and password on the headset (see [diagram 7](#7-sign-in-on-quest-with-a-code)).
   Or they choose **Try the demo, no account**: `POST /api/auth/guest` creates a temporary guest user and signs it in. A guest sees a read-only view of one demo account's questions (`DEMO_CONTENT_EMAIL`), keeps its own answers, has daily limits on spoken answers and AI scores, is signed out when it leaves the VR area, and is deleted by the worker after 48 hours.
3. The room needs a study plan, because it uses the learner's own practice questions (a guest uses the demo questions instead).
4. `/vr/room` is a static build served by Vercel next to the web app. A welcome card offers a short spoken introduction, then **Enter VR** starts a WebXR session with hand tracking. A short tutorial shows how to use your hands, and Recenter fits the desk to a seated learner.

**Inside the room (panel 2):** 4 zones hold 9 of the 12 TOEFL tasks:

| Zone      | Activities                                                                                        |
| --------- | ------------------------------------------------------------------------------------------------- |
| Reading   | Read in Daily Life, Read an Academic Passage                                                      |
| Listening | Listen and Choose a Response, Listen to a Conversation, Listen to an Announcement, Listen to an Academic Talk |
| Speaking  | Listen and Repeat, Take an Interview                                                              |
| Writing   | Build a Sentence, with 3D word tiles                                                              |

Write an Email and Write for an Academic Discussion are typing tasks, so they stay on the website. A dock just above the desk has Back (Exit to 2D in the hub), How to use, Recenter and Music on / off. Behind the learner, a progress wall shows their bands, accuracy, study days, mock-test band and certificate.

- **Characters.** Listening uses a cast of ten 3D people (students, a librarian, campus staff, an older man with a *tais*, professors, an announcer), picked for each question by the voice's gender, the scene and the title. The interviewer is Lafaek, a 3D crocodile. They are static glTF models: a vertex shader opens the jaw by the loudness of the voice and turns the forearms while a character speaks, so no skeleton or animation data is needed.
- **Continue where you stopped.** Each activity opens at the first unanswered question and shows a live progress bar, from the same saved answers as the website. Start over calls the website's reset route.

**Hands only, no controllers (panel 3):**

- **Point and pinch:** a ray from the hand picks far cards and answers. Like Quest's own menus, it acts when the fingers part, so sliding off a button cancels it.
- **Pinch and hold to grab:** pick up a word tile in Build a Sentence, move your hand and let go over a slot. Pinching a tile once also sends it to the next free slot.
- **Touch:** the dock floats within arm's reach, so its buttons can be pressed with a finger. They also accept a pinch from a distance and a pinch with the hand right next to the button.
- Buttons that play media stay off until their picture or audio has loaded. Controllers also work, but nothing needs them.

**What each activity calls (bottom):** the room uses the **same API routes and session cookie as the website**, so practice in VR counts in the learner's progress.

- Reading, Build a Sentence and Listening load questions from `/api/practice/{task}/items` and send answers to `/api/practice/items/{id}/submit`, where they are checked and saved.
- Pictures and audio come from S3 through `/api/media/{id}/file`. In Listening, each voice comes from where that speaker stands in the room (spatial audio).
- Listen and Repeat and Take an Interview record the headset microphone and turn the recording into 16 kHz WAV in the headset. `/api/practice/items/{id}/speaking` transcribes it with `muse-voice-transcribe-1.0`. For the interview, `/api/practice/items/{id}/feedback` has `muse-spark-1.3` give a band from 1 to 6 with coaching.
- The progress wall reads `/api/progress` and `/api/mock-test/latest` each time the learner returns to the hub.
- Start over in an activity calls `POST /api/practice/{task}/reset`, the same route as the website.

**Proof in the logs.** Every Meta API call writes a `meta.api.call` line to the server logs: Meta's host and endpoint, the model, Meta's request or session id, the time, the tokens, a short preview of Meta's answer, and where it came from (`client: "vr-room"`, `"web"` or `"worker"`). This is a real production log from an interview answer in the room: Muse Spark returned the band and coaching.

![Vercel log of a muse-spark-1.3 call from the VR room, with the band and coaching in the response](../vr/images/log-feedback.webp)

More examples, including the transcription, are in the [VR Study Room guide](../vr/README.md#proof-the-headset-really-calls-metas-ai).

The room is drawn from simple shapes and small painted textures (wood, walls, soft shadows and sunlight are textures, not real-time lighting), and each character is about 15,000 to 20,000 triangles with only two on screen at once. The target is 72 fps or more on Quest; adding `?fps=1` to the room's URL shows a frame-rate readout for testing.

---

## 7. Sign in on Quest with a code

![Sign in on Quest with a code](07-device-sign-in.png)

Typing an email and password with a laser pointer is slow, so a learner can sign the headset in from a device where they are already signed in:

1. **Show a code (steps 1–3).** On their phone or laptop, the learner opens the VR page and taps **Sign in on Quest**. The server makes an 8-character code such as `K7QM-3XPA`, with a QR code, and stores only an **HMAC** of it. It expires in 5 minutes, and making a new code cancels the old one.
2. **Enter it on the Quest (steps 4–6).** On the Quest, the learner opens `lafaektoefl.tech/link` and types the code; a phone or tablet can scan the QR code instead. This only **claims** the code: the first device to enter it gets a secret that only it holds, and nothing is signed in yet.
3. **Approve (steps 7–10).** The phone or laptop checks every 2 seconds and then shows **"Meta Quest browser wants to sign in"** with **Approve** and **Deny**. The learner taps Approve. Deny, or closing the window, cancels it.
4. **The Quest signs itself in (steps 11–13).** The Quest has been checking every 2 seconds with its secret. Once the code is approved, the server uses it up, creates a normal session (the same cookie as a password sign-in) and opens `/vr`. If this is the account's 4th device, the one used longest ago is signed out.

**Why it is safe:**

- Nothing signs in without the learner's tap on Approve, so a code that someone sees or guesses is useless.
- A code works once, for one device, for a few minutes, and the database stores only its hash.
- Guesses are rate limited per IP address.
- Codes leave out look-alike characters (I, L, O, 0 and 1), so they are easy to read on one screen and type on another.

