---
agent_id: "06_model_context_router"
name: "Router de Modelos y Contexto"
version: "1.0"
owner: "Software Factory Agent"
system_area: "eficiencia"
folder: "05-router-modelos"
required_protocols:
  - "02_no_hallucination_evidence.md"
  - "04_agent_design_handoff_guardrails.md"
  - "05_token_efficiency_context.md"
  - "07_prompt_injection_output_validation.md"
  - "17_data_privacy.md"
allowed_tools:
  - "metadata.read"
  - "artifacts.summarize"
  - "model.select"
forbidden_actions:
  - "choose_high_cost_model_without_reason"
  - "pass_full_repo_if_diff_suffices"
input_contract:
  task_type: "string"
  agent_to_route: "string"
  complejidad: "baja | media | alta"
  riesgo: "bajo | medio | alto"
  context_size: "number"
  required_accuracy: "alta | media | baja"
output_contract:
  selected_model_tier: "cheap | mid | strong"
  model: "string"
  reasoning_enabled: "boolean"
  context_package: "object"
  compression_strategy: "diffs | summary | full | none"
  max_tokens_budget: "{ input: number, output: number }"
handoff_from:
  - "01_coordinator"
  - "05_technical_architect"
handoff_to:
  - "09_implementation_agent"
  - "10_code_reviewer"
  - "13_log_analyst"
  - "14_repair_agent"
success_criteria:
  - "Uso de contexto mínimo y modelo proporcional a riesgo/complejidad"
  - "Default 0 tokens (determinista); LLM tiebreaker rara vez (<5%)"
  - "Cada upgrade de tier tiene regla escrita en este spec"
---

# Router de Modelos y Contexto

## Propósito

Decidir modelo/contexto mínimo por tarea para ahorrar tokens sin perder precisión.
Implementación determinista en `packages/orchestrator/src/router.ts` (`chooseModel`).

## Responsabilidades

1. Mapear `agent_to_route` + complejidad + riesgo + métricas (PR LoC, intento, bloqueante) al `tier`.
2. Aplicar reglas de upgrade documentadas (tabla más abajo).
3. Habilitar `reasoning_enabled=true` solo cuando hay regla (Reparador attempt ≥ 3).
4. Definir `compression_strategy`: diffs / summary / full / none.
5. Producir `max_tokens_budget` respetando caps globales.

## Límites y prohibiciones

- **Prohibido**: `choose_high_cost_model_without_reason`, `pass_full_repo_if_diff_suffices`.
- No subir tier sin regla escrita.
- No habilitar reasoning fuera del Reparador attempt ≥ 3.
- No pasar `files_full_content` si `git diff` alcanza.
- **Token budget**: 0 tokens default. LLM tiebreaker (raro): cheap, ≤ 1.5k input.

## Protocolo de comunicación

- `02_no_hallucination_evidence.md` — decisión cita la regla.
- `04_agent_design_handoff_guardrails.md` — Router NO decide qué agente corre, solo modelo/contexto.
- `05_token_efficiency_context.md` — base del agente.
- `07_prompt_injection_output_validation.md` — contexto pasado se sanitiza.
- `17_data_privacy.md` — no incluir datos personales en `context_package`.

## Contrato de entrada

```json
{
  "task_type": "string",
  "agent_to_route": "string",
  "complejidad": "baja | media | alta",
  "riesgo": "bajo | medio | alto",
  "context_size": 0,
  "required_accuracy": "alta | media | baja"
}
```

## Contrato de salida

```json
{
  "selected_model_tier": "cheap | mid | strong",
  "model": "anthropic/claude-haiku-4-5 | openai/gpt-5 | openai/gpt-5",
  "reasoning_enabled": false,
  "context_package": { "spec": "...", "diff": "...", "files_extracts": {} },
  "compression_strategy": "diffs | summary | full | none",
  "max_tokens_budget": { "input": 16000, "output": 4000 }
}
```

## Handoffs permitidos

- `→ 09_implementation_agent` (post-Arquitecto, prepara contexto Programador)
- `→ 10_code_reviewer` (prepara diff)
- `→ 13_log_analyst` (prepara resumen logs)
- `→ 14_repair_agent` (prepara diagnosis + diff + files)

## Prompt del agente

> Pure function en `packages/orchestrator/src/router.ts`.

### Default mapping (deterministic)

| agent | tier (default) | upgrade rule |
|---|---|---|
| recepcionista | cheap | — |
| clasificador | cheap | — |
| qa_planner | cheap | — |
| verificador | cheap | — |
| router (self) | cheap | — |
| planificador | mid | — |
| arquitecto | mid | strong if `complejidad=alta` OR `riesgo=alto` |
| revisor_codigo | mid | strong if PR diff > 1000 LOC |
| analista_logs | mid | strong if `bloqueante=true` AND last attempt was strong |
| programador | strong | — (always strong) |
| reparador | strong | enable `reasoning_enabled=true` if attempt ≥ 3 |
| protocol_binder | cheap | mid si valida cambios masivos en >5 agentes simultáneos |
| github_operator | (no LLM) | — |
| playwright | (no LLM at runtime) | — |
| telegram_notifier | (no LLM) | — |
| factory_evaluator | mid | — |
| security_scope_guard | (no LLM por default) | mid si requiere análisis textual |
| prompt_change_manager | cheap | mid si cambios cruzan ≥ 3 agentes |

### Tier → model mapping

- `cheap`  → `anthropic/claude-haiku-4-5` (env: `MODEL_CHEAP`)
- `mid`    → `openai/gpt-5` (env: `MODEL_MID`)
- `strong` → `openai/gpt-5` (env: `MODEL_STRONG`)

### Compression strategy

- Programador/Reparador: `diffs` para review; `full` solo de archivos ≤ 2k tokens.
- Revisor: `diffs` siempre.
- Analista de Logs: `summary` (≤ 200 líneas).
- Otros: `none` o el mínimo necesario.

## Criterios de éxito

- Uso de contexto mínimo: ningún agente recibe más tokens que su `input_cap`.
- Modelo proporcional a riesgo/complejidad.
- Default 0 tokens; LLM tiebreaker <5%.
- `reasoning_enabled` solo activado con regla.

## Modos de falla

| Tipo | Detección | Acción |
|---|---|---|
| Conflicto de reglas | múltiples upgrades aplican | LLM tiebreaker (cheap, 1.5k) decide |
| `agent_to_route` desconocido | no en mapping | error `invalid_input`, default `cheap` con aviso |
| `context_size` > tier máximo | overflow | upgrade tier o `compression_strategy=summary` |
| `MODEL_*` env vacío | runtime check | fallback hardcoded; warning en logs |

## Reglas de eficiencia de tokens

- 0 tokens default.
- LLM tiebreaker: input ≤ 1,500 / output ≤ 200 / tier `cheap`.
- Updates a `MODEL_*` solo via env vars; no requieren redeploy.

## Tests mínimos del agente

1. **`router.test.ts`** (existente, 5 tests).
2. Tests extendidos (futuro): mapping de los 6 nuevos agentes.

### Casos de eval (Fase D, en `evals/handoff_evals.yml`)

- `arquitecto + complejidad=alta` → `strong`.
- `revisor_codigo + diff=2000 LOC` → `strong`.
- `reparador + intento=4` → `strong`, `reasoning_enabled=true`.
- `programador` → siempre `strong`.
- `qa_planner` → siempre `cheap`.
