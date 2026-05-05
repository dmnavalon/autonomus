#!/usr/bin/env bash
# scripts/setup-vercel-env.sh — set runtime env vars on the Vercel project for
# the telegram-webhook package. Run from the repo root.
#
# - TELEGRAM_WEBHOOK_SECRET is read from .telegram-webhook-secret.local (no retype).
# - TELEGRAM_BOT_TOKEN and GH_AUTOMATION_TOKEN are read silently from stdin.
# - FACTORY_REPO is hardcoded.
#
# Sets each variable for all 3 environments (production, preview, development).
# Re-running is safe: vercel env removes existing then re-adds.

set -euo pipefail

WEBHOOK_DIR="packages/telegram-webhook"
SCOPE="diegomartinez-7745s-projects"
ENVIRONMENTS=("production" "preview" "development")

if [[ ! -d "$WEBHOOK_DIR/.vercel" ]]; then
  echo "Error: $WEBHOOK_DIR is not linked. Run 'vercel link' first." >&2
  exit 1
fi

if [[ ! -f .telegram-webhook-secret.local ]]; then
  echo "Error: .telegram-webhook-secret.local not found. Run setup-secrets.sh first." >&2
  exit 1
fi

read_secret() {
  local __varname="$1"
  local __label="$2"
  local __value
  printf "%s\n  (paste value, press Enter; nothing will be echoed)\n  > " "$__label" >&2
  IFS= read -rs __value
  printf "\n" >&2
  printf -v "$__varname" '%s' "$__value"
}

set_vercel_env() {
  local name="$1"
  local value="$2"
  for env in "${ENVIRONMENTS[@]}"; do
    # Remove existing (ignore errors); then add fresh.
    (cd "$WEBHOOK_DIR" && vercel env rm "$name" "$env" --yes --scope "$SCOPE" 2>/dev/null) || true
    printf '%s' "$value" | (cd "$WEBHOOK_DIR" && vercel env add "$name" "$env" --scope "$SCOPE") >/dev/null
  done
  printf "  ✓ %s set in production+preview+development\n" "$name"
}

trap 'unset -v WH TG GHA 2>/dev/null || true' EXIT INT TERM

echo "Setting Vercel env vars for autonomus-telegram-webhook"
echo

# --- TELEGRAM_WEBHOOK_SECRET from local file (no retype) -----------------
WH="$(cat .telegram-webhook-secret.local)"
set_vercel_env TELEGRAM_WEBHOOK_SECRET "$WH"

# --- The two values that must be re-pasted -------------------------------
read_secret TG  "TELEGRAM_BOT_TOKEN"  && set_vercel_env TELEGRAM_BOT_TOKEN  "$TG"
read_secret GHA "GH_AUTOMATION_TOKEN" && set_vercel_env GH_AUTOMATION_TOKEN "$GHA"

# --- non-secret config ---------------------------------------------------
set_vercel_env FACTORY_REPO "dmnavalon/autonomus"

echo
echo "Verifying env vars on the Vercel project:"
(cd "$WEBHOOK_DIR" && vercel env ls --scope "$SCOPE") | sed 's/^/  /'

echo
echo "Done. Next: vercel deploy --scope $SCOPE (run from $WEBHOOK_DIR)"
