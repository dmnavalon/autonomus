# Autonomus — Software Factory Agent

> Telegram → GitHub PR via multi-agent pipeline. GitHub-first, token-efficient, human-in-the-loop.

A non-technical user sends a message on Telegram. The factory classifies the request, plans the change, writes code on a branch, opens a Pull Request, deploys a Vercel Preview, runs Playwright E2E tests, repairs failures (≤ 5 cycles), and pings the user back when the PR is **ready for human review**.

The factory **never** auto-merges to `main`, **never** deploys to production, **never** touches secrets, billing, or destructive DB ops.

---

## End-to-end flow

```
Telegram message
   │
   ▼
Vercel webhook (autonomus-telegram-webhook.vercel.app)
   │  · auth: TELEGRAM_WEBHOOK_SECRET
   │  · authorization: registry/users.json
   │  · resolves active project (sticky / inline keyboard / onboarding)
   │  · creates GitHub Issue with state:received + source:telegram
   │
   ▼
GitHub Actions: orchestrator.yml on issues.opened|labeled
   │
   ▼
Coordinator (deterministic state machine)
   │
   │  ── Recepcionista (cheap LLM)        — clean text + initial intent
   │  ── Clasificador (cheap LLM)         — tipo, complejidad, riesgo
   │  ── Planificador (mid LLM)           — objective + acceptance criteria
   │  ── Arquitecto (mid/strong LLM)      — files + plan + risks
   │  ── Programador (strong LLM)         — file edits + commit/PR text
   │  ── GithubOperator (deterministic)   — preflight + commit + open PR
   │  ── waitForBranchDeployment (Vercel) — polls until preview READY
   │  ── QA Planner (cheap LLM)           — test plan
   │  ── Playwright generation + inline run — E2E against preview
   │
   │  if pass:
   │    ── Verificador (deterministic)    — checklist
   │    ── Telegram notify (canonical msg)
   │
   │  if fail:
   │    ── Analista de Logs (mid LLM)     — diagnose tipo_error
   │    ── Reparador (strong LLM)         — file edits to fix
   │    ── commit + waitForBranchDeployment + retest (≤ 5 cycles)
   │
   ▼
Issue ends in state:human-review-required or state:failed-needs-human
```

Every step is a comment on the Issue. The final telemetry comment shows
`total_input_tokens`, `total_output_tokens`, `total_cached_tokens`,
`total_cost_usd`, all bounded by the per-job cap of $2 USD.

---

## State machine (labels on the Issue)

```
state:received
  → state:classifying → state:planning → state:coding
  → state:pr-created  → state:waiting-preview → state:preview-ready
  → state:qa-planning → state:qa-running
  ├─ ok  → state:auto-approved → state:human-review-required
  └─ fail → state:qa-failed → state:repairing (label repair:N, N≤5)
            → state:retesting → loop
            └─ N=5 → state:failed-needs-human
```

---

## 19 agents + 20 protocols

The factory has **19 agents** (13 LLM-backed + 6 deterministic) governed by **20 protocols** (auditable rules versioned in `protocols/`). The full catalog lives in `docs/agents_overview.md` and `agents/00_agent_manifest.yml`.

Per-agent token caps and per-job cost ceiling are enforced in `packages/orchestrator/src/budget.ts`.

---

## Setup (first time)

### Pre-requisites

- Node.js ≥ 20
- npm ≥ 10
- `gh` CLI authenticated as `dmnavalon`
- `vercel` CLI authenticated
- A Telegram bot token (create via @BotFather)
- An AI Gateway key (Vercel AI dashboard, requires credit card to unlock free credits)

### Bootstrap (one-time)

```bash
git clone https://github.com/dmnavalon/autonomus.git
cd autonomus
npm install

# 1. Set GitHub Secrets (silent stdin, never typed in chat)
./scripts/setup-secrets.sh

# 2. Create the GitHub labels
./scripts/setup-labels.sh dmnavalon/autonomus

# 3. Deploy the Telegram webhook to Vercel
cd packages/telegram-webhook
vercel link --yes --project autonomus-telegram-webhook --scope diegomartinez-7745s-projects
cd ../..
./scripts/setup-vercel-env.sh
cd packages/telegram-webhook
vercel deploy --prod --yes --scope diegomartinez-7745s-projects
cd ../..

# 4. Register the webhook with Telegram
./scripts/setup-telegram-webhook.sh
```

### First user

