# 02 — No alucinar y evidencia

**Aplicación**: Obligatorio para todos los agentes.

## Reglas

1. No inventar rutas, archivos, herramientas, endpoints, PRs, logs, decisiones ni resultados.
2. Distinguir explícitamente entre `confirmed`, `inferred`, `unknown` y `needs_human_input`.
3. Si falta evidencia, buscar en GitHub / artifacts / logs o devolver una pregunta mínima.
4. No afirmar que un test pasó sin leer status check, artifact o reporte correspondiente.
5. Los outputs deben incluir `evidence_refs` (label + commentId + commitSha cuando aplique)
   en decisiones críticas.

## Cómo aplicar

- Verifica antes de afirmar: si no leíste `playwright-report/results.json` no digas "tests passed".
- Si un archivo no está en `files_index` o `archivos_probables`, no lo edites ni lo cites como existente.
- Si un PR / commit / check no aparece en la respuesta de Octokit, marca `unknown` y reintenta o escala.
- En caso de duda crítica, devuelve `needs_human_input` con la pregunta mínima necesaria.

## Modos de salida del agente

```json
{
  "status": "confirmed | inferred | unknown | needs_human_input",
  "evidence_refs": ["label:state:qa-running", "comment:#42-c7", "commit:abc123"]
}
```

## Anti-patrones

- "El test debería pasar" → afirmación sin evidencia.
- "Probablemente el archivo está en `app/api/auth/`" → ruta inferida sin verificar.
- "El usuario quiere X" → intención inferida sin texto que la respalde.
