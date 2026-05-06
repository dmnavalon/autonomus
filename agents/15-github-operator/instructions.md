---
agent_id: "08_github_operator"
name: "Gestor GitHub"
version: "1.0"
owner: "Software Factory Agent"
system_area: "operacion_github"
folder: "15-github-operator"
required_protocols:
  - "02_no_hallucination_evidence.md"
  - "03_github_first_source_of_truth.md"
  - "06_security_scope_control.md"
  - "10_secrets_env_vars.md"
  - "14_human_approval_release.md"
  - "15_prompt_change_management.md"
  - "16_dependency_supply_chain.md"
allowed_tools:
  - "github.issue.read"
  - "github.issue.create"
  - "github.issue.comment"
  - "github.labels.add"
  - "github.labels.update"
  - "github.branch.create"
  - "github.commit.create"
  - "github.pr.create"
  - "github.pr.comment"
  - "github.checks.read"
  - "artifacts.upload"
  - "artifacts.read"
forbidden_actions:
  - "merge_to_main"
  - "delete_branch_without_instruction"
  - "write_secret_values"
  - "force_push_main"
  - "modify_branch_protection"
input_contract:
  operation_request: "string (issue.create | branch.create | commit.create | pr.create | comment.add | labels.update | checks.rerun)"
  target_repo: "string (owner/name)"
  branch_name: "string"
  files_payload: "Record<path, content>"
  commit_message: "string"
  evidence: "Record<string, unknown>"
output_contract:
  operation_status: "ok | failed | blocked"
  refs: "{ branch?: string, commit_sha?: string, pr_number?: number, issue_number?: number }"
  urls: "Record<string, string>"
  errors: "string[]"
handoff_from:
  - "01_coordinator"
  - "09_implementation_agent"
  - "14_repair_agent"
  - "16_telegram_notifier"
handoff_to:
  - "01_coordinator"
  - "13_log_analyst"
  - "18_security_scope_guard"
success_criteria:
  - "Operación trazable y segura en GitHub"
  - "Cada operación deja audit trail (commit/comment/check)"
  - "Cero merges automáticos a main; cero force-push"
  - "Cero secrets escritos en repo o logs"
---

# Gestor GitHub

## Propósito

Ejecutar operaciones GitHub permitidas sin saltarse controles. Capa fina sobre Octokit
con guardrails: auth, rate-limit, retry, secret detection. Cualquier agente que necesite
tocar GitHub pasa por aquí.

Implementación: `packages/orchestrator/src/agents/github_operator.ts` (determinista, no LLM).
Extiende `tools/github.ts` que ya implementa `fetchIssue`, `commentOnIssue`, `transitionState`.

## Responsabilidades

1. Validar `operation_request` contra `allowed_tools`.
2. Ejecutar operación via Octokit con `GH_AUTOMATION_TOKEN` (scopes `repo, workflow` only).
3. Pre-flight checks:
   - Detect secrets en `files_payload` o `commit_message` (regex blocklist).
   - Verify branch != `main` para writes.
   - Verify base = `main` para PRs (no PRs entre branches arbitrarios).
4. Post-operation: postear comentario JSON en Issue con `evidence_refs`.
5. Retry con backoff (3 intentos) en errores transient (rate-limit, 5xx).
6. Devolver `operation_status` con refs y URLs.

## Límites y prohibiciones

- **Prohibido**: `merge_to_main`, `delete_branch_without_instruction`, `write_secret_values`, `force_push_main`, `modify_branch_protection`.
- Token: `GH_AUTOMATION_TOKEN` con scopes `repo, workflow` ÚNICAMENTE. Sin `admin`.
- NO modifica branch protection de `main`.
- NO crea webhooks ni cambia settings del repo.
- NO escribe secrets values; solo nombres si se requiere.
- **Token budget**: 0 tokens (determinista).

## Protocolo de comunicación

- `02_no_hallucination_evidence.md` — todo URL/SHA viene de respuesta real de Octokit.
- `03_github_first_source_of_truth.md` — todas las operaciones dejan rastro en Issue/PR.
- `06_security_scope_control.md` — bloquea hard contra forbidden_actions.
- `10_secrets_env_vars.md` — secret detection antes de cualquier write.
- `14_human_approval_release.md` — el merge a `main` NUNCA lo hace este agente.
- `15_prompt_change_management.md` — cambios a prompts/protocols van via PR estándar.
- `16_dependency_supply_chain.md` — package.json edits trackeados.

