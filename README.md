# Autonomus — Software Factory Agent

> Telegram → GitHub PR via multi-agent pipeline. GitHub-first, token-efficient, human-in-the-loop.

A non-technical user sends a message on Telegram. The factory classifies the request, plans the change, writes code on a branch, opens a Pull Request, deploys a Vercel Preview, runs Playwright E2E tests, repairs failures (≤ 5 cycles), and pings the user back when the PR is **ready for human review**.

The factory **never** auto-merges to `main`, **never** deploys to production, **never** touches secrets, billing, or destructive DB ops.

---

## Architecture in one paragraph

A small Vercel Function (`packages/telegram-webhook`) receives Telegram updates, validates the user, and creates a GitHub Issue in `dmnavalon/autonomus`. The Issue is the **job**; its labels (`state:*`, `type:*`, `repair:*`) are the state machine. A GitHub Actions workflow (`.github/workflows/orchestrator.yml`) runs the orchestrator (`packages/orchestrator`), a TypeScript pipeline of 13 mini-agents whose instructions live as versioned markdown files in `agents/`. Each agent calls a model through Vercel AI Gateway with a hard token cap, posts a structured comment back to the Issue, and transitions the label. Code lands on a `factory/<n>` branch, opens a PR, waits for Vercel Preview, runs Playwright on it, repairs if needed, and notifies the user via Telegram when the PR is human-review ready.

---

## Mini-agents (13)

| # | Agent | Model tier | Input cap | Output cap |
|---|-------|------------|-----------|------------|
| 1 | Recepcionista (Telegram intake) | cheap | 2k | 300 |
| 2 | Clasificador | cheap | 1.5k | 200 |
| 3 | Planificador / PM | mid | 4k | 800 |
| 4 | Arquitecto Técnico | mid | 6k | 1.2k |
| 5 | Router de Modelos | (deterministic, no LLM) | — | — |
| 6 | Programador | strong | 16k | 4k |
| 7 | Revisor de Código | mid | 8k | 600 |
| 8 | QA Planner | cheap | 3k | 600 |
| 9 | Playwright runner | (no LLM at runtime) | — | — |
| 10 | Analista de Logs | mid | 6k | 500 |
| 11 | Reparador | strong | 12k | 3k |
| 12 | Verificador Final | cheap | 1.5k | 200 |
| 13 | Coordinador | (deterministic, no LLM) | — | — |

Per-job hard cap: **80k input + 15k output tokens, ≤ $2 USD**. Exceeded → label `cost:over-budget` and stop.

See [docs/architecture.md](docs/architecture.md) for the full picture.

---

## State machine (labels on the Issue)

```
state:received
  → state:classifying → state:planning → state:coding
  → state:pr-created → state:waiting-preview → state:preview-ready
  → state:qa-planning → state:qa-running
  ├─ ok  → state:auto-approved → state:human-review-required
  └─ fail → state:qa-failed → state:repairing (label repair:N, N≤5)
            → state:retesting → loop
            └─ N=5 → state:failed-needs-human
```

---

## Repository layout

```
autonomus/
├── agents/             # 13 mini-agent instruction files (versioned prompts)
├── prompts/shared/     # System / safety / json-schemas (cacheable prompt prefix)
├── flows/              # 6 flow recipes (software_nuevo, feature, bug, …)
├── packages/
│   ├── orchestrator/   # Node/TS pipeline (CLI entrypoint for GH Actions)
│   ├── telegram-webhook/ # Next.js App Router → Vercel Function
│   └── shared/         # Shared types / schemas / prompt loader
├── registry/           # users.json, apps.json (operational data, versioned)
├── templates/nextjs-vercel-app/ # Template repo for `software_nuevo`
├── tests/factory/      # Vitest tests of the factory itself (14 tests)
├── .github/workflows/  # orchestrator, qa-playwright, repair-cycle, factory-tests
├── docs/               # architecture, runbook, env-vars, ADRs
├── package.json        # npm workspaces
├── tsconfig.base.json
├── playwright.config.ts
└── vercel.ts
```

---

## Setup (first time)

### 1. Prerequisites

- Node.js ≥ 20
- npm ≥ 10
- GitHub CLI (`gh`) authenticated as `dmnavalon`
- Vercel CLI authenticated (`vercel login`)
- A Telegram bot token (create via @BotFather)

### 2. Install dependencies

```bash
git clone git@github.com:dmnavalon/autonomus.git
cd autonomus
npm install
```

### 3. Configure environment

Copy `.env.example` to `.env` and fill in values. See [docs/env-vars.md](docs/env-vars.md) for how to obtain each one.

### 4. Configure GitHub Secrets

```bash
gh secret set TELEGRAM_BOT_TOKEN -R dmnavalon/autonomus
gh secret set TELEGRAM_WEBHOOK_SECRET -R dmnavalon/autonomus
gh secret set AI_GATEWAY_API_KEY -R dmnavalon/autonomus
gh secret set GH_AUTOMATION_TOKEN -R dmnavalon/autonomus
gh secret set VERCEL_TOKEN -R dmnavalon/autonomus
gh secret set VERCEL_TEAM_ID -R dmnavalon/autonomus
```

### 5. Deploy Telegram webhook to Vercel

```bash
cd packages/telegram-webhook
vercel link        # link to a Vercel project
vercel env pull    # sync env to local
vercel deploy      # preview deploy
```

### 6. Set Telegram webhook

```bash
curl -F "url=https://<your-deployment>.vercel.app/api/telegram/webhook" \
     -F "secret_token=$TELEGRAM_WEBHOOK_SECRET" \
     "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook"
```

### 7. Authorize your Telegram chat

Edit `registry/users.json` and add your `chat_id` (find it by sending `/start` once and inspecting the rejected webhook log).

---

## End-to-end demo

Send to your bot on Telegram:

> "No funciona cerrar sesión"

Within ~5–10 minutes you should receive:

> "No se detectaron errores bloqueantes en QA automático. Listo para revisión humana. Preview: https://… PR: https://…"

The Issue on GitHub will contain a structured trace of every agent's decision and a token/cost summary.

---

## Token efficiency (principio rector)

See [docs/architecture.md#token-efficiency](docs/architecture.md) for the full strategy. Highlights:

- **Prompt caching** on every LLM call (stable prefix from `prompts/shared/system.md` + `agents/<n>/instructions.md`).
- **Diffs only**, never full files between agents.
- **Logs as artifacts**, only relevant extracts (≤ 200 lines) reach the LLM.
- **Cheap model by default**, strong tier only for code generation/repair.
- **Hard caps per agent**, hard cap per job, alarm at 70%, abort at 100%.
- **Telemetry**: every job's final Issue comment lists `total_input_tokens`, `total_output_tokens`, `total_cached_tokens`, `total_cost_usd`.

---

## Status

🚧 In progress. See [PLAN.md](docs/architecture.md) for the build phases.

---

## License

UNLICENSED — private.
