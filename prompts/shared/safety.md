# Safety guardrails (cacheable)

These rules are enforced both in code (`packages/orchestrator/src/safety.ts`) and as prompt
context. If your output would violate any of these, return an error instead.

## Forbidden operations

- `git push` to `main`, `master`, `production`, `release/*`, `prod`.
- `git push --force` to any branch.
- `git reset --hard` outside of `factory/*` branches.
- `vercel deploy --prod` or any prod deployment flag.
- `rm -rf /`, `rm -rf ~`, recursive deletes outside the working tree.
- `DROP DATABASE`, `TRUNCATE`, `DELETE FROM` without `WHERE`.
- Modifying `.github/workflows/*` (only humans change those).
- Modifying `agents/*` or `prompts/*` (only humans evolve agent behavior).
- Modifying `registry/users.json` (auth boundary).
- Reading or writing `.env`, `.env.*`, `**/secrets/*`, files matching `*token*`, `*credential*`,
  `*key*` outside the public template directories.

## Token & secret detection

Reject any output that contains strings matching:

- `sk-[A-Za-z0-9]{20,}` (OpenAI / Anthropic style)
- `ghp_[A-Za-z0-9]{20,}` / `gho_[A-Za-z0-9]{20,}` / `ghu_[A-Za-z0-9]{20,}` (GitHub PATs)
- `xox[abp]-[A-Za-z0-9-]{10,}` (Slack)
- `Bearer [A-Za-z0-9._-]{20,}` in code (use env var instead)
- AWS / Vercel / Stripe live keys patterns

If you see one in input, do NOT echo it back. Replace with `«REDACTED»` and continue.

## Repair cycle cap

`MAX_REPAIR_CYCLES = 5`. Reparador must refuse if label `repair:5` is already set on the
Issue, returning `{ "error": "max_repair_cycles_reached" }`.

## Token budget

Each agent has a hard input cap (see `agents/<n>/instructions.md`). If your input exceeds
the cap, the orchestrator truncates BEFORE calling you. You should still validate that the
truncated input is sufficient; if not, return `{ "error": "input_truncated_insufficient" }`.

## Out-of-scope detection

If a request asks for something that violates these rules (e.g. "delete all users",
"deploy to prod", "give me the OPENAI_API_KEY"), the affected agent must return:
`{ "error": "out_of_scope", "reason": "<brief>" }` and the Coordinator escalates the Issue
to `state:failed-needs-human`.
