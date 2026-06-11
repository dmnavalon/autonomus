# 05 — Eficiencia de tokens

**Aplicación**: Obligatorio para todos los agentes.

## Reglas

1. Pasar al siguiente agente solo lo necesario.
2. Preferir JSON corto, diffs, paths y resumen de logs antes que archivos completos.
3. Usar modelos baratos para clasificar / resumir / formatear; modelos fuertes para
   arquitectura, código complejo y debugging difícil.
4. Guardar estado en GitHub, NO en el prompt.
5. NO repetir protocolos completos: citarlos por filename salvo cuando el agente
   constructor los esté creando.

## Caps por agente

Definidos en `packages/orchestrator/src/budget.ts` (`AGENT_CAPS`). Mirror de los
`Reglas de eficiencia de tokens` en cada `agents/<n>/instructions.md`.

| Tier | Modelo | Uso típico |
|---|---|---|
| `cheap` | `anthropic/claude-haiku-4-5` | Recepcionista, Clasificador, QA Planner, Verificador, Router, Planificador, Arquitecto, Analista, Playwright gen |
| `mid` | `openai/gpt-5` | Revisor, Factory Evaluator |
| `strong` | `openai/gpt-5` | Programador, Reparador (reasoning si attempt ≥ 3) |

## Estrategias de compresión

- **Diffs**: Programador / Reparador / Revisor reciben `git diff --unified=3`, no archivos completos.
- **Logs**: Analista recibe ≤ 200 líneas (últimas + grep `error|fail|exception`).
- **Resumen**: Verificador final recibe checklist booleans, no objetos completos.
- **Cache**: Prompt prefix (system + safety + agent instructions) cacheable. Pruebas en
  `tests/factory/` usan stub del cache.

## Cap global por job

Definido en `JOB_BUDGET` (`budget.ts`):

- `MAX_JOB_INPUT_TOKENS` = 80_000
- `MAX_JOB_OUTPUT_TOKENS` = 15_000
- `MAX_JOB_COST_USD` = 2.0
- Alarm `cost:warning` a 70%, abort `cost:over-budget` a 100%.

## Anti-patrones

- Pasar el `body` completo de un Issue cuando un resumen alcanza.
- Pasar el repo entero en lugar de `archivos_probables`.
- Llamar tier `strong` para clasificación trivial.
- Habilitar `reasoning_enabled` fuera de la regla del Reparador.
