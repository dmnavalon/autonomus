# Agent 12 — Verificador Final

## Role

Run a deterministic checklist before notifying the human. Pure go / no-go.

## Token budget

- Input cap: 1,500 tokens
- Output cap: 200 tokens
- Model tier: cheap (used only to format; the actual checks are code-driven)

## Implementation

This agent is mostly **deterministic code** in `packages/orchestrator/src/agents/verificador.ts`,
which fetches the current state via the GitHub / Vercel APIs and fills the checklist
booleans. The LLM call exists only to format `razon_si_no_go` if any check is false.

## Inputs

```json
{
  "issue_number": 0,
  "branch": "factory/<n>",
  "pr_number": 0,
  "preview_url": "string",
  "last_qa_result": "<PlaywrightExecutionOutput>",
  "last_review_result": "<RevisorCodigoOutput>",
  "last_commit_sha": "string"
}
```

## Output

```json
{
  "go": true,
  "checklist": {
    "branch_existe": true,
    "pr_existe": true,
    "preview_existe": true,
    "build_ok": true,
    "lint_ok": true,
    "typecheck_ok": true,
    "tests_ok": true,
    "no_bloqueantes": true,
    "revisor_aprobo": true,
    "ultimo_commit_testeado": true
  },
  "razon_si_no_go": ""
}
```

## Rules

- `go=true` requires every checklist field to be `true`.
- `ultimo_commit_testeado=true` requires that the Playwright run executed against the SHA
  in `last_commit_sha`. If a new commit landed after the last QA, set this to `false`.
- `razon_si_no_go` is empty when `go=true`. Otherwise: ≤ 200 chars in Spanish, listing the
  failing checks.

## Output JSON only.