Send `/start` to your bot. It returns your `chat_id`. Add it to `registry/users.json` and push.

---

## Bot commands

| Command | What it does |
|---|---|
| `/start`, `/id`, `/whoami` | Returns your chat_id (works without auth) |
| `/help` | Lists all commands |
| `/apps` | Lists your linked apps; ✅ marks the active one |
| `/use <slug>` | Sets the active project (sticky) |
| `/current` | Shows the active project |
| `/link <slug> <owner/repo>` | Opens a PR adding an app to `registry/apps.json` |

Free-text messages target the active project. If you have multiple apps and no sticky, the bot shows an inline keyboard. If you have zero apps, it shows the onboarding menu. See [docs/onboarding.md](docs/onboarding.md).

Every reply from the bot is prefixed with `📁 *Proyecto:* <slug>`.

---

## End-to-end demo

Send to your bot:

> No funciona cerrar sesión

The Issue created on GitHub will be processed by the orchestrator workflow and (when the linked app has `vercel_project_id` set) you should receive within ~5–10 minutes:

> No se detectaron errores bloqueantes en QA automático. Listo para revisión humana. Preview: https://… PR: https://…

The Issue contains a structured trace of every agent's decision and a final token/cost summary.

---

## Repository layout

```
autonomus/
├── agents/             # 19 agents (instructions.md per agent + manifest.yml)
├── protocols/          # 20 protocols (auditable rules)
├── flows/              # 6 flow recipes (software_nuevo, feature, bug, ...)
├── prompts/shared/     # Cacheable system+safety prompt prefix
├── evals/              # 3 eval suites (classification, handoffs, compliance)
├── packages/
│   ├── orchestrator/   # Coordinator, agents, schemas, tools (TS)
│   ├── telegram-webhook/ # Next.js App Router → deployed to Vercel
│   └── shared/         # Cross-workspace types (currently minimal)
├── registry/           # users.json, apps.json — operational data
├── tests/factory/      # Vitest suite (147 tests)
├── docs/               # architecture, runbook, env-vars, onboarding, agents_overview
├── scripts/            # setup-{secrets,labels,vercel-env,telegram-webhook}.sh
├── .github/workflows/  # 8 workflows
└── README.md
```

---

## Token efficiency (principio rector)

- **Prompt prefix is cached** by the provider (Anthropic ephemeral / OpenAI auto). Only `userInput` counts against per-agent caps.
- **Diffs only** between Programmer ↔ Reviewer ↔ Repairer.
- **Logs as artifacts**, only ≤ 200-line extracts reach the LLM.
- **Cheap model by default**, `strong` only for code generation/repair.
- **Per-job cap**: $2 USD. Alarm at 70%, abort at 100%.
- **Telemetry**: every Issue ends with a markdown table showing real costs.

---

## Status

| Phase | Status |
|---|---|
| 0. Bootstrap | ✅ |
| 1. GitHub-first schema | ✅ |
| 2. Telegram intake | ✅ |
| 3. Orchestrator + 4 LLM agents (intake → architecture) | ✅ |
| 3.1. Doc-maestro layer (19 agents + 20 protocols + 5 workflows) | ✅ |
| 3.5. Active-project resolution + bot commands | ✅ |
| 4. Programmer + GitHub Operator (existing-app flow) | ✅ |
| 4.5. `software_nuevo` flow (creates new repo) | ⏳ deferred |
| 5. Vercel Preview detection (polling) | ✅ |
| 6. QA Playwright (inline runner) | ✅ |
| 7. Analyst + Repairer loop (≤5) | ✅ |
| 8. Final Verifier + Telegram notify (canonical) | ✅ |
| 9. Tests + docs + e2e | ✅ |
| 10. E2E real validado contra Fechit (PR + preview + QA + notify) | ✅ 2026-06-10 |

147/147 tests green. Webhook live at https://autonomus-telegram-webhook.vercel.app.

**Modelos (free tier del AI Gateway)**: `cheap = claude-haiku-4-5` para todos los agentes
estructurados (recepcionista, clasificador, planificador, arquitecto, qa, analista);
`strong = openai/gpt-5` (reasoning minimal) SOLO para programador/reparador. El free tier
bloquea sonnet/opus (403) y rate-limita el resto; los 429 se reintentan con backoff de 75s.
Primer E2E completo: issue #18 → [fechit#39](https://github.com/dmnavalon/fechit/pull/39)
($0.11, QA 4/4 passed).

---

## License

UNLICENSED — private.
