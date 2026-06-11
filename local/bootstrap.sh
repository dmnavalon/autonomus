#!/bin/zsh
# Setup one-time de Autonomus Local. Idempotente: se puede correr de nuevo sin daño.
set -euo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="${0:A:h}"
BASE="$HOME/.autonomus-local"
FACTORY_REPO="dmnavalon/autonomus"

echo "→ directorios"
mkdir -p "$BASE"/{locks,logs,workspaces,env,bin}

echo "→ permisos de ejecución"
chmod +x "$SCRIPT_DIR"/runner.sh "$SCRIPT_DIR"/new-job.sh "$SCRIPT_DIR"/bootstrap.sh

echo "→ instalando runner fuera de ~/Desktop (launchd no puede leer Desktop por TCC)"
cp -f "$SCRIPT_DIR/runner.sh" "$BASE/bin/runner.sh"
cp -f "$SCRIPT_DIR/runbook.md" "$BASE/bin/runbook.md"
cp -f "$SCRIPT_DIR/workspace-settings.json" "$BASE/bin/workspace-settings.json"
chmod +x "$BASE/bin/runner.sh"

echo "→ harness QA (Playwright + chromium)"
mkdir -p "$BASE/qa/e2e"
cp -f "$SCRIPT_DIR/qa/package.json" "$BASE/qa/package.json"
cp -f "$SCRIPT_DIR/qa/playwright.config.ts" "$BASE/qa/playwright.config.ts"
(cd "$BASE/qa" && npm install --silent && npx playwright install chromium)

echo "→ seed de env vars de fechit (si existe la copia de trabajo)"
FECHIT_ENV="$HOME/Desktop/Desarrollos DMN/Fechit/.env.local"
[ -f "$FECHIT_ENV" ] && cp -f "$FECHIT_ENV" "$BASE/env/fechit.env.local" && echo "   fechit.env.local sembrado"

export GH_TOKEN="$(gh auth token -u dmnavalon)"

echo "→ label source:cowork"
gh label create "source:cowork" -R "$FACTORY_REPO" --color "5319E7" \
  --description "Job creado desde Claude Cowork / new-job.sh" 2>/dev/null || echo "   (ya existía)"

echo "→ desactivando el orchestrator cloud (para no procesar doble ni gastar gateway)"
gh workflow disable "Orchestrator" -R "$FACTORY_REPO" 2>/dev/null || echo "   (ya estaba desactivado)"

echo "→ launchd"
PLIST_DST="$HOME/Library/LaunchAgents/com.autonomus.local.plist"
cp -f "$SCRIPT_DIR/com.autonomus.local.plist" "$PLIST_DST"
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"
echo "   cargado: corre cada 5 min (launchctl list | grep autonomus)"

echo "✓ Autonomus Local listo. Crea un job con: $SCRIPT_DIR/new-job.sh fechit \"tu tarea\""
