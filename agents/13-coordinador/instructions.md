# Agent 13 — Coordinador General

## Role

Drive the state machine. Decide which agent runs next based on labels and the latest agent
output. **No LLM calls in this agent** — pure TypeScript code.

## Token budget

- **0 tokens. Always.**

## Implementation

Lives in `packages/orchestrator/src/coordinator.ts`. The job is to:

1. Read the Issue's current label set.
2. Read the latest agent comment (parsed JSON).
3. Apply transition rules below.
4. Invoke the next agent.
5. On agent return, transition the label and post a comment.
6. On error, transition to a recoverable state or `state:failed-needs-human`.

## Transition rules

| Current label | Latest output | Next label | Next agent |
|---|---|---|---|
| `state:received` | (none) | `state:classifying` | recepcionista → clasificador |
| `state:classifying` | `tipo=pregunta` | `state:human-review-required` | finalizar (no code) |
| `state:classifying` | `tipo=desconocido` | `state:failed-needs-human` | notify |
| `state:classifying` | `tipo=qa_only` | `state:qa-planning` | qa_planner |
| `state:classifying` | other | `state:planning` | planificador → arquitecto |
| `state:planning` | spec OK | `state:coding` | router → programador |
| `state:planning` | `preguntas_pendientes` non-empty | `state:human-review-required` | notify (ask user) |
| `state:coding` | PR opened | `state:waiting-preview` | (passive: wait deployment_status) |
| `state:waiting-preview` | preview_ready event | `state:preview-ready` | qa_planner |
| `state:preview-ready` | tests generated | `state:qa-running` | playwright (CI) |
| `state:qa-running` | passed | `state:auto-approved` → `state:human-review-required` | verificador → telegram_notify |
| `state:qa-running` | failed AND `repair:N<5` | `state:repairing` (label `repair:N+1`) | analista_logs → reparador |
| `state:qa-running` | failed AND `repair:5` set | `state:failed-needs-human` | telegram_notify |
| `state:repairing` | commit pushed | `state:retesting` | (wait new deployment_status, then qa-running) |
| any | error envelope `out_of_scope` / `max_repair_cycles_reached` | `state:failed-needs-human` | telegram_notify |

## Loop protection

- Hard cap: a job may transition through `state:qa-running` at most 6 times (1 initial + 5
  repair cycles). If the counter exceeds 6, force `state:failed-needs-human` regardless.
- Hard cap: total job duration ≤ 1 hour wall-clock. If exceeded, force
  `state:failed-needs-human`.

## Telegram notifications

The Coordinator triggers notifications only at these terminal states:

- `state:human-review-required` → exact message:
  `"No se detectaron errores bloqueantes en QA automático. Listo para revisión humana. Preview: <url>. PR: <url>."`
- `state:failed-needs-human` → exact message:
  `"La fábrica no pudo cerrar el ciclo automático. Revisa el Issue #<n> en GitHub. Razón: <causa>."`

## Telemetry

After every agent call, append usage to a running counter on the Issue (single comment that
gets edited): `total_input_tokens`, `total_output_tokens`, `total_cached_tokens`,
`total_cost_usd`. If `total_cost_usd > MAX_JOB_COST_USD * 0.7`, label `cost:warning`. If `>
MAX_JOB_COST_USD`, label `cost:over-budget` and stop.
