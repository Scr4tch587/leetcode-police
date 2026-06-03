#!/usr/bin/env bash
#
# One-shot infrastructure setup for LeetCode Police.
#
# This script does as much as possible from the CLI so you barely touch the
# Firebase/Google Cloud console. It will:
#   1. Enable every required Google Cloud API.
#   2. Create the Firestore (Native mode) database.
#   3. Ensure the default Cloud Storage bucket exists.
#   4. Register a Firebase Web app (and print its SDK config).
#   5. Store the Twilio auth token in Secret Manager.
#   6. Deploy Firestore/Storage rules, indexes and Cloud Functions.
#
# The ONLY thing that must be done by hand in the console is enabling the
# Google sign-in provider (it requires creating an OAuth client / consent
# screen). See the README — it is a 60-second click-through.
#
# Usage:
#   PROJECT_ID=my-project REGION=us-central1 ./scripts/setup.sh
#
set -euo pipefail

PROJECT_ID="${PROJECT_ID:-}"
REGION="${REGION:-us-central1}"
# Firestore/Storage location (multi-region or region). nam5 = US multi-region.
LOCATION="${LOCATION:-nam5}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: set PROJECT_ID, e.g. PROJECT_ID=leetcode-police ./scripts/setup.sh" >&2
  exit 1
fi

echo "==> Using project: $PROJECT_ID (region: $REGION, location: $LOCATION)"
gcloud config set project "$PROJECT_ID" >/dev/null

echo "==> Enabling Google Cloud APIs…"
gcloud services enable \
  cloudfunctions.googleapis.com \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  artifactregistry.googleapis.com \
  eventarc.googleapis.com \
  pubsub.googleapis.com \
  cloudscheduler.googleapis.com \
  secretmanager.googleapis.com \
  firestore.googleapis.com \
  firebasestorage.googleapis.com \
  storage.googleapis.com \
  identitytoolkit.googleapis.com \
  firebase.googleapis.com

echo "==> Creating Firestore database (Native mode)…"
if ! gcloud firestore databases describe --database="(default)" >/dev/null 2>&1; then
  gcloud firestore databases create --location="$LOCATION" --type=firestore-native
else
  echo "    Firestore database already exists; skipping."
fi

echo "==> Ensuring default Storage bucket exists…"
BUCKET="${PROJECT_ID}.appspot.com"
if ! gcloud storage buckets describe "gs://${BUCKET}" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" --location="$REGION" || \
    echo "    (Bucket may be created automatically by Firebase; continuing.)"
else
  echo "    Bucket gs://${BUCKET} already exists; skipping."
fi

echo "==> Registering a Firebase Web app…"
if ! firebase apps:list WEB --project "$PROJECT_ID" 2>/dev/null | grep -q "leetcode-police-web"; then
  firebase apps:create WEB leetcode-police-web --project "$PROJECT_ID" || true
fi
echo "    Web SDK config (copy into web/.env.local):"
firebase apps:sdkconfig WEB --project "$PROJECT_ID" || true

echo "==> Storing Twilio auth token in Secret Manager…"
if [[ -n "${TWILIO_AUTH_TOKEN:-}" ]]; then
  printf "%s" "$TWILIO_AUTH_TOKEN" | \
    firebase functions:secrets:set TWILIO_AUTH_TOKEN --project "$PROJECT_ID" --data-file=- || \
    echo "    (If this failed, run: firebase functions:secrets:set TWILIO_AUTH_TOKEN)"
else
  echo "    TWILIO_AUTH_TOKEN env var not set — run later:"
  echo "       firebase functions:secrets:set TWILIO_AUTH_TOKEN"
fi

echo "==> Deploying rules, indexes and functions…"
( cd functions && npm ci && npm run build )
firebase deploy --only firestore,storage,functions --project "$PROJECT_ID" --non-interactive

echo ""
echo "============================================================"
echo " Setup complete."
echo ""
echo " MANUAL STEP (one-time, ~1 min):"
echo "   Firebase console > Authentication > Sign-in method >"
echo "   enable 'Google'. Then add your GitHub Pages domain under"
echo "   Authentication > Settings > Authorized domains."
echo ""
echo " Optional: set TWILIO_ACCOUNT_SID and TWILIO_FROM_NUMBER in functions/.env"
echo " for SMS reminders (11 PM) and daily summaries."
echo "============================================================"
