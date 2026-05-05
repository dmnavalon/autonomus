#!/usr/bin/env bash
# scripts/setup-telegram-webhook.sh — register the Vercel deployment URL with Telegram.
#
# Pulls TELEGRAM_BOT_TOKEN from Vercel env (so the human never re-types it),
# reads TELEGRAM_WEBHOOK_SECRET from .telegram-webhook-secret.local, and POSTs
# to api.telegram.org/bot<token>/setWebhook.
#
# Usage: ./scripts/setup-telegram-webhook.sh [webhook-url]
# Default URL: https://autonomus-telegram-webhook.vercel.app/api/telegram/webhook

set -euo pipefail

WEBHOOK_DIR="packages/telegram-webhook"
SCOPE="diegomartinez-7745s-projects"
URL="${1:-https://autonomus-telegram-webhook.vercel.app/api/telegram/webhook}"

if [[ ! -f .telegram-webhook-secret.local ]]; then
  echo "Error: .telegram-webhook-secret.local missing. Run setup-secrets.sh first." >&2
  exit 1
fi

SECRET="$(cat .telegram-webhook-secret.local)"

TMP="$(mktemp -t autonomus-env.XXXXXX)"
chmod 600 "$TMP"
trap 'rm -f "$TMP" 2>/dev/null || true; unset TG_TOKEN SECRET 2>/dev/null || true' EXIT INT TERM

(cd "$WEBHOOK_DIR" && vercel env pull "$TMP" --environment=production --yes --scope "$SCOPE") >/dev/null 2>&1

TG_TOKEN="$(grep -E '^TELEGRAM_BOT_TOKEN=' "$TMP" | head -n1 | sed -E 's/^TELEGRAM_BOT_TOKEN="?([^"]*)"?$/\1/')"
rm -f "$TMP"

if [[ -z "$TG_TOKEN" ]]; then
  echo "Error: TELEGRAM_BOT_TOKEN not found in Vercel production env." >&2
  exit 1
fi

echo "Setting Telegram webhook to: $URL"
RES="$(curl -sS -X POST \
  "https://api.telegram.org/bot${TG_TOKEN}/setWebhook" \
  -H 'Content-Type: application/json' \
  --data "$(printf '{"url":"%s","secret_token":"%s","drop_pending_updates":true,"allowed_updates":["message"]}' "$URL" "$SECRET")")"

if echo "$RES" | grep -q '"ok":true'; then
  echo "  ✓ Webhook set."
else
  echo "  ! Failed: $RES" >&2
  exit 1
fi

echo
echo "Verifying via getWebhookInfo:"
INFO="$(curl -sS "https://api.telegram.org/bot${TG_TOKEN}/getWebhookInfo")"
unset TG_TOKEN

# Pretty-print without echoing the token (already unset)
if command -v python3 >/dev/null 2>&1; then
  echo "$INFO" | python3 -c 'import sys,json; d=json.load(sys.stdin); print(json.dumps(d, indent=2))' | sed 's/^/  /'
else
  echo "$INFO" | sed 's/^/  /'
fi

echo
echo "Done. Send /start to your bot to receive your chat_id."
