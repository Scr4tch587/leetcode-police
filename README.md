# LeetCode Police

A fully serverless web app for a group of friends who commit to solving **one
new LeetCode or Codeforces problem per day**. Accepted submissions are ingested
automatically from public platform APIs; the system tracks events, applies
banking and penalties at the 4 AM game-day cutoff, and sends optional SMS reminders and summaries.

- **Frontend:** React + TypeScript + Vite → GitHub Pages
- **Backend:** Firebase Cloud Functions (2nd gen), Firestore, Cloud Scheduler
- **Auth:** Firebase Authentication (Google Sign-In)
- **Platforms:** Codeforces API, LeetCode unofficial GraphQL
- **Messaging:** Twilio SMS (reminders + summaries only)

---

## How the game works

- Each day, every user must complete **one new problem** (unique per user lifetime).
- The **submission collector** runs every 30 minutes and records new accepted submissions.
- At **4:00 AM** (group timezone; the game “day” rolls then, not at midnight):
  - **1+ submissions that day** → day complete; extras add to `bankedProblems` (`count - 1`).
  - **0 submissions** and **bank > 0** → consume one bank (no penalty).
  - **0 submissions** and **no bank** → **+2 penalty words**.
- **11 PM** — SMS reminder if not solved today (optional, needs phone on profile).
- **Every 14 days (9 AM)** — **punishment day**: word counts reset to 0; the group admin gets an SMS listing each member's words for that cycle.

See [`docs/banking.md`](docs/banking.md) for a worked example.

---

## Repository layout

```
.
├── firebase.json
├── firestore.rules / firestore.indexes.json
├── functions/src/
│   ├── index.ts
│   ├── submissionCollector.ts   # poll LC + CF every 30 min
│   ├── dailyProcessor.ts          # 4:05 AM bank/penalty
│   ├── reminderJob.ts             # 11 PM SMS
│   ├── summaryJob.ts              # daily + biweekly SMS
│   ├── leetcodeScraper.ts
│   ├── codeforcesClient.ts
│   ├── lib/                       # game, submissions, twilio, dates, summary
│   └── handlers/                  # account, admin callables
└── web/src/                       # React dashboard
```

---

## Data model (Firestore)

| Collection    | Doc id                         | Notes |
|---------------|--------------------------------|-------|
| `users`       | Firebase Auth UID              | handles, `bankedProblems`, `wordPenalty`, `lastProcessedTimestamp` |
| `groups`      | auto                           | `timezone`, `inviteCode` |
| `submissions` | `{userId}_{platform}_{problemId}` | accepted events (source of truth) |
| `dailyStatus` | `{userId}_{date}`              | `solvedToday`, `bankUsed`, `penaltyApplied`, `resolved` |

All game-state writes run in Cloud Functions (admin SDK).

---

## Environment variables

### Cloud Functions (`functions/.env` or Secret Manager)

| Name | Secret? | Purpose |
|------|---------|---------|
| `TIMEZONE` | no | IANA timezone for cron schedules (default `America/Toronto`) |
| `TWILIO_ACCOUNT_SID` | no | Twilio account SID |
| `TWILIO_FROM_NUMBER` | no | E.164 sender for SMS |
| `TWILIO_AUTH_TOKEN` | **yes** | `firebase functions:secrets:set TWILIO_AUTH_TOKEN` |

### Web (`web/.env.local`)

| Name | Purpose |
|------|---------|
| `VITE_FIREBASE_*` | Firebase web SDK config |
| `VITE_FUNCTIONS_REGION` | e.g. `us-central1` |
| `VITE_USE_EMULATORS` | `true` for local dev |

---

## Prerequisites

- Node.js 20+
- Firebase project on **Blaze** plan
- Firebase CLI + (optional) `gcloud` for `scripts/setup.sh`
- Twilio account (optional, for SMS)

---

## Local development

```bash
cd functions && npm install && cd ..
cd web && npm install && cd ..

cp functions/.env.example functions/.env
cp web/.env.example web/.env.local   # VITE_USE_EMULATORS=true
```

```bash
# Terminal 1
cd functions && npm run serve

# Terminal 2
cd web && npm run dev
```

Emulator UI: http://127.0.0.1:4000

---

## Deployment

### Provision (CLI)

```bash
PROJECT_ID=<your-project-id> \
TWILIO_AUTH_TOKEN=<token> \
./scripts/setup.sh
```

### Manual (one-time)

1. Firebase Console → Authentication → enable **Google**.
2. Add GitHub Pages domain under Authorized domains.

### Frontend (GitHub Pages)

Set Actions secrets for `VITE_FIREBASE_*` and deploy via `.github/workflows/deploy-web.yml`.

### Functions

```bash
cd functions && npm run build
firebase deploy --only functions,firestore:indexes,firestore:rules
```

After this refactor, delete obsolete Cloud Functions in the console if deploy warns about renames (`twilioWebhook`, `midnightRollover`, `reminders`).

---

## Scheduled jobs

| Function | Schedule | Purpose |
|----------|----------|---------|
| `submissionCollector` | every 30 min | Ingest CF + LC accepted submissions |
| `dailyProcessor` | `5 0 * * *` | Resolve previous day (bank/penalty) |
| `reminderJob` | `0 23 * * *` | SMS if not solved today |
| `dailySummaryJob` | `10 0 * * *` | Group results SMS |
| `biweeklySummaryJob` | `0 9 * * *` | Punishment day every 14 days: SMS admin word tallies, reset all counts |

Cron timezone is the `TIMEZONE` param. Per-group `timezone` is used when assigning submission dates and game-day resolution (day rolls at 4:00 AM local).

---

## Migration from screenshot/OCR version

- Remove Twilio **Messaging webhook** (no MMS ingestion).
- Users must set **LeetCode username** and/or **Codeforces handle** in Profile.
- Old `submissions` / `problemHistory` docs are not migrated; collector will repopulate new events going forward.
- Redeploy functions so old schedulers are replaced.
