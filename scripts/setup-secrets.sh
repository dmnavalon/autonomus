#!/usr/bin/env bash
# scripts/setup-secrets.sh — set all GitHub Secrets for dmnavalon/autonomus.
#
# Reads each secret from stdin with `read -s` (silent — keystrokes are never
# echoed and never printed to your terminal history). Values are passed to
# `gh secret set` via --body and immediately go out of scope.
#
# Re-running is safe: gh secret set updates the existing secret if present.
#
# Pre-requisites:
#   - gh CLI authenticated as dmnavalon (verify: `gh auth status`)
#   - openssl (for generating TELEGRAM_WEBHOOK_SECRET)
#
# Usage:
#   ./scripts/setup-secrets.sh
#
# Tip: clear bash history of this command afterwards with `history -c` if
# you're paranoid (gh never logs the secret body, only the name).

set -euo pipefail

REPO="dmnavalon/autonomus"

# --- helper: silent read into a local variable ----------------------------
# usage:  read_secret VARNAME "Prompt label"
read_secret() {
  local __varname="$1"
  local __label="$2"
  local __value
  printf "%s\n  (paste value, press Enter; nothing will be echoed)\n  > " "$__label" >&2
  IFS= read -rs __value
  printf "\n" >&2
  if [[ -z "$__value" ]]; then
    printf "  ! empty value, skipping\n" >&2
    return 1
  fi
  printf -v "$__varname" '%s' "$__value"
}

set_secret_silent() {
  local name="$1"
  local value="$2"
  gh secret set "$name" -R "$REPO" --body "$value" >/dev/null
  printf "  ✓ %s set\n" "$name"
}

trap 'unset -v TG AIG VT GHA WH VTI 2>/dev/null || true' EXIT INT TERM

echo "Setting GitHub Secrets in $REPO"
echo

read_secret TG  "TELEGRAM_BOT_TOKEN"      && set_secret_silent TELEGRAM_BOT_TOKEN  "$TG"  || true
read_secret AIG "AI_GATEWAY_API_KEY"      && set_secret_silent AI_GATEWAY_API_KEY  "$AIG" || true
read_secret VT  "VERCEL_TOKEN"            && set_secret_silent VERCEL_TOKEN        "$VT"  || true
read_secret GHA "GH_AUTOMATION_TOKEN"     && set_secret_silent GH_AUTOMATION_TOKEN "$GHA" || true

# --- TELEGRAM_WEBHOOK_SECRET: generate locally, never typed by user -------
echo
echo "Generating TELEGRAM_WEBHOOK_SECRET locally..."
WH="$(openssl rand -hex 32)"
set_secret_silent TELEGRAM_WEBHOOK_SECRET "$WH"
printf "%s" "$WH" > .telegram-webhook-secret.local
chmod 600 .telegram-webhook-secret.local
echo "  ✓ TELEGRAM_WEBHOOK_SECRET written to .telegram-webhook-secret.local (gitignored)"
echo "    Phase 2 will copy this to Vercel env automatically."

# --- VERCEL_TEAM_ID: not secret per se, but lives next to the others ------
echo
read -rp "VERCEL_TEAM_ID (team slug or ID, e.g. 'diegomartinez-7745s-projects'): " VTI
if [[ -n "$VTI" ]]; then
  set_secret_silent VERCEL_TEAM_ID "$VTI"
fi

echo
echo "Verifying secrets in $REPO:"
gh secret list -R "$REPO" | sed 's/^/  /'

echo
echo "Done. Next: Phase 2 (Telegram webhook deploy to Vercel)."
