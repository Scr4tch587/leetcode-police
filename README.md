# 🏆 Problem Club

A fully serverless web app for a group of friends who commit to solving **one
new LeetCode or Codeforces problem per day**. You submit proof by texting a
screenshot to a Twilio number; the system runs OCR, validates the problem,
tracks submissions, sends reminders, applies penalties, and lets you **bank**
extra problems to cover future missed days.

- **Frontend:** React + TypeScript + Vite → GitHub Pages
- **Backend:** Firebase Cloud Functions (2nd gen), Firestore, Firebase Scheduler
- **Auth:** Firebase Authentication (Google Sign-In)
- **Messaging:** Twilio SMS/MMS
- **OCR:** Tesseract.js
- **Platforms:** LeetCode, Codeforces (extensible)

---

## How the game works

- Each day, every user must complete **one new problem**.
- The **first** valid new problem each day satisfies the requirement.
- Each **additional** valid new problem that day is **banked** (`bankedProblems += 1`).
- At midnight (local time), for each user:
  - **Satisfied** → nothing happens.
  - **Not satisfied but bank > 0** → consume one banked problem (no penalty).
  - **Not satisfied and bank = 0** → **+2 penalty words**.
- A problem already solved by that user (tracked in `problemHistory`) does **not**
  count — it is flagged for manual admin review.

See the worked banking example in [`docs/banking.md`](docs/banking.md).

---

## Repository layout

```
.
├── firebase.json            # Firebase project config (functions, firestore, storage, emulators)
├── .firebaserc              # Default project alias
├── firestore.rules          # Firestore security rules (group-scoped access)
├── firestore.indexes.json   # Composite indexes
├── storage.rules            # Storage rules (screenshots served via signed URLs)
├── scripts/setup.sh         # One-shot IAC: enable APIs, create DB, deploy
├── functions/               # Cloud Functions (TypeScript)
│   └── src/
│       ├── index.ts         # Exports all deployable functions
│       ├── config.ts        # Params & secrets (region, timezone, Twilio)
│       ├── types.ts         # Domain model
│       ├── platforms/       # Pluggable platform detectors (leetcode, codeforces)
│       ├── lib/             # admin, ocr, twilio, storage, dates, game, summary
│       └── handlers/        # twilioWebhook, scheduled, account, admin
└── web/                     # React frontend (Vite)
    └── src/
        ├── firebase.ts      # SDK init + emulator wiring
        ├── api.ts           # Typed callable wrappers
        ├── contexts/        # AuthContext
        ├── hooks/           # Realtime Firestore subscriptions
        ├── pages/           # Login, GroupSetup, Dashboard, History, Admin, Profile
        └── components/      # NavBar, UI primitives
```

---

## Data model (Firestore)

| Collection       | Doc id                                  | Notes |
|------------------|-----------------------------------------|-------|
| `users`          | Firebase Auth UID                       | profile, `groupId`, `wordPenalty`, `bankedProblems`, `isAdmin` |
| `groups`         | auto                                    | `name`, `inviteCode`, `timezone`, `createdBy` |
| `submissions`    | auto                                    | one per inbound text; `platform`, `problemIdentifier`, `validationStatus`, `screenshotUrl`, `date` |
| `problemHistory` | `${userId}_${platform}_${id}`           | first time a user solved a problem (duplicate detection) |
| `dailyStatus`    | `${userId}_${date}`                     | `satisfied`, `bankUsed`, `penaltyApplied`, `submissionCount` |
| `meta`           | `biweekly_${groupId}`                   | bookkeeping for the 14-day summary |

> **Security model:** all game-state writes happen inside Cloud Functions
> (admin SDK, which bypasses rules). The Firestore rules only govern *direct
> client access* and restrict every read to the caller's own group. Clients can
> never mutate penalties, banks, submissions or statuses directly.

---

## Prerequisites

- Node.js 20+
- A Firebase project on the **Blaze (pay-as-you-go)** plan (required for Cloud
  Functions, outbound network, and Cloud Scheduler).
- The Firebase CLI: `npm i -g firebase-tools` then `firebase login`.
- The `gcloud` CLI (for `scripts/setup.sh`): `gcloud auth login`.
- A Twilio account with an SMS/MMS-capable phone number.

---

## Local development

### 1. Install

```bash
cd functions && npm install && cd ..
cd web && npm install && cd ..
```

### 2. Configure

```bash
cp functions/.env.example functions/.env     # set TIMEZONE, TWILIO_* (non-secret)
cp web/.env.example web/.env.local            # set VITE_FIREBASE_* + VITE_USE_EMULATORS=true
```

Get the web SDK config with `firebase apps:sdkconfig web`.

### 3. Run the emulators + frontend

```bash
# Terminal 1 — Firebase emulators (auth, firestore, functions, storage)
cd functions && npm run serve

# Terminal 2 — Vite dev server
cd web && npm run dev
```

