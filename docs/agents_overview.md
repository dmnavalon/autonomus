# Capa de agentes — Software Factory Agent

Tabla resumen de los 19 agentes definidos en el documento maestro
(sec. 7). Cada agente tiene su `instructions.md` en `agents/<folder>/`,
y su entrada en `agents/00_agent_manifest.yml`.

| agent_id | Nombre | folder | Parte del sistema | Rol resumido | Protocolos mínimos |
|---|---|---|---|---|---|
| 01_coordinator | Coordinador General | 13-coordinador | orquestacion | Decide siguiente agente, controla estado, loops, labels, handoffs y cierre. | 01,02,03,04,05,06,07,13,14,15 |
| 02_telegram_intake_agent | Recepcionista Telegram | 01-recepcionista | entrada_usuario | Recibe mensajes, limpia texto, crea/actualiza Issue, deriva al Clasificador. | 01,02,03,05,07,17,18 |
| 03_intent_classifier | Clasificador de Intencion | 02-clasificador | triage | Clasifica solicitud (bug, feature, software_nuevo, cambio_visual, qa, refactor, pregunta). | 01,02,04,05,07 |
| 04_requirements_pm | Planificador / PM | 03-planificador | requerimientos | Convierte solicitud en spec corta, alcance, fuera de alcance y criterios de aceptación. | 01,02,04,05,08,14,17 |
| 05_technical_architect | Arquitecto Tecnico | 04-arquitecto | diseno_tecnico | Define enfoque técnico, archivos probables, riesgos, dependencias y plan. | 02,03,05,06,10,11,16,17,18,20 |
| 06_model_context_router | Router de Modelos y Contexto | 05-router-modelos | eficiencia | Elige modelo y contexto mínimo por tarea. | 02,04,05,07,17 |
| 07_protocol_binder | Protocol Binder | 14-protocol-binder | gobierno_protocolos | Conecta cada agente con protocolos obligatorios y valida que no falte ninguno. | 02,03,04,05,15 |
| 08_github_operator | Gestor GitHub | 15-github-operator | operacion_github | Opera Issues, labels, comments, branches, commits, PRs y artifacts sin merge. | 02,03,06,10,14,15,16 |
| 09_implementation_agent | Programador Implementador | 06-programador | codigo | Implementa cambios en branch, hace commits y respeta especificación. | 02,05,06,07,08,09,10,11,16,17,18,19,20 |
| 10_code_reviewer | Revisor de Codigo | 07-revisor-codigo | revision | Revisa diff/PR contra alcance, calidad, seguridad y protocolos. | 02,05,06,07,08,09,10,11,14,16,17,20 |
| 11_qa_planner | QA Planner | 08-qa-planner | qa_plan | Crea plan de pruebas críticas y criterios de aprobación automáticos. | 02,05,08,09,12,13,14 |
| 12_playwright_agent | Agente Playwright | 09-playwright | qa_e2e | Escribe/ejecuta pruebas navegador, captura evidencia y devuelve resultados. | 02,05,08,12,13,14 |
| 13_log_analyst | Analista de Logs | 10-analista-logs | diagnostico | Analiza logs, screenshots, traces y clasifica causa de falla. | 02,05,07,12,13,17 |
| 14_repair_agent | Reparador | 11-reparador | fix_loop | Corrige errores diagnosticados y gatilla re-QA hasta límite. | 02,05,06,07,09,10,11,12,13,16,17,18,20 |
| 15_final_verifier | Verificador Final | 12-verificador-final | gate_final | Valida que PR, preview, checks y QA estén listos para revisión humana. | 01,02,03,05,12,13,14 |
| 16_telegram_notifier | Notificador Telegram | 16-telegram-notifier | comunicacion | Envía preguntas, estados, bloqueos y cierre por Telegram. | 01,02,05,14,17 |
| 17_factory_evaluator | Evaluador de Fabrica | 17-factory-evaluator | evals_agentes | Prueba clasificación, handoffs, cumplimiento de protocolos y decisiones. | 01,02,04,05,07,12,13,15 |
| 18_security_scope_guard | Guardian Seguridad y Alcance | 18-security-scope-guard | guardrails | Bloquea acciones peligrosas y cambios fuera de alcance. | 02,06,07,10,14,16,17,18,20 |
| 19_prompt_change_manager | Prompt Change Manager | 19-prompt-change-manager | prompts | Controla cambios de prompts/agentes/protocolos con versionado, impacto y evals. | 01,02,03,04,05,15 |

