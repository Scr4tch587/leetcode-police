# Deployment guide

See the main [README](../README.md) for full setup. Quick checklist:

## 1. Configure secrets & params

```bash
cp functions/.env.example functions/.env
# Edit TIMEZONE, TWILIO_ACCOUNT_SID, TWILIO_FROM_NUMBER

firebase functions:secrets:set TWILIO_AUTH_TOKEN
```

## 2. Deploy backend

```bash
cd functions && npm ci && npm run build
firebase deploy --only firestore,functions --project <PROJECT_ID>
```

## 3. Enable Google Sign-In

Firebase Console → Authentication → Sign-in method → Google.

Add your GitHub Pages hostname under Authorized domains.

## 4. Deploy frontend

Set GitHub Actions secrets (`VITE_FIREBASE_*`, `VITE_FUNCTIONS_REGION`) and push to `main`, or:

```bash
cd web && npm ci && npm run build
# upload dist/ to GitHub Pages
```

## 5. Post-migration cleanup

If upgrading from the screenshot/OCR version, delete unused functions in Google Cloud Console:

- `twilioWebhook`
- `midnightRollover`
- `reminders`

New function names: `submissionCollector`, `dailyProcessor`, `reminderJob`, `dailySummaryJob`, `biweeklySummaryJob`.
