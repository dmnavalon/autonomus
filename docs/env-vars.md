# Environment variables

All variables are documented in `.env.example`. This file explains how to obtain and where
to set each one.

| Variable | Required for | How to obtain | Where to set |
|---|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Webhook + notification | DM @BotFather on Telegram → `/newbot` | Vercel project env + GitHub Secret |
| `TELEGRAM_WEBHOOK_SECRET` | Webhook verification | `openssl rand -hex 32` | Same as above |
| `TELEGRAM_ALLOWED_CHAT_IDS` | (Optional, redundant with `registry/users.json`) | Send `/start` to your bot, inspect rejected log | Vercel only |
| `AI_GATEWAY_API_KEY` | All LLM calls | Vercel Dashboard → AI Gateway → keys | Vercel + GitHub Secret |
| `GH_AUTOMATION_TOKEN` | GitHub API in workflows | github.com → Settings → Developer settings → PAT (scopes: `repo`, `workflow`) | GitHub Secret |
| `VERCEL_TOKEN` | Vercel REST API | Vercel → Account → Tokens | GitHub Secret |
| `VERCEL_TEAM_ID` | Vercel REST API | `vercel teams ls` | GitHub Secret |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | QA Playwright vs protected previews | Vercel → project → Deployment Protection → Protection Bypass for Automation | GitHub Secret |
| `FACTORY_REPO` | Constant | Set to `dmnavalon/autonomus` | Vercel + workflow env |
| `FACTORY_APPS_OWNER` | New-app creation | Set to `dmnavalon` | Vercel + workflow env |
| `MAX_JOB_INPUT_TOKENS` | Budget guard | Default `80000` | Workflow env |
| `MAX_JOB_OUTPUT_TOKENS` | Budget guard | Default `15000` | Workflow env |
| `MAX_JOB_COST_USD` | Budget guard | Default `2.00` | Workflow env |
| `MAX_REPAIR_CYCLES` | Repair guard | Default `5` | Workflow env |
| `OPENAI_API_KEY` | (Optional fallback) | platform.openai.com | (only if AI_GATEWAY_API_KEY absent) |
| `ANTHROPIC_API_KEY` | (Optional fallback) | console.anthropic.com | (only if AI_GATEWAY_API_KEY absent) |

## Setting GitHub Secrets

```bash
gh secret set TELEGRAM_BOT_TOKEN -R dmnavalon/autonomus
gh secret set TELEGRAM_WEBHOOK_SECRET -R dmnavalon/autonomus
gh secret set AI_GATEWAY_API_KEY -R dmnavalon/autonomus
gh secret set GH_AUTOMATION_TOKEN -R dmnavalon/autonomus
gh secret set VERCEL_TOKEN -R dmnavalon/autonomus
gh secret set VERCEL_TEAM_ID -R dmnavalon/autonomus
gh secret set VERCEL_AUTOMATION_BYPASS_SECRET -R dmnavalon/autonomus
```

## Setting Vercel envs (for telegram-webhook)

```bash
cd packages/telegram-webhook
vercel link
vercel env add TELEGRAM_BOT_TOKEN
vercel env add TELEGRAM_WEBHOOK_SECRET
vercel env add GH_AUTOMATION_TOKEN
vercel env add FACTORY_REPO
```

## Rotation

Rotate `TELEGRAM_BOT_TOKEN` via @BotFather → `/revoke`.
Rotate `GH_AUTOMATION_TOKEN` via GitHub → revoke + re-issue. Update both Vercel and GitHub
Secrets in the same change.
