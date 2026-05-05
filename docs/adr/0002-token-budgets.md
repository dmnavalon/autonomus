# ADR 0002 — Hard token budgets per agent and per job

Date: 2026-05-05
Status: accepted

## Context

Multi-agent systems are token-expensive by default: every handoff easily duplicates
context, every retry adds full prompts. Without explicit caps, a single job can drift to
$10+ in LLM costs and slow down materially.

## Decision

1. Each agent has a **hard input cap** and **hard output cap** declared in
   `agents/<n>/instructions.md`. The orchestrator enforces these in
   `packages/orchestrator/src/budget.ts` BEFORE calling the LLM. Over-cap inputs are
   compressed (diff trimming, log extracting) or the call aborts with a typed error.
2. Each job has a **per-job hard cap**: 80k input tokens, 15k output tokens, $2 USD. At 70%
   the Coordinator labels `cost:warning`. At 100% it labels `cost:over-budget` and stops.
3. **Vercel AI Gateway** is the LLM layer. Strings of the form `provider/model` decouple
   us from any single SDK. One key (`AI_GATEWAY_API_KEY`).
4. **Prompt caching** is mandatory: stable prefix = `prompts/shared/system.md` +
   `agents/<n>/instructions.md`, variable suffix = the per-call input.
5. **Cheap by default**, strong only for `programador`/`reparador`.

## Consequences

Pros:
- Predictable cost ceiling (≤$2/job) → easy budgeting.
- Token-budget regressions caught by a vitest test (`tests/factory/token-budget.test.ts`).
- Provider-agnostic via Gateway → can swap models per agent without code changes.

Cons / accepted tradeoffs:
- Hard caps occasionally truncate context that a more permissive system might have used.
  Mitigation: typed `input_truncated_insufficient` error, escalation to mid/strong, or
  human handoff.
- Caching hits depend on input stability; we accept ~30% miss rate as acceptable (still
  much cheaper than no caching).

## Revisit

If observed mean cost per successful job stays ≤$0.30, consider raising caps to allow more
ambitious work. If $0.50+ is common, tighten further or add output-only caps.
