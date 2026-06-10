# Inter-agent JSON schemas (reference)

All agents communicate via compact JSON. The orchestrator validates each output with Zod
schemas defined in `packages/orchestrator/src/schemas/`. This document is a human-readable
mirror; the source of truth is the Zod code.

Agents MUST return the JSON object only — no fences, no commentary.

---

## RecepcionistaOutput

```json
{
  "texto_limpio": "string (≤500 chars)",
  "intencion_inicial": "software_nuevo | feature | bug | cambio_visual | qa_only | refactor | pregunta | desconocido",
  "falta_info_critica": false,
  "preguntas": []
}
```

If `falta_info_critica=true`, fill `preguntas` with up to 2 short Spanish questions to send
back via Telegram. Otherwise leave it empty.

---

## ClasificadorOutput

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

---

## PlanificadorOutput (spec)

```json
{
  "objetivo": "string (≤200 chars)",
  "alcance": ["≤5 bullets"],
  "fuera_de_alcance": ["≤3 bullets"],
  "pantallas_afectadas": ["string"],
  "flujos_esperados": ["string"],
  "criterios_aceptacion": ["string (Given/When/Then style, ≤4)"],
  "riesgos": ["string"],
  "preguntas_pendientes": []
}
```

---

## ArquitectoOutput

```json
{
  "archivos_probables": ["path"],
  "estructura": "string (≤300 chars)",
  "dependencias_nuevas": [],
  "requiere_migracion_db": false,
  "requiere_env_vars": [],
  "riesgos_tecnicos": ["string"],
  "plan_pasos": ["≤5 bullets"]
}
```

---

## RouterOutput

```json
{
  "modelos": {
    "programador": "anthropic/claude-opus-4-7",
    "reparador": "anthropic/claude-opus-4-7",
    "revisor_codigo": "anthropic/claude-sonnet-4-6",
    "analista_logs": "anthropic/claude-sonnet-4-6"
  }
}
```

---

## ProgramadorOutput

```json
{
  "branch": "factory/<issue-number>",
  "pr_number": 0,
  "pr_url": "string",
  "commits": ["sha"],
  "archivos_modificados": ["path"],
  "diff_resumen": "string (≤300 chars)"
}
```

---

## RevisorCodigoOutput

```json
{
  "aprobado": true,
  "observaciones": ["string"],
  "cambios_solicitados": []
}
```

---

## QaPlannerOutput

```json
{
  "tests": [
    {
      "nombre": "string",
      "prioridad": "critica | alta | media",
      "tipo": "flujo | error | visual | responsive",
      "pasos": ["string"]
    }
  ]
}
```

---

## AnalistaLogsOutput

```json
{
  "estado": "passed | failed",
  "tipo_error": "producto | fabrica | infraestructura | credenciales | desconocido",
  "resumen": "string (≤200 chars)",
  "causa_probable": "string (≤200 chars)",
  "archivos_probables": ["path"],
  "accion_recomendada": "reparar | escalar_humano | reintentar | ignorar",
  "bloqueante": true
}
```

---

## ReparadorOutput

```json
{
  "intento": 1,
  "branch": "factory/<n>",
  "commit_sha": "string",
  "cambios": "string (≤300 chars)",
  "agotados_los_intentos": false
}
```

---

## VerificadorFinalOutput

```json
{
  "go": true,
  "checklist": {
    "branch_existe": true,
    "pr_existe": true,
    "preview_existe": true,
    "build_ok": true,
    "lint_ok": true,
    "typecheck_ok": true,
    "tests_ok": true,
    "no_bloqueantes": true,
    "revisor_aprobo": true,
    "ultimo_commit_testeado": true
  },
  "razon_si_no_go": ""
}
```

---

## Error envelope (any agent)

```json
{ "error": "max_repair_cycles_reached | input_truncated_insufficient | out_of_scope | invalid_input | provider_error", "reason": "string (optional)" }
```
