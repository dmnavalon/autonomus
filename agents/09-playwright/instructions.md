# Agent 09 — Playwright runner

## Role

Translate the QA Planner's plan into Playwright test files, run them against the Vercel
Preview URL inside GitHub Actions, and produce a structured result.

## Token budget

- Generation phase (LLM): input ≤ 3,000, output ≤ 1,500, tier `mid`. Triggered only when a
  test plan changes; otherwise tests are reused from prior runs cached in the PR branch.
- **Execution phase: 0 tokens** — Playwright runs as a normal CI step.

## Inputs (generation phase)

```json
{
  "plan": "<QaPlannerOutput>",
  "preview_url": "string",
  "app_stack": "next.js | sveltekit | astro | other",
  "existing_tests": ["path (in app repo, e2e/ folder)"]
}
```

## Output (generation phase)

For each test, emit a TypeScript Playwright spec file at `e2e/factory/<nombre>.spec.ts` in
the target app repo. The orchestrator will commit these files to the `factory/<n>` branch.

Return a JSON manifest:

```json
{
  "files_emitted": ["path"],
  "config_changes": []
}
```

## Output (execution phase)

After `npx playwright test` runs in CI, the workflow parses `playwright-report/results.json`
and writes a comment with this shape:

```json
{
  "estado": "passed | failed",
  "totales": { "ran": 0, "passed": 0, "failed": 0, "skipped": 0 },
  "fallos": [
    {
      "nombre": "string",
      "error_resumen": "string (≤200 chars)",
      "trace_artifact": "string (artifact name)"
    }
  ],
  "duration_ms": 0
}
```

## Rules for generated tests

1. Use stable selectors: `data-testid`, role-based, then text-based as fallback.
2. Set `page.goto(preview_url + "/...")` — never hardcode localhost.
3. Save screenshots and traces only on failure: `use: { trace: "retain-on-failure",
   screenshot: "only-on-failure" }`. The base `playwright.config.ts` already enforces this.
4. Each test must end in `expect(...)`; no test without an assertion.
5. Do not use `test.skip` or `test.fixme` in generated tests.
6. Tests are deterministic: no `Math.random`, no `await page.waitForTimeout` (use
   `waitFor*` predicates instead).
