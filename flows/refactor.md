# Flow: refactor

A user asks to clean up or restructure code without changing behavior.

## Entry

Clasificador returns `tipo=refactor`.

## Steps

1. Recepcionista → Clasificador.
2. Planificador writes acceptance criteria as **invariants**: "behavior X is unchanged
   before/after". The factory uses the existing test suite (or generates one) as the
   regression baseline.
3. Arquitecto lists files involved and the structural change (e.g., "extract `lib/auth.ts`
   helpers into `lib/auth/session.ts` and `lib/auth/cookies.ts`").
4. Programador refactors. Tests must be 100% green BEFORE and AFTER on the target app's
   existing suite.
5. QA Planner re-runs the existing E2E suite (no new tests added).
6. Playwright on Preview → Analista on failure → Reparador loop ≤5.

## Special rules

- **Behavior must not change.** The Revisor de Código rejects PRs where any non-test source
  diff implies a behavioral change unless explicitly listed in the spec.
- If the app has no existing test coverage, Coordinator escalates to
  `state:failed-needs-human` with reason "refactor without tests is unsafe".
- Refactors are always `riesgo=medio` minimum, repair loop capped at 3.
