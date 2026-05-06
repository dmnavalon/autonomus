# 13 — Logs y manejo de errores

**Aplicación**: Obligatorio para Log Analyst, Reparador, Programador y Final Verifier.

## Reglas

1. Logs deben explicar error sin exponer secretos.
2. Errores deben clasificarse como `producto`, `fabrica`, `infraestructura`, `credenciales`
   o `desconocido`.
3. Cada fallo debe tener causa probable, evidencia y siguiente acción.
4. NO ocultar fallas: si no se puede diagnosticar, marcar `unknown`.
5. Resumir logs largos y adjuntar artifact path.

## Clasificación canónica de errores

| `tipo_error` | Indicador | Acción recomendada |
|---|---|---|
| `producto` | Assertion failure, runtime exception en código de la app | `reparar` |
| `fabrica` | JSON malformado entre agentes, prompt missing, orchestrator bug | `escalar_humano` |
| `infraestructura` | OOM, build timeout, network flake | `reintentar` 1× |
| `credenciales` | 401 / 403, missing env var, bad token | `escalar_humano` |
| `desconocido` | No atribuible | `escalar_humano` |

## Estructura de log estructurado

```json
{
  "timestamp": "2026-05-05T17:30:00Z",
  "agent": "<agent_id>",
  "level": "info | warn | error",
  "event": "<short_event_name>",
  "details": { "...": "..." },
  "evidence_refs": ["..."]
}
```

## Sanitización pre-output

- Strip de tokens y patterns de secrets (regex blocklist).
- Truncate logs > 200 líneas; adjuntar artifact path completo.
- No incluir `stack trace` completo en mensajes user-facing (Telegram, comments).

## Anti-patrones

- `console.log(process.env)`.
- `error.message` directo al usuario sin sanitizar.
- Promesa rechazada silenciosamente (`.catch(() => {})`).
- Asumir que `tipo_error=desconocido` significa que no hubo error.
