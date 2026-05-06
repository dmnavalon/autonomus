# 15 — Gestión de cambios de prompts

**Aplicación**: Obligatorio para Prompt Change Manager, Protocol Binder, Coordinador y
Revisor cuando se modifica un prompt / agente.

## Reglas

1. Prompts y protocolos se cambian por PR.
2. Cada cambio debe incluir motivo, impacto esperado y tests de agentes afectados.
3. NO cambiar prompts de múltiples agentes sin matriz de impacto.
4. Mantener versionado semántico de agentes / protocolos (`version: "1.2.3"` en frontmatter).
5. Correr evals de handoff y protocolo antes de aprobar.

## Version bump rules (semver)

| Tipo de cambio | Bump |
|---|---|
| frontmatter (allowed_tools, forbidden_actions, contracts, handoffs) | MAJOR |
| Prompt del agente, Reglas, Heuristics | MINOR |
| Typo, clarificación, docs, ejemplos | PATCH |

## PR description obligatoria (cambios a `agents/**` o `protocols/**`)

```markdown
## Cambio
<qué cambia, en una oración>

## Motivo
<por qué se cambia>

## Agentes impactados
- <agent_id>

## Matriz de impacto (si > 3 agentes)
| Agente | Cambio | Eval afectada |
|---|---|---|
| ... | ... | ... |

## Evals corridas
- agent_creation_evals.yml: passed
- handoff_evals.yml: passed
- protocol_compliance_evals.yml: passed
```

## Workflow de validación

`.github/workflows/prompt-change.yml`:
- Trigger: `pull_request` paths `agents/**`, `protocols/**`, `prompts/**`, `flows/**`.
- Validations:
  - Detect `impacted_agents` desde diff.
  - Si > 3 agentes → require "impact matrix" en PR description.
  - Block reduction de `forbidden_actions` (solo Guardian puede aprobar).
  - Comment summary con `19_prompt_change_manager` output.
- `factory-tests.yml` corre `tests/factory/*` en paralelo.
- `evals.yml` corre `17_factory_evaluator` cuando esos paths cambian.

## Reglas de prevención

- Cambio simultáneo en > 3 agentes sin matriz → `request_changes`.
- Cambio que reduce `forbidden_actions` → `block` (require Guardian).
- Sin `eval_results` adjunto → `request_changes`.

## Anti-patrones

- Cambio silencioso ("typo fix" que en realidad altera comportamiento).
- Skipear `factory-tests.yml`.
- Mergear sin esperar evals.
- Bumping `version` solo en frontmatter sin actualizar manifest.
