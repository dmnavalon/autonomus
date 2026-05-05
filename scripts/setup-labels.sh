#!/usr/bin/env bash
# Idempotent: creates or updates all labels used by the Autonomus state machine.
# Requires: gh CLI authenticated against dmnavalon/autonomus.
# Usage: ./scripts/setup-labels.sh [owner/repo]
set -euo pipefail

REPO="${1:-dmnavalon/autonomus}"

# Format: name|color|description
LABELS=(
  # State machine
  "state:received|0E8A16|Job recibido, pendiente de clasificación"
  "state:classifying|FBCA04|Clasificación en curso"
  "state:planning|FBCA04|Planificación + arquitectura en curso"
  "state:coding|FBCA04|Programador trabajando"
  "state:pr-created|1D76DB|PR abierto, esperando Vercel Preview"
  "state:waiting-preview|1D76DB|Esperando deployment_status de Vercel"
  "state:preview-ready|1D76DB|Vercel Preview disponible"
  "state:qa-planning|FBCA04|QA Planner generando tests"
  "state:qa-running|FBCA04|Playwright en ejecución"
  "state:qa-failed|D93F0B|QA falló, esperando análisis"
  "state:repairing|D93F0B|Reparador trabajando"
  "state:retesting|FBCA04|Re-ejecución de QA tras reparación"
  "state:auto-approved|0E8A16|QA automático aprobado"
  "state:human-review-required|0E8A16|Listo para revisión humana"
  "state:failed-needs-human|B60205|Fábrica detuvo el flujo, requiere humano"
  "state:cancelled|6A737D|Cancelado por humano"

  # Type
  "type:software_nuevo|5319E7|Nueva aplicación"
  "type:feature|5319E7|Nueva feature en app existente"
  "type:bug|5319E7|Bug en app existente"
  "type:cambio_visual|5319E7|Cambio visual / copy / asset"
  "type:qa_only|5319E7|Solo QA, sin cambios"
  "type:refactor|5319E7|Refactor sin cambio de comportamiento"
  "type:pregunta|5319E7|Pregunta del usuario"
  "type:desconocido|5319E7|Tipo no identificado"

  # Repair counter
  "repair:1|FBCA04|Intento de reparación 1/5"
  "repair:2|FBCA04|Intento de reparación 2/5"
  "repair:3|FBCA04|Intento de reparación 3/5"
  "repair:4|FBCA04|Intento de reparación 4/5"
  "repair:5|D93F0B|Intento de reparación 5/5 (último)"

  # Cost guardrails
  "cost:warning|FBCA04|Job alcanzó 70% del cap de costo"
  "cost:over-budget|D93F0B|Job superó el cap de costo, detenido"

  # Source
  "source:telegram|C5DEF5|Job creado por webhook de Telegram"
  "source:manual|C5DEF5|Job creado manualmente"
)

echo "Setting up labels in $REPO..."
for entry in "${LABELS[@]}"; do
  IFS='|' read -r name color description <<<"$entry"
  if gh label create "$name" -R "$REPO" --color "$color" --description "$description" 2>/dev/null; then
    echo "  + $name"
  else
    gh label edit "$name" -R "$REPO" --color "$color" --description "$description" >/dev/null
    echo "  ~ $name (updated)"
  fi
done
echo "Done."
