# 10 — Secrets y variables de entorno

**Aplicación**: Obligatorio si se mencionan tokens, API keys, `.env`, GitHub Secrets,
Vercel env vars o credenciales.

## Reglas

1. NUNCA escribir secretos en repo, logs o comentarios.
2. Definir nombres de variables requeridas y documentar cómo configurarlas.
3. Usar GitHub Secrets y variables de entorno del proveedor correspondiente.
4. Si falta una credencial, NO inventarla: marcar `missing_secret`.
5. NO imprimir `.env` completo ni valores sensibles.

## Patrones detectados (regex blocklist)

```
AKIA[A-Z0-9]{16}                    # AWS access key
ghp_[A-Za-z0-9]{36,}                # GitHub PAT
xox[baprs]-[A-Za-z0-9-]+            # Slack tokens
sk-[A-Za-z0-9]{40,}                 # OpenAI / Anthropic
AIza[0-9A-Za-z_-]{35}               # Google API
-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----
```

Implementado en `packages/orchestrator/src/agents/security_scope_guard.ts` y
`github_operator.ts`.

## Variables de entorno canónicas (Software Factory Agent)

| Nombre | Scope | Documentación |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | webhook + workflows | docs/env-vars.md |
| `TELEGRAM_WEBHOOK_SECRET` | webhook | HMAC validation |
| `GH_AUTOMATION_TOKEN` | webhook + orchestrator | scopes `repo, workflow` |
| `AI_GATEWAY_API_KEY` | orchestrator | LLM calls |
| `VERCEL_TOKEN` | workflows | preview deploys read |
| `VERCEL_TEAM_ID` | workflows | team scope |
| `MODEL_CHEAP` / `MODEL_MID` / `MODEL_STRONG` | orchestrator | tier override |
| `MAX_JOB_INPUT_TOKENS` / `MAX_JOB_OUTPUT_TOKENS` / `MAX_JOB_COST_USD` | orchestrator | budget caps |
| `FACTORY_REPO` | webhook + orchestrator | default `dmnavalon/autonomus` |

## Estructura recomendada

- `.env.example` versionado (solo nombres + comentarios).
- `.env` ignorado vía `.gitignore`.
- Vercel: `vercel env pull` para sync local.
- GitHub: `gh secret set NAME` (no commitear nunca).

## Anti-patrones

- Hardcodear `API_KEY = "sk-..."` en código.
- Logear `process.env` completo.
- PR description con valor real de un secret.
- Compartir secrets vía Telegram o email.
