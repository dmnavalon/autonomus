# Runbook — Operating the factory

## Day-zero setup checklist

- [ ] `npm install` at the repo root succeeds.
- [ ] `npm run typecheck` and `npm run build` are green.
- [ ] `npm run test:factory` is green.
- [ ] All GitHub Secrets are set: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
      `AI_GATEWAY_API_KEY`, `GH_AUTOMATION_TOKEN`, `VERCEL_TOKEN`, `VERCEL_TEAM_ID`.
- [ ] `packages/telegram-webhook` deployed to Vercel (preview is fine for MVP).
- [ ] Telegram webhook URL configured (via curl `setWebhook` once).
- [ ] Your Telegram `chat_id` added to `registry/users.json`.
- [ ] `main` branch protected: require PR, no force pushes, no deletions, require
      `factory-tests` and `ci-quality` checks.

## Daily operating

### When a user sends a Telegram message

1. The webhook creates an Issue in `dmnavalon/autonomus` with label `state:received`.
2. `orchestrator.yml` triggers. Check the Issue page; each agent posts a JSON comment.
3. A `factory/<issue-number>` branch and PR appear when the Programmer agent commits.
4. Vercel Preview is detected via `deployment_status`. URL is commented on the Issue.
5. Playwright runs; on failure, Repairer kicks in (≤5 cycles).
6. When `state:human-review-required` is set, the user gets a Telegram notification.

### Reviewing a delivered PR

1. Click the PR link in the Telegram message.
2. Inspect the Issue comments to see each agent's reasoning.
3. Click the Vercel Preview to test by hand.
4. Download Playwright artifacts (results, traces, screenshots).
5. If satisfied, merge the PR yourself. The factory NEVER auto-merges.

### When the factory escalates `state:failed-needs-human`

1. Open the Issue.
2. Read the last `Analista de Logs` comment — it tells you `tipo_error` and `causa_probable`.
3. Look at the Playwright trace artifact for the failing run.
4. Decide: fix manually on the `factory/<n>` branch, or close the Issue.

## Emergencies

| Situation | Action |
|---|---|
| Bot is sending duplicate messages | Run `curl ".../bot$TOKEN/deleteWebhook"` then re-set with secret_token |
| Costs spike | Find Issues with label `cost:over-budget`, close them; `MAX_JOB_COST_USD` lowers it |
| GitHub Actions exhausted minutes | Disable orchestrator workflow temporarily; investigate |
| A wild secret leaks | Rotate the credential immediately; the safety regex in `safety.ts` should have caught it — file a bug |

## Maintenance

- **Update an agent's behavior**: edit `agents/<n>/instructions.md`, commit, open PR.
  Cache hits will rebuild within an hour as old prefixes age out.
- **Add a new flow type**: create `flows/<new>.md` and update the Clasificador's enum.
- **Bump a model version**: edit `agents/05-router-modelos/instructions.md` (no code change).
- **Increase repair cap**: edit `MAX_REPAIR_CYCLES` in `.env` and `safety.md`. Be careful.
