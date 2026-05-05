# Flow: bug

A user reports something is broken in an existing app.

## Entry

Clasificador returns `tipo=bug`. Target app required.

## Steps

1. Recepcionista → Clasificador.
2. Planificador writes a single acceptance criterion: "behavior X works as expected".
3. Arquitecto identifies suspect files (typically ≤3) by grep / pattern-match against the
   user description.
4. Programador minimal-fix on `factory/<n>`. Tests: 1 regression test that fails on `main`
   and passes on `factory/<n>`.
5. Standard QA + repair loop.

## Special rules

- **Never enlarge scope.** If a bug fix opens up an architectural concern, the Programmer
  flags it in the PR description but does NOT fix it in this PR.
- If the Architect cannot identify suspect files (no patterns match), Coordinator escalates
  to `state:failed-needs-human` with reason "bug location unidentifiable".
- Bugs in auth, payments, or destructive ops → `riesgo=alto`, Architect mandatory strong
  tier, repair loop capped at 3 (not 5).
