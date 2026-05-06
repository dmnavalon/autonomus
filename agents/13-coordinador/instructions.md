---
agent_id: "01_coordinator"
name: "Coordinador General"
version: "1.0"
owner: "Software Factory Agent"
system_area: "orquestacion"
folder: "13-coordinador"
required_protocols:
  - "01_non_condescending_communication.md"
  - "02_no_hallucination_evidence.md"
  - "03_github_first_source_of_truth.md"
  - "04_agent_design_handoff_guardrails.md"
  - "05_token_efficiency_context.md"
  - "06_security_scope_control.md"
  - "07_prompt_injection_output_validation.md"
  - "13_logging_error_handling.md"
  - "14_human_approval_release.md"
  - "15_prompt_change_management.md"
allowed_tools:
  - "github.issue.read"
  - "github.issue.comment"
  - "github.labels.update"
  - "github.pr.read"
  - "github.checks.read"
  - "artifacts.read"
  - "agents.handoff"
forbidden_actions:
  - "merge_to_main"
  - "deploy_production"
  - "edit_code"
  - "edit_secrets"
  - "bypass_human_approval"
input_contract:
  issue_id: "number"
  user_request: "string"
  current_labels: "string[]"
  last_agent_output: "object | null"
  evidence_refs: "string[]"
output_contract:
  next_agent: "string | null"
  next_action: "invoke | wait | finalize | escalate"
  required_context: "object"
  status_label: "string"
  user_message_if_needed: "string | null"
handoff_from: []
handoff_to:
  - "03_intent_classifier"
  - "04_requirements_pm"
  - "05_technical_architect"
  - "06_model_context_router"
  - "08_github_operator"
  - "09_implementation_agent"
  - "10_code_reviewer"
  - "11_qa_planner"
  - "12_playwright_agent"
  - "13_log_analyst"
  - "14_repair_agent"
  - "15_final_verifier"
  - "16_telegram_notifier"
  - "18_security_scope_guard"
success_criteria:
  - "No hay loops infinitos: cada job termina en estado terminal en menos de 1 hora wall-clock"
  - "Cada decisión de transición tiene evidencia (label + commentId + último output JSON validado)"
  - "Avisa al humano sólo en state:human-review-required y state:failed-needs-human"
  - "Cap de 5 ciclos de reparación respetado en el 100% de los casos"
  - "Cap de costo por job (MAX_JOB_COST_USD) respetado con alarm 70% y abort 100%"
---

# Coordinador General

## Propósito

Controlar el ciclo completo de cada solicitud desde el Issue creado por el webhook
hasta el cierre del job (revisión humana o falla). El Coordinador no llama a LLMs,
no programa, no ejecuta QA: decide cuál agente corre a continuación basado en la
combinación `labels + último output`, postea un comentario JSON estructurado en el
Issue, y transiciona la label.

Implementación: `packages/orchestrator/src/coordinator.ts` (código determinista).

## Responsabilidades

1. Leer el estado actual del Issue: labels (`state:*`, `type:*`, `repair:*`, `cost:*`, `source:*`), título, body, último comentario de agente.
2. Aplicar las reglas de transición de la sección "Prompt del agente".
3. Invocar al agente siguiente con el contexto mínimo necesario.
4. Al recibir el output del agente: validar contra schema Zod, postear comentario JSON, transicionar label.
5. Acumular telemetría (tokens, costo) por agente y por job en un comentario `JobLedger`.
6. Detectar y bloquear loops infinitos (hard cap 5 ciclos de reparación; hard cap 1h wall-clock).
7. Detectar y bloquear sobrecosto (cap `MAX_JOB_COST_USD`, alarm 70%, abort 100%).
8. Cuando una acción cae en alcance del Guardian (`18_security_scope_guard`), invocar Guardian antes de continuar.

## Límites y prohibiciones

- **Prohibido**: `merge_to_main`, `deploy_production`, `edit_code`, `edit_secrets`, `bypass_human_approval`.
- **Token budget**: 0 tokens. Pure TypeScript code (no LLM calls).
- **Hard caps**:
  - Un job puede transicionar a `state:qa-running` máximo 6 veces (1 inicial + 5 ciclos de reparación). Excedido → `state:failed-needs-human`.
  - Duración total ≤ 1 hora wall-clock. Excedido → `state:failed-needs-human`.
  - Costo total ≤ `MAX_JOB_COST_USD` (2 USD por defecto). Alarm 70% → label `cost:warning`. Abort 100% → label `cost:over-budget` + `state:failed-needs-human`.
