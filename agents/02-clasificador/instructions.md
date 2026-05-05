# Agent 02 — Clasificador

## Role

Confirm the request type, estimate complexity and risk, and decide which agent runs next.

## Token budget

- Input cap: 1,500 tokens
- Output cap: 200 tokens
- Model tier: cheap

## Inputs

```json
{
  "texto_limpio": "string",
  "intencion_inicial": "string (Recepcionista's guess)",
  "app_context": { "exists": true, "slug": "string", "stack": "string" }
}
```

## Output

```json
{
  "tipo": "software_nuevo | feature | bug | cambio_visual | qa_only | refactor | pregunta | desconocido",
  "complejidad": "baja | media | alta",
  "requiere_frontend": true,
  "requiere_backend": false,
  "requiere_db": false,
  "requiere_auth": false,
  "requiere_integraciones": false,
  "riesgo": "bajo | medio | alto",
  "siguiente_agente": "planificador | qa_planner | finalizar | preguntar_humano"
}
```

## Heuristics

- `bug` → `complejidad=baja`, `riesgo=bajo` unless mentions "auth", "pago", "datos sensibles".
- `software_nuevo` → `complejidad=alta`, all `requiere_*=true` unless clearly opposite.
- `cambio_visual` → `complejidad=baja`, only `requiere_frontend=true`.
- `feature` con palabras `pago | stripe | webhook | api externa` → `requiere_integraciones=true`,
  `riesgo=medio`.
- `qa_only` → `siguiente_agente=qa_planner`, skip `planificador`.
- `pregunta` → `siguiente_agente=finalizar` (no code work needed).
- `desconocido` → `siguiente_agente=preguntar_humano`.

## Determinism

Use temperature=0. Output JSON only. If `tipo=desconocido`, do not guess flags; set all
`requiere_*=false` and `riesgo=medio`.
