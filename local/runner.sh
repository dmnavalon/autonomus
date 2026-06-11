#!/bin/zsh
# Autonomus Local — runner. Lo invoca launchd cada N minutos.
# Toma el issue más antiguo en state:received y lo procesa con `claude` headless
# (suscripción, no API). Un job por tick; lock para no solaparse.
set -uo pipefail
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

SCRIPT_DIR="${0:A:h}"
BASE="$HOME/.autonomus-local"
FACTORY_REPO="dmnavalon/autonomus"
DEV_PORT="${AUTONOMUS_DEV_PORT:-4123}"
MODEL="${AUTONOMUS_MODEL:-sonnet}"
MAX_JOB_SECS="${AUTONOMUS_MAX_JOB_SECS:-2700}"   # 45 min, como el workflow cloud

mkdir -p "$BASE"/{locks,logs,workspaces,env}

# ---- lock atómico (mkdir) con detección de lock muerto -----------------------
LOCK="$BASE/locks/runner.lock.d"
if ! mkdir "$LOCK" 2>/dev/null; then
  oldpid=$(cat "$LOCK/pid" 2>/dev/null || echo "")
  if [ -n "$oldpid" ] && kill -0 "$oldpid" 2>/dev/null; then
    exit 0  # hay un job corriendo; este tick no hace nada
  fi
  rm -rf "$LOCK"
  mkdir "$LOCK" 2>/dev/null || exit 0
fi
echo $$ > "$LOCK/pid"
trap 'rm -rf "$LOCK"' EXIT

# ---- auth -------------------------------------------------------------------
export GH_TOKEN="$(gh auth token -u dmnavalon 2>/dev/null || true)"
if [ -z "$GH_TOKEN" ]; then
  echo "$(date '+%F %T') sin token gh (cuenta dmnavalon)" >> "$BASE/logs/runner.log"
  exit 0
fi

# ---- ¿hay trabajo? (el poll no gasta nada de Claude) -------------------------
ISSUE=$(gh issue list -R "$FACTORY_REPO" --label "state:received" --state open \
  --json number --jq 'sort_by(.number) | .[0].number // empty' --limit 50 2>/dev/null || true)
[ -z "$ISSUE" ] && exit 0

BODY=$(gh issue view "$ISSUE" -R "$FACTORY_REPO" --json body --jq .body)
SLUG=$(printf '%s' "$BODY" | sed -n 's/.*app_slug: `\([^`]*\)`.*/\1/p' | head -1)

fail_job() {
  gh issue comment "$ISSUE" -R "$FACTORY_REPO" --body "> ⚠️ Autonomus Local: $1. Marcando failed-needs-human." || true
  gh issue edit "$ISSUE" -R "$FACTORY_REPO" --remove-label "state:received" --remove-label "state:classifying" \
    --add-label "state:failed-needs-human" 2>/dev/null || true
  osascript -e "display notification \"$1\" with title \"Autonomus Local\" subtitle \"Job #$ISSUE falló\" sound name \"Basso\"" || true
}

if [ -z "$SLUG" ]; then fail_job "el issue no declara app_slug"; exit 0; fi

# Registry vía API (el runner vive fuera del repo: launchd no puede leer ~/Desktop por TCC)
APP_REPO=$(gh api "repos/$FACTORY_REPO/contents/registry/apps.json" --jq '.content' 2>/dev/null \
  | base64 -d | jq -r --arg s "$SLUG" '.apps[] | select(.slug==$s) | .repo' 2>/dev/null || true)
if [ -z "$APP_REPO" ] || [ "$APP_REPO" = "null" ]; then fail_job "app_slug \`$SLUG\` no está en registry/apps.json"; exit 0; fi

# ---- workspace dedicado (clone aparte, nunca tu copia de trabajo) ------------
WORKSPACE="$BASE/workspaces/$SLUG"
if [ ! -d "$WORKSPACE/.git" ]; then
  gh repo clone "$APP_REPO" "$WORKSPACE" -- --quiet || { fail_job "no pude clonar $APP_REPO"; exit 0; }
fi
cd "$WORKSPACE"
git fetch origin --prune --quiet
git checkout -f main --quiet
git reset --hard origin/main --quiet
git clean -fd --quiet
# settings de permisos para la sesión headless + exclusión local (no se commitea)
mkdir -p .claude
cp -f "$SCRIPT_DIR/workspace-settings.json" .claude/settings.json
grep -q '^\.claude/$' .git/info/exclude 2>/dev/null || echo ".claude/" >> .git/info/exclude
# seed de env vars locales si la app lo necesita (nunca se commitea: gitignored)
if [ ! -f ".env.local" ] && [ -f "$BASE/env/$SLUG.env.local" ]; then
  cp "$BASE/env/$SLUG.env.local" .env.local
fi

# ---- marca el job como tomado (evita re-pick si esta sesión muere temprano) --
gh issue edit "$ISSUE" -R "$FACTORY_REPO" --remove-label "state:received" --add-label "state:classifying" || true

# ---- lanza claude headless ----------------------------------------------------
LOG="$BASE/logs/job-$ISSUE-$(date '+%Y%m%d-%H%M%S').log"
PROMPT="$(cat "$SCRIPT_DIR/runbook.md")

---
JOB ASIGNADO AHORA:
- ISSUE: $ISSUE
- FACTORY_REPO: $FACTORY_REPO
- APP_SLUG: $SLUG
- APP_REPO: $APP_REPO
- WORKSPACE: $WORKSPACE
- QA_DIR: $BASE/qa
- DEV_PORT: $DEV_PORT
"

echo "$(date '+%F %T') job #$ISSUE ($SLUG) → claude -p [$MODEL] log=$LOG" >> "$BASE/logs/runner.log"
claude -p "$PROMPT" --model "$MODEL" --permission-mode acceptEdits >> "$LOG" 2>&1 &
CLAUDE_PID=$!

# ---- watchdog -----------------------------------------------------------------
SECS=0
while kill -0 "$CLAUDE_PID" 2>/dev/null && [ "$SECS" -lt "$MAX_JOB_SECS" ]; do
  sleep 30; SECS=$((SECS + 30))
done
if kill -0 "$CLAUDE_PID" 2>/dev/null; then
  kill -TERM "$CLAUDE_PID" 2>/dev/null; sleep 5; kill -KILL "$CLAUDE_PID" 2>/dev/null || true
  lsof -ti:"$DEV_PORT" | xargs kill -9 2>/dev/null || true
  fail_job "timeout de ${MAX_JOB_SECS}s procesando el job"
  echo "$(date '+%F %T') job #$ISSUE TIMEOUT" >> "$BASE/logs/runner.log"
  exit 0
fi
# higiene post-job: nunca dejar un dev server colgado aunque el runbook fallara en matarlo
lsof -ti:"$DEV_PORT" | xargs kill -9 2>/dev/null || true
echo "$(date '+%F %T') job #$ISSUE terminado (exit claude ok)" >> "$BASE/logs/runner.log"
