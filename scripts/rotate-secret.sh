#!/usr/bin/env bash
# Script to safely rotate APP_SECRET with zero-downtime grace period

set -e

if [ -z "$1" ]; then
  echo "Usage: ./scripts/rotate-secret.sh <NEW_SECRET> [OLD_SECRET_FOR_GRACE_PERIOD]"
  echo "Example (grace period): ./scripts/rotate-secret.sh 'new_secret_123' 'old_secret_456'"
  echo "Example (cutover):      ./scripts/rotate-secret.sh 'new_secret_123'"
  exit 1
fi

NEW_SECRET="$1"
OLD_SECRET="$2"

if [ -n "$OLD_SECRET" ]; then
  COMBINED_SECRET="${NEW_SECRET},${OLD_SECRET}"
  echo "Setting grace period secrets (new and old allowed): ${COMBINED_SECRET}"
  npx supabase secrets set APP_SECRET="${COMBINED_SECRET}"
else
  echo "Setting single new secret: ${NEW_SECRET}"
  npx supabase secrets set APP_SECRET="${NEW_SECRET}"
fi

echo "Updating app/.env with new secret..."
sed -i "s/^EXPO_PUBLIC_APP_SECRET=.*/EXPO_PUBLIC_APP_SECRET=${NEW_SECRET}/" app/.env 2>/dev/null || true

echo "APP_SECRET rotation complete."
