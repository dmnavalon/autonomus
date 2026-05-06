# 04 — Diseño de agentes y handoffs

**Aplicación**: Obligatorio para Coordinador, Clasificador, Protocol Binder,
Evaluador de Fábrica y cualquier agente que derive trabajo.

## Reglas

1. Cada agente debe tener una única responsabilidad principal.
2. Cada handoff debe tener entrada / salida definida (frontmatter `input_contract` /
   `output_contract`).
3. El Coordinador decide el siguiente paso; los agentes NO deben autoactivar flujos no
   permitidos.
4. Cada agente debe declarar `forbidden_actions`.
5. Los handoffs deben ser evaluables con tests de decision boundary.

## Estructura de un handoff válido

```json
{
  "next_agent": "<agent_id>",
  "next_action": "invoke | wait | finalize | escalate",
  "required_context": { "spec": "...", "diff": "..." },
  "status_label": "state:<canónico>",
  "user_message_if_needed": null
}
```

## Anti-patrones

- Agente que llama a otro agente directamente sin pasar por el Coordinador.
- Handoff sin `evidence_refs` → no se puede auditar la decisión.
- `next_agent` inventado (no existe en `00_agent_manifest.yml`).
- `status_label` no canónico (no está en `scripts/setup-labels.sh`).

## Decision boundary tests (eval suite)

Cada handoff_to declarado en frontmatter debe tener al menos un caso en
`evals/handoff_evals.yml`:

```yaml
- case_id: bug_to_planner
  input: { tipo: "bug", complejidad: "baja" }
  expected_next_agent: "04_requirements_pm"
```
