# Banking & penalties — worked example

A **banked problem** is an extra valid **new** problem solved beyond the daily
requirement. Banked problems automatically cover future missed days before any
penalty is applied.

## Rules

- First valid **new** problem of the day → satisfies the day (`solvedToday`).
- **2nd+ problem on the same calendar day** (on ingest, **today only**): `bankedProblems += 1`.
- At **midnight** for **yesterday** with **N** submissions:
  `bankedProblems += max(0, N - 1 - extrasAlreadyBanked)`.
- **Historical backfill** (older LeetCode dates): recorded for history/grid only — **no banking**.
- At midnight, for a day with **N = 0**:
  - `bankedProblems > 0` → `bankedProblems -= 1`, mark `bankUsed`. No penalty.
  - otherwise → `wordPenalty += 2`, mark `penaltyApplied`.

Each `platform + problemId` counts at most once per user (idempotent submission docs).

**"New" in admin sync messages** means a problem was **written to Firestore for the first time**
on that run (first time you've AC'd that problem on that platform). It is not "accepted in the
last N minutes" — a submission from 10 minutes ago still ingests if we have never recorded that
`titleSlug` / problem id before.

## Example

**Day 1** — user solves 2 valid new problems (synced from APIs).
- Midnight: N = 2 → day complete, `bankedProblems += 1`.
- State: `solvedToday = true`, `bankedProblems = 1`.

**Day 2** — user solves nothing.
- Midnight: N = 0, bank available → consume one.
- State: `bankedProblems = 0`, `bankUsed = true`, **no penalty**.

**Day 3** — user solves nothing.
- Midnight: N = 0, no bank.
- State: `wordPenalty += 2`, `penaltyApplied = true`.

## Where this lives in code

- Ingestion: `functions/src/lib/submissions.ts` → `ingestSubmission`
- Collector: `functions/src/submissionCollector.ts`
- Midnight: `functions/src/lib/game.ts` → `resolveUserDay` (`dailyProcessor.ts`)
- Historical close (no bank): `closeHistoricalDays` after sync