- **Loop protection**: si la misma transición ocurre 3+ veces para el mismo job, forzar `state:failed-needs-human`.
- No autoaprueba merge ni invoca workflows de producción.
- No modifica secrets ni reglas de Branch protection.
- No expande alcance respecto a la solicitud original.

## Protocolo de comunicación

Cita por filename:
- `01_non_condescending_communication.md` — comentarios en Issue y mensajes delegados al Notificador con tono objetivo, directo, sin halagos.
- `02_no_hallucination_evidence.md` — cada decisión incluye `evidence_refs` (label + commentId + commitSha si aplica).
- `03_github_first_source_of_truth.md` — el estado vive en labels + comentarios; el Coordinador no mantiene estado in-memory persistente entre invocaciones.
- `04_agent_design_handoff_guardrails.md` — handoffs explícitos; cada agente declara su `handoff_to`.
- `05_token_efficiency_context.md` — pasa al siguiente agente sólo el `required_context` mínimo (no body completo del Issue).
- `06_security_scope_control.md` — cualquier acción en `forbidden_actions` se delega al Guardian.
- `07_prompt_injection_output_validation.md` — outputs JSON de cada agente validados con schema Zod antes de transicionar.
- `13_logging_error_handling.md` — errores clasificados (producto / fábrica / infra / credenciales / desconocido).
- `14_human_approval_release.md` — el Coordinador NUNCA aprueba humanamente; sólo deja PR listo.
- `15_prompt_change_management.md` — cambios a este spec van por PR + evals.

## Contrato de entrada

```json
{
  "issue_id": 42,
  "user_request": "No funciona cerrar sesión",
  "current_labels": ["state:received", "source:telegram"],
  "last_agent_output": null,
  "evidence_refs": []
}
```

## Contrato de salida

```json
{
  "next_agent": "03_intent_classifier",
  "next_action": "invoke",
  "required_context": { "raw_message": "...", "chat_id": 123 },
  "status_label": "state:classifying",
  "user_message_if_needed": null
}
```

`next_agent: null` solo en estados terminales (`state:human-review-required`,
`state:failed-needs-human`, `state:cancelled`).

## Handoffs permitidos

- `→ 03_intent_classifier` (al inicio, post-intake)
- `→ 04_requirements_pm` (post-clasificación, tipo válido)
- `→ 05_technical_architect` (post-spec)
- `→ 06_model_context_router` (antes de cualquier agente LLM)
- `→ 08_github_operator` (cuando se necesita branch / PR / comment)
- `→ 09_implementation_agent` (state:coding)
- `→ 10_code_reviewer` (post-PR antes de QA)
- `→ 11_qa_planner` (state:qa-planning)
- `→ 12_playwright_agent` (state:qa-running, vía workflow CI)
- `→ 13_log_analyst` (state:qa-failed)
- `→ 14_repair_agent` (state:repairing)
- `→ 15_final_verifier` (state:auto-approved)
- `→ 16_telegram_notifier` (estados terminales o input usuario)
- `→ 18_security_scope_guard` (pre-cualquier acción riesgosa)

## Prompt del agente

> Código TypeScript determinista en `packages/orchestrator/src/coordinator.ts`. Esta sección documenta las reglas que el código debe respetar. Labels canónicos en `scripts/setup-labels.sh` — NO inventar estados nuevos.

### State machine target

| Label actual | Output reciente | Label siguiente | Agente siguiente |
|---|---|---|---|
| `state:received` | (Issue creado por webhook) | `state:classifying` | recepcionista → 03_intent_classifier |
| `state:classifying` | `tipo=pregunta` | `state:human-review-required` | 16_telegram_notifier (no code) |
| `state:classifying` | `tipo=desconocido` | `state:failed-needs-human` | 16_telegram_notifier |
| `state:classifying` | `tipo=qa_only` | `state:qa-planning` | 11_qa_planner |
| `state:classifying` | otro tipo válido | `state:planning` | 04_requirements_pm → 05_technical_architect |
| `state:planning` | spec OK | `state:coding` | 06_model_context_router → 09_implementation_agent |
| `state:planning` | `preguntas_pendientes` no vacío | `state:human-review-required` | 16_telegram_notifier |
| `state:coding` | PR abierto | `state:pr-created` → `state:waiting-preview` | (passive: deployment_status) |
| `state:waiting-preview` | preview_ready | `state:preview-ready` | 11_qa_planner |
| `state:preview-ready` | tests generados | `state:qa-running` | 12_playwright_agent (CI) |
| `state:qa-running` | passed | `state:auto-approved` → `state:human-review-required` | 15_final_verifier → 16_telegram_notifier |
| `state:qa-running` | failed AND `repair:N<5` | `state:repairing` (label `repair:N+1`) | 13_log_analyst → 14_repair_agent |
| `state:qa-running` | failed AND `repair:5` set | `state:failed-needs-human` | 16_telegram_notifier |
| `state:repairing` | commit pushed | `state:retesting` | (espera nuevo deployment_status → `state:qa-running`) |
| cualquiera | `out_of_scope` / `max_repair_cycles_reached` | `state:failed-needs-human` | 16_telegram_notifier |
| cualquiera | `cost:over-budget` set | `state:failed-needs-human` | 16_telegram_notifier |

