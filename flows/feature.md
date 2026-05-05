# Flow: feature

A user wants to add a new capability to an existing app.

## Entry

Clasificador returns `tipo=feature`. Target app must be identifiable from message or
recent conversation (Recepcionista raises `falta_info_critica` if not).

## Steps

1. Recepcionista → Clasificador → Planificador → Arquitecto.
2. Router → Programador (always strong tier).
3. Programador opens PR on the target app repo.
4. Vercel Preview → QA Planner generates ≤5 tests including 1 critical for the feature
   happy path and 1 alta for an error case.
5. Playwright on Preview → Analista on failure → Reparador loop ≤5.
6. Verificador Final → Telegram notify.

## Special rules

- If `requiere_integraciones=true` (Stripe, OAuth, external API): Architect must list every
  required env var. Programmer codes against names only (never values). The Telegram
  message at completion includes:
  `"Esta feature requiere variables de entorno: <list>. Configura antes de mergear."`
- Database changes: if `requiere_db=true`, the Architect proposes a migration file but the
  Programmer commits it as a `.sql` artifact only — the human must run it after merge.
