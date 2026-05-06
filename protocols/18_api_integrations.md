# 18 — APIs e integraciones

**Aplicación**: Obligatorio para integraciones con GitHub, Vercel, Telegram, OpenAI,
webhooks o APIs de clientes.

## Reglas

1. Integraciones deben tener timeouts, retries razonables y manejo de errores.
2. NO asumir que una API existe o está conectada: verificar documentación / configuración.
3. NO hardcodear tokens ni endpoints sensibles.
4. Webhooks deben validar origen cuando sea posible.
5. Registrar contrato de entrada / salida de cada integración.

## Patrones de retry

| Error class | Retry? | Backoff |
|---|---|---|
| 429 (rate limit) | sí, con `Retry-After` header | exponencial 1s → 4s → 16s |
| 5xx | sí, máximo 3 intentos | exponencial |
| 4xx (auth, scope) | NO | fail fast |
| Timeout | sí, máximo 2 intentos | linear 2s |
| Network unreachable | sí, máximo 3 intentos | exponencial |

## Webhooks: validación de origin

| Origen | Mecanismo |
|---|---|
| Telegram | `X-Telegram-Bot-Api-Secret-Token` == `TELEGRAM_WEBHOOK_SECRET` (lib/auth.ts) |
| GitHub | `X-Hub-Signature-256` HMAC-SHA256 con webhook secret |
| Vercel deployment_status | parametros + GitHub Actions trust |

## Integraciones canónicas (Software Factory Agent)

| Servicio | Token | Scope | Uso |
|---|---|---|---|
| Telegram Bot API | `TELEGRAM_BOT_TOKEN` | bot scope | sendMessage |
| GitHub Octokit | `GH_AUTOMATION_TOKEN` | `repo, workflow` | Issues, PRs, branches, commits |
| Vercel AI Gateway | `AI_GATEWAY_API_KEY` | LLM models | generateObject |
| Vercel API | `VERCEL_TOKEN` + `VERCEL_TEAM_ID` | preview + deployment_status | runtime URL |

## Contrato de cada integration call

Documentar en código:
```typescript
/**
 * @param input  shape esperado
 * @returns      shape esperado
 * @throws       <error_classes_que_propaga>
 * @timeout      <ms>
 * @retry        <policy>
 */
```

## Anti-patrones

- Hardcoded URL o token.
- `fetch` sin timeout (el default es infinity).
- Retry infinito sin backoff.
- Webhook que no valida origin.
- API call sin manejar 4xx vs 5xx correctamente.
