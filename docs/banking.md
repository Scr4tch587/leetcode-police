# Banking & penalties — worked example

A **banked problem** is simply an extra valid problem solved beyond the daily
requirement. Banked problems automatically cover future missed days before any
penalty is applied.

## Rules

- First valid **new** problem of the day → satisfies the day.
- Each additional valid **new** problem that day → `bankedProblems += 1`.
- At the local midnight rollover, for a day that is **not** satisfied:
  - `bankedProblems > 0` → `bankedProblems -= 1`, mark `bankUsed`. No penalty.
  - otherwise → `wordPenalty += 2`, mark `penaltyApplied`.

## Example

**Day 1** — user solves 2 valid new problems.
- 1st problem satisfies Day 1.
- 2nd problem is banked.
- State: `satisfied = true`, `bankedProblems = 1`.

**Day 2** — user submits nothing.
- At midnight: not satisfied, bank available → consume one.
- State: `bankedProblems = 0`, `bankUsed = true`, **no penalty**.

**Day 3** — user submits nothing.
- At midnight: not satisfied, no bank.
- State: `wordPenalty += 2`, `penaltyApplied = true`.

## Where this lives in code

- Submission-time logic: `functions/src/lib/game.ts` → `applyAcceptedSubmission`.
- Midnight resolution: `functions/src/lib/game.ts` → `resolveUserDay`, invoked by
  `functions/src/handlers/scheduled.ts` → `midnightRollover`.

Both run inside Firestore transactions so concurrent submissions and the
midnight job cannot corrupt the bank/penalty counts.
