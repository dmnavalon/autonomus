# Flow: qa_only

A user asks for an explicit QA pass without a code change.

## Entry

Clasificador returns `tipo=qa_only`. Target app required.

## Steps

1. Recepcionista → Clasificador.
2. **Skip Planificador, Arquitecto, Programador, Revisor.**
3. QA Planner generates up to 8 tests covering:
   - Critical user flows derived from `registry/apps.json` notes.
   - Common error paths.
   - Visual smoke (1 test).
   - Responsive smoke (1 test).
4. Playwright runs against the **current production-equivalent preview** of the app's
   `main` branch (no factory branch is created).
5. Analista produces a report.
6. **No Reparador loop**. The output is delivered to Telegram as a status report.

## Output to Telegram (terminal message)

```
QA automático ejecutado para <slug>.
Resultado: <PASS / FAIL>.
Tests ejecutados: <N>. Fallos: <M>.
Detalle: <issue url>.
```

## Special rules

- This flow does NOT open a PR.
- This flow does NOT modify code.
- If failures are found, the Coordinator does NOT auto-create a bug job. The user can send
  a follow-up "arregla los errores que encontraste" — that becomes a `bug` flow with the
  issue history as context.
