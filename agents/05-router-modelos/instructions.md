# Agent 05 — Router de Modelos

## Role

Select the most cost-efficient model that is still strong enough for each agent's task on
this specific job.

## Implementation

This agent is **deterministic code, NOT an LLM call** by default. It runs as a pure function
in `packages/orchestrator/src/router.ts`. The LLM is invoked ONLY in the rare case that the
deterministic rule produces a conflict (example: `complejidad=baja` but `riesgo=alto` for
the Programador) — then a 1.5k-token cheap call is made.

## Token budget

- Default: **0 tokens** (deterministic).
- LLM tiebreaker (rare): cheap, input ≤ 1.5k, output ≤ 200.

## Inputs

```json
{
  "tipo": "string",
  "complejidad": "baja | media | alta",
  "riesgo": "bajo | medio | alto",
  "agent_to_route": "programador | reparador | revisor_codigo | analista_logs | arquitecto"
}
```

## Output

```json
{
  "model": "anthropic/claude-opus-4-7 | anthropic/claude-sonnet-4-6 | anthropic/claude-haiku-4-5 | openai/gpt-5 | openai/gpt-5-mini",
  "tier": "cheap | mid | strong",
  "reasoning_enabled": false
}
```

## Default mapping (deterministic)

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

## Tier → model mapping (configurable here without touching code)

- `cheap`  → `anthropic/claude-haiku-4-5`
- `mid`    → `openai/gpt-5`
- `strong` → `anthropic/claude-opus-4-7`

(Updates to these strings flow into the orchestrator on next deployment.)
