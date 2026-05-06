# 03 — GitHub como fuente de verdad

**Aplicación**: Obligatorio para agentes que leen / escriben prompts, protocolos, Issues,
PRs, labels, artifacts y diffs.

## Reglas

1. Los prompts, agentes y protocolos viven en GitHub; NO deben quedar solo hardcodeados.
2. Issues representan jobs; labels representan estado; comments guardan decisiones; PRs
   guardan cambios; artifacts guardan evidencias.
3. Todo cambio de agente / protocolo requiere commit y PR.
4. NO guardar secrets en archivos; usar GitHub Secrets / Variables.
5. NO usar una base externa como fuente principal de verdad en la capa de agentes.

## Ubicaciones canónicas

| Concepto | Ubicación |
|---|---|
| Job (request del usuario) | GitHub Issue en `dmnavalon/autonomus` |
| State machine | Issue labels (`state:*`, `type:*`, `repair:*`) |
| Decisiones por agente | Issue comments (JSON estructurado) |
| Código generado | Branch `factory/<n>` + Pull Request |
| Build / test logs | GitHub Actions artifacts |
| Instrucciones de agente | `agents/<n>/instructions.md` (versionado) |
| Manifest de agentes | `agents/00_agent_manifest.yml` |
| Protocolos | `protocols/NN_*.md` (versionado) |
| Flujos por tipo | `flows/*.md` (versionado) |
| Prompt prefix compartido | `prompts/shared/*.md` (cacheable) |
| Usuarios autorizados | `registry/users.json` (versionado) |
| Apps generadas | `registry/apps.json` (versionado) |

## Reglas de auditoría

- Cada decisión crítica debe ser reconstructible leyendo el Issue + comments + labels.
- Ningún agente mantiene estado persistente en memoria entre invocaciones.
- Cualquier "fact" que cite un agente debe tener su `evidence_ref` apuntando a GitHub.