Set `VITE_USE_EMULATORS=true` in `web/.env.local` so the frontend talks to the
local emulators. The Emulator UI is at http://127.0.0.1:4000.

### Testing the Twilio webhook locally

With `VALIDATE_TWILIO_SIGNATURE=false` in `functions/.env`, POST a fake message
to the local function (use a real, publicly-reachable `MediaUrl0` for OCR, or
adapt `downloadTwilioMedia` to read a local file):

```bash
curl -X POST "http://127.0.0.1:5001/<PROJECT_ID>/us-central1/twilioWebhook" \
  --data-urlencode "From=+15195551234" \
  --data-urlencode "NumMedia=1" \
  --data-urlencode "MediaUrl0=https://example.com/accepted.png" \
  --data-urlencode "MediaContentType0=image/png"
```

Use the Firestore emulator UI to create a `users` doc whose `phoneNumber`
matches `From`.

---

## Deployment

### A. Provision everything (one command)

```bash
PROJECT_ID=<your-project-id> \
TWILIO_AUTH_TOKEN=<your-twilio-token> \
./scripts/setup.sh
```

This enables all APIs, creates the Firestore DB and Storage bucket, registers a
web app, stores the Twilio secret, and deploys rules + functions. The script
prints your web SDK config and the webhook URL at the end.

### B. The one manual console step

Programmatically enabling Google Sign-In requires an OAuth client, so do this
once in the console:

1. **Firebase Console → Authentication → Sign-in method → enable _Google_.**
2. **Authentication → Settings → Authorized domains →** add your GitHub Pages
   domain, e.g. `your-username.github.io`.

### C. Point Twilio at the webhook

In the Twilio console, set your number's **Messaging → "A message comes in"**
webhook to **HTTP POST**:

```
https://us-central1-<PROJECT_ID>.cloudfunctions.net/twilioWebhook
```

### D. Deploy the frontend to GitHub Pages

The workflow [`.github/workflows/deploy-web.yml`](.github/workflows/deploy-web.yml)
builds and deploys `web/` on every push to `main`.

1. **GitHub repo → Settings → Pages → Source: GitHub Actions.**
2. **Settings → Secrets and variables → Actions →** add:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`,
   `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_STORAGE_BUCKET`,
   `VITE_FIREBASE_MESSAGING_SENDER_ID`, `VITE_FIREBASE_APP_ID`,
   `VITE_FUNCTIONS_REGION` (`us-central1`), and optionally `VITE_TWILIO_NUMBER`.
3. Push to `main` (or run the workflow manually).

The app is served at `https://<user>.github.io/<repo>/` (HashRouter is used so
client-side routing works without server config; a `404.html` fallback is also
emitted).

### E. (Optional) CI deploy of Functions

[`.github/workflows/deploy-firebase.yml`](.github/workflows/deploy-firebase.yml)
deploys functions/rules/indexes on push. Add secrets `FIREBASE_PROJECT_ID` and
`FIREBASE_SERVICE_ACCOUNT` (a service-account JSON key with roles: Firebase
Admin, Cloud Functions Admin, Service Account User, Cloud Scheduler Admin,
Secret Manager Admin, Storage Admin).

---

## Scheduled jobs

Declared with `onSchedule` and provisioned automatically (Cloud Scheduler +
Pub/Sub) on deploy — no manual job creation:

| Function           | Schedule (group timezone) | Purpose |
|--------------------|---------------------------|---------|
| `reminders`        | `0 23 * * *` (11 PM)       | Nudge users who haven't submitted today |
| `midnightRollover` | `5 0 * * *` (12:05 AM)     | Resolve the previous day (bank/penalty) + send daily results SMS |
| `biweeklySummary`  | `0 9 * * *` (daily, gated) | Send a leaderboard summary every 14 days |

> The timezone for all schedules is the `TIMEZONE` param (default
> `America/Toronto`). Per-group timezones are stored on each group and used for
> computing a submission's "day".

---

## Adding a new platform (e.g. AtCoder)

1. Create `functions/src/platforms/atcoder.ts` implementing `PlatformDetector`.
2. Register it in `functions/src/platforms/index.ts`'s `detectors` array.
3. Add the literal to the `Platform` union in both `types.ts` files.

No other code changes are required — detection, banking, history and the UI all
work off the registry.

---

## Notes & trade-offs

- **OCR confidence:** screenshots without a clear "Accepted"/"OK" verdict are
  marked `pending` for manual admin review rather than silently dropped.
- **Duplicate detection** relies on extracting a problem identifier. If none is
  found (e.g. a cropped screenshot), the problem is accepted but no history row
  is written, so a later resubmission can't be auto-flagged — admins can reject.
- **Cold starts:** the webhook downloads the English Tesseract traineddata into
  `/tmp` on first use; it runs with 1 GiB memory and a 120 s timeout.