### Loop protection

- Cap duro: contador de transiciones a `state:qa-running` ≤ 6 (1 inicial + 5 reparaciones). Excedido → `state:failed-needs-human` independiente del output.
- Cap duro: tiempo wall-clock total ≤ 1 hora. Excedido → `state:failed-needs-human`.
- Cap duro: si la misma transición (`state_actual → state_siguiente`) ocurre 3+ veces en el mismo job, forzar `state:failed-needs-human`.

### Telegram notifications (texto exacto)

El Coordinador no envía mensajes de Telegram directamente; instruye al `16_telegram_notifier` con el texto:

- `state:human-review-required` (QA OK):
  `"No se detectaron errores bloqueantes en QA automático. Listo para revisión humana. Preview: <url>. PR: <url>."`
- `state:failed-needs-human`:
  `"La fábrica no pudo cerrar el ciclo automático. Revisa el Issue #<n> en GitHub. Razón: <causa>."`
- Otros estados con input de usuario: texto generado por el agente solicitante (Recepcionista, Planificador, etc.) con tono no condescendiente (protocolo 01).

## Criterios de éxito

- No hay loops infinitos: cada job termina en `state:human-review-required` | `state:failed-needs-human` | `state:cancelled` en menos de 1 hora.
- Cada decisión de transición tiene evidencia auditable (label + commentId + último output JSON validado).
- El humano recibe aviso solamente en estados terminales, no en cada transición intermedia.
- Cap de 5 ciclos de reparación respetado en el 100% de los casos.
- Cap de costo por job respetado: alarm `cost:warning` a 70%, abort `cost:over-budget` a 100%.

## Modos de falla

| Tipo | Detección | Acción |
|---|---|---|
| Output JSON inválido (Zod falla) | catch del schema parse | reintento 1× con mismo agente; segunda falla → `state:failed-needs-human` |
| Agente lanza excepción | try/catch en orchestrator | `state:failed-needs-human`, body con stack trace truncado |
| GitHub API timeout | retry con backoff (3 intentos) | tras 3 fallos → `state:failed-needs-human` razón `infra` |
| Costo > cap | check pre-llamada vía `JobLedger` | label `cost:over-budget` + `state:failed-needs-human` |
| Loop detectado (3+ misma transición) | contador in-memory por job | `state:failed-needs-human` razón `loop_detected` |
| Wall-clock > 1h | timestamp inicial vs ahora | `state:failed-needs-human` razón `timeout` |

## Reglas de eficiencia de tokens

- **0 tokens**. El Coordinador es código determinista, no llama a LLMs.
- Telemetría: tras cada agente que sí use LLM, append usage a `JobLedger`. Comentario único en el Issue (editado in-place) con totales: `total_input_tokens`, `total_output_tokens`, `total_cached_tokens`, `total_cost_usd`.
- `MAX_JOB_COST_USD * 0.7` superado → label `cost:warning`. `MAX_JOB_COST_USD` superado → label `cost:over-budget` + stop.
- El Coordinador pasa al siguiente agente solo el `required_context` mínimo (no body de Issue completo, no diff completo si el agente no lo necesita).

## Tests mínimos del agente

Tests en `tests/factory/`:

1. **`state-labels.test.ts`** (existente, 7 tests): valida parsers de label.
2. **`coordinator.test.ts`** (NUEVO con este agente): consistencia spec ↔ `scripts/setup-labels.sh`.
3. Tests de transiciones específicas se agregan incrementalmente con cada agente B+E #02..#19.

### Casos de eval (Fase D, en `evals/handoff_evals.yml`)

- `bug` clasificado → debe activar pipeline `Clasificador → Planificador → Arquitecto → Programador → Revisor → QA → ...`.
- `merge_to_main` solicitado → debe activar Guardian y bloquear.
- `repair:5` set → próxima falla debe ir a `state:failed-needs-human`, no a `state:repairing`.
- Costo > cap → debe ir a `state:failed-needs-human` con `cost:over-budget`.
