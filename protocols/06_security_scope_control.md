# 06 — Seguridad y control de alcance

**Aplicación**: Obligatorio para Programador, Reparador, GitHub Operator, Arquitecto y
Guardian Seguridad y Alcance.

## Reglas

1. Prohibido `merge_to_main` automático.
2. Prohibido `deploy_production` automático.
3. Prohibido tocar secrets, billing, roles, permisos o bases productivas sin aprobación humana.
4. Prohibido ampliar alcance respecto de la solicitud aprobada.
5. Si una acción es riesgosa, marcar `blocked_needs_human` y derivar al Guardian.

## Lista de acciones prohibidas (canónica)

```
merge_to_main
deploy_production
force_push_main
modify_branch_protection
rotate_secrets
edit_secrets
bypass_human_approval
delete_branch_main
```

## Pre-flight checks (Guardian)

- Regex blocklist sobre `proposed_action`.
- Regex sweep sobre `diff_summary` para secrets:
  - `AKIA[A-Z0-9]{16}` (AWS)
  - `ghp_[A-Za-z0-9]{36,}` (GitHub PAT)
  - `xox[baprs]-[A-Za-z0-9-]+` (Slack)
  - `sk-[A-Za-z0-9]{40,}` (OpenAI / Anthropic)
  - `AIza[0-9A-Za-z_-]{35}` (Google)
  - `-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----`
- Operaciones DESTRUCTIVE_DB: `DROP TABLE`, `TRUNCATE`, `DELETE FROM \w+ ;` sin WHERE.

## Greylist (LLM tiebreaker)

Paths sensibles que requieren análisis textual:

- `app/api/auth/`, `app/api/stripe/`, `app/api/billing/`
- `.env*`
- Migraciones SQL
- Deps con licencias GPL / AGPL

## Política

| Severity | `allowed` | `required_human_approval` |
|---|---|---|
| `critical` | false | true |
| `high` | true (con warning) | true |
| `medium` | true | false (con remediation) |
| `low` | true | false |