## Mapping `agent_id` ↔ carpeta operacional

La numeración del doc maestro y la numeración del filesystem **no coinciden**:
cada folder existe por razones operativas (Phase 0 + 3 ya en producción) y el
`agent_id` canónico vive en el frontmatter de `instructions.md`. Esta tabla es
la única fuente de verdad para resolver `agent_id → folder`.

## Estado de implementación

| agent_id | Spec (instructions.md) | Code (orchestrator) | Workflow / runtime |
|---|---|---|---|
| 01_coordinator | ✓ | `coordinator.ts` (Phase 3 + dispatcher Phase 4-7 stubs) | `orchestrator.yml` |
| 02_telegram_intake_agent | ✓ | `agents/recepcionista.ts` (LLM) + webhook real | `orchestrator.yml` |
| 03_intent_classifier | ✓ | `agents/clasificador.ts` (LLM) | `orchestrator.yml` |
| 04_requirements_pm | ✓ | `agents/planificador.ts` (LLM) | `orchestrator.yml` |
| 05_technical_architect | ✓ | `agents/arquitecto.ts` (LLM) | `orchestrator.yml` |
| 06_model_context_router | ✓ | `router.ts` (deterministic) | inline en cada agente |
| 07_protocol_binder | ✓ | `agents/protocol_binder.ts` (LLM stub) | `evals.yml` (Phase 4) |
| 08_github_operator | ✓ | `agents/github_operator.ts` + `tools/github.ts` (deterministic) | invocado por agentes que tocan GitHub |
| 09_implementation_agent | ✓ | `agents/programador.ts` (LLM stub) | `orchestrator.yml` (Phase 4) |
| 10_code_reviewer | ✓ | `agents/revisor_codigo.ts` (LLM stub) | `orchestrator.yml` (Phase 4) |
| 11_qa_planner | ✓ | `agents/qa_planner.ts` (LLM stub) | `orchestrator.yml` (Phase 5) |
| 12_playwright_agent | ✓ | `agents/playwright.ts` (LLM stub) + workflow CI | `qa-playwright.yml` |
| 13_log_analyst | ✓ | `agents/analista_logs.ts` (LLM stub) | `orchestrator.yml` (Phase 6) |
| 14_repair_agent | ✓ | `agents/reparador.ts` (LLM stub) | `repair-cycle.yml` |
| 15_final_verifier | ✓ | `agents/verificador.ts` (deterministic) | `orchestrator.yml` (Phase 7) |
| 16_telegram_notifier | ✓ | `agents/telegram_notifier.ts` (deterministic) | `notify-telegram.yml` (reusable) |
| 17_factory_evaluator | ✓ | `agents/factory_evaluator.ts` (LLM stub) | `evals.yml` |
| 18_security_scope_guard | ✓ | `agents/security_scope_guard.ts` (deterministic + regex) | invocado por agentes pre-action |
| 19_prompt_change_manager | ✓ | `agents/prompt_change_manager.ts` (deterministic) | `prompt-change.yml` |

## Documento maestro

Capa de agentes especificada en `documento_maestro_agentes_software_factory.docx`
(sec. 4 formato, sec. 7 catálogo, sec. 8 spec detallada por agente,
sec. 9 matriz protocolos, sec. 11 evals).