## Contrato de entrada

```json
{
  "operation_request": "branch.create",
  "target_repo": "dmnavalon/<app>",
  "branch_name": "factory/42",
  "files_payload": { "path/to/file": "content" },
  "commit_message": "[factory] add logout button",
  "evidence": { "issue_id": 42, "agent_id": "09_implementation_agent" }
}
```

## Contrato de salida

```json
{
  "operation_status": "ok",
  "refs": {
    "branch": "factory/42",
    "commit_sha": "abc123",
    "pr_number": 17,
    "issue_number": 42
  },
  "urls": {
    "branch": "https://github.com/...",
    "pr": "https://github.com/.../pull/17"
  },
  "errors": []
}
```

## Handoffs permitidos

- `→ 01_coordinator` (siempre: devolver resultado para próxima decisión)
- `→ 13_log_analyst` (`operation_status=failed`, error técnico)
- `→ 18_security_scope_guard` (`operation_status=blocked`, secret leak / forbidden action detectado)

## Prompt del agente

> Determinista en `packages/orchestrator/src/agents/github_operator.ts`. Reglas:

### Operaciones soportadas

- `issue.create` — crea Issue con labels iniciales (typically delegated to webhook).
- `issue.comment` — agrega comentario JSON estructurado.
- `labels.add` / `labels.update` — transitions del state machine.
- `branch.create` — crea `factory/<n>` desde `main`.
- `commit.create` — commit directo sobre branch (via Contents API).
- `pr.create` — abre PR con base=`main`, head=`factory/<n>`.
- `pr.comment` — agrega comentario en PR.
- `checks.read` — lee status checks de un SHA.
- `artifacts.upload` / `artifacts.read` — managed por GitHub Actions runner.

### Pre-flight checks

1. `files_payload` regex sweep para `AKI[A-Z0-9]{16}` (AWS), `ghp_*` (GitHub), `xoxb-*` (Slack), `sk-*` (OpenAI), etc.
2. `commit_message` no contiene secret values.
3. Branch != `main` para writes.
4. PR base == `main`, head matches `factory/<\d+>`.

### Retry policy

- Errores transient (5xx, rate-limit): retry con backoff exponencial 3 intentos (1s, 4s, 16s).
- Errores 4xx (auth, scope): no retry, devolver `failed` con detail.

## Criterios de éxito

- Operación trazable: cada call deja URL en `urls` field.
- Cero merge automático.
- Cero secrets en repo o logs.
- Pre-flight checks bloquean writes inseguros antes de la API call.

## Modos de falla

| Tipo | Detección | Acción |
|---|---|---|
| Secret detectado en payload | regex blocklist | `operation_status=blocked`, derivar Guardian |
| Forbidden action | switch sobre `operation_request` | `blocked`, no ejecutar |
| Auth fallido (401/403) | Octokit error | `failed`, derivar Analista |
| Rate-limit | 429 | retry con backoff; si persiste → `failed` infra |
| Branch protection conflict | merge attempt to `main` | bloquear hard antes de la call |
| Network timeout | 3× | `failed`, derivar Analista |

## Reglas de eficiencia de tokens

- 0 tokens (determinista).
- Telemetría: log estructurado por operación (no expone secrets).

## Tests mínimos del agente

1. Test de secret detection (futuro): payload con `AKIA...` → `blocked`.
2. Test de forbidden action (futuro): `merge_to_main` → `blocked`.
3. Test de retry (futuro): mock 429 → backoff + success.
4. Test de scope (futuro): token sin `repo` → `failed`.

### Casos de eval (Fase D, en `evals/handoff_evals.yml`)

- `branch.create` con payload limpio → `ok`, branch URL devuelta.
- `commit.create` con secret en file → `blocked`, derivar Guardian.
- `pr.create` con base=`develop` → `failed` (validation).
- 3× rate-limit consecutivos → `failed` con `errors[]`.
- `merge_to_main` solicitado → `blocked` hard.
