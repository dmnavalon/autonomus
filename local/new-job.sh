#!/bin/zsh
# Crea un job para la fábrica local: ./new-job.sh <app_slug> "texto de la tarea"
# Desde Cowork basta pedir: "crea un job para fechit: <tarea>" y Claude usa este script.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SLUG="${1:?uso: new-job.sh <app_slug> \"texto\"}"
shift
TEXT="$*"
[ -z "$TEXT" ] && { echo "falta el texto de la tarea" >&2; exit 2; }

FACTORY_REPO="dmnavalon/autonomus"
export GH_TOKEN="$(gh auth token -u dmnavalon)"

TITLE=$(printf '%s' "$TEXT" | head -c 60)
URL=$(gh issue create -R "$FACTORY_REPO" \
  --title "$TITLE" \
  --label "state:received" --label "source:cowork" \
  --body "## Solicitud original

> $TEXT

## Metadata

- chat_id: \`0\`
- username: \`cowork\`
- app_slug: \`$SLUG\`
- source: \`cowork-local\`")
echo "$URL"
