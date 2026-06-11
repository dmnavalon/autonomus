# Autonomus Local — la fábrica corriendo en tu Mac

Modo local de la fábrica: mismo backlog GitHub-first (Issues + labels + PRs `factory/N`,
nunca auto-merge), pero la ejecución vive en tu Mac con **`claude` headless bajo tu
suscripción** — cero facturación por token (aplican los límites de uso de tu plan).
Reemplaza al orchestrator de GitHub Actions + AI Gateway, que queda **desactivado**.

```
"crea un job para fechit: …" (Cowork)        launchd cada 5 min
        │                                          │
        ▼                                          ▼
  local/new-job.sh ──► Issue state:received ──► local/runner.sh
                       (dmnavalon/autonomus)       │ lock + parse + workspace
                                                   ▼
                                       claude -p  (runbook.md, modelo sonnet)
                                       spec → código → dev server local
                                       → Playwright (≤5 reparaciones) → PR
                                                   │
                              ┌────────────────────┤
                              ▼                    ▼
                state:human-review-required   state:failed-needs-human
                + PR en la app + notificación macOS (osascript)
```

## Piezas

| Archivo | Qué hace |
|---|---|
| `runbook.md` | Procedimiento completo del job (los 19 agentes colapsados en una sesión) |
| `runner.sh` | Poll del backlog (sin gastar Claude), lock, workspace, lanza `claude -p`, watchdog 45 min |
| `new-job.sh` | Crea un Issue-job desde la terminal o desde Cowork |
| `workspace-settings.json` | Permisos de la sesión headless (allowlist + denies: push a main, merge, secrets) |
| `qa/` | Harness Playwright compartido (se instala en `~/.autonomus-local/qa`) |
| `com.autonomus.local.plist` | launchd: corre el runner cada 5 min |
| `bootstrap.sh` | Setup one-time: dirs, QA harness, seed de env, label, desactiva cloud, carga launchd |

## Estado en disco (`~/.autonomus-local/`)

- `workspaces/<slug>/` — clone dedicado por app (nunca tu copia de trabajo)
- `qa/` — Playwright + `e2e/job-N.spec.ts` por job
- `env/<slug>.env.local` — seed de variables locales (se copia al workspace, jamás se commitea)
- `logs/` — `runner.log` + `job-N-*.log` (transcript headless completo por job)
- `locks/` — lock anti-solape

## Operación

- Crear job: `local/new-job.sh fechit "texto de la tarea"` — o pedírselo a Cowork en lenguaje natural.
- Ver backlog: `gh issue list -R dmnavalon/autonomus -l state:human-review-required` (te toca a ti)
  y PRs abiertos en la app. Las terminales también llegan como notificación de macOS.
- Pausar la fábrica: `launchctl unload ~/Library/LaunchAgents/com.autonomus.local.plist`
  (load para reanudar).
- Job atascado en estado intermedio (sesión murió a mitad): revisa `logs/job-N-*.log`,
  re-etiqueta a mano `state:received` para reintentar o ciérralo.
- Cambiar modelo/tiempo: env vars `AUTONOMUS_MODEL` (default `sonnet`),
  `AUTONOMUS_MAX_JOB_SECS` (default 2700), `AUTONOMUS_DEV_PORT` (default 4123).

## Requisitos del Mac

`claude` CLI logueado con tu suscripción, `gh` con la cuenta dmnavalon, `jq`, Node ≥20,
el Mac encendido y sin dormir en los horarios de trabajo (Ajustes → Pantalla y Energía,
o `caffeinate`). La app objetivo necesita su `.env.local` sembrado en `~/.autonomus-local/env/`.

## Diferencias vs. el modo cloud (desactivado)

| | Cloud (GitHub Actions + Gateway) | Local (este modo) |
|---|---|---|
| Costo | por token (free tier limitado) | $0 por token (límites del plan) |
| Modelos | haiku + gpt-5 | el de tu suscripción (sonnet default) |
| Agentes | 19 especializados | 1 sesión Claude Code con runbook |
| QA | preview Vercel + bypass | dev server local |
| Entrada | Telegram → webhook | Cowork / new-job.sh |
| Notificación | Telegram | notificación macOS |

Para reactivar el modo cloud: `gh workflow enable Orchestrator -R dmnavalon/autonomus`
(y desactiva launchd para no procesar doble).
