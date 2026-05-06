/**
 * Core domain types for the orchestrator.
 * Keep these minimal — Zod schemas in src/schemas/ are the source of truth
 * for cross-agent JSON shapes.
 *
 * AgentName covers the 19 agents defined in the doc maestro
 * (documento_maestro_agentes_software_factory.docx, sec. 7).
 * `coordinador` is the orchestrator core (no LLM); included here for
 * type completeness and so handoff_to references resolve.
 */

export type AgentName =
  // Phase-3 LLM agents (already implemented)
  | 'recepcionista'        // 02_telegram_intake_agent
  | 'clasificador'         // 03_intent_classifier
  | 'planificador'         // 04_requirements_pm
  | 'arquitecto'           // 05_technical_architect
  // Phase-3 deterministic / placeholder
  | 'router'               // 06_model_context_router
  // Pipeline agents (Phase 4+)
  | 'programador'          // 09_implementation_agent
  | 'revisor_codigo'       // 10_code_reviewer
  | 'qa_planner'           // 11_qa_planner
  | 'playwright'           // 12_playwright_agent
  | 'analista_logs'        // 13_log_analyst
  | 'reparador'            // 14_repair_agent
  | 'verificador'          // 15_final_verifier
  // Doc-maestro additions
  | 'coordinador'          // 01_coordinator (orchestrator core, no LLM)
  | 'protocol_binder'      // 07_protocol_binder
  | 'github_operator'      // 08_github_operator (deterministic)
  | 'telegram_notifier'    // 16_telegram_notifier (deterministic)
  | 'factory_evaluator'    // 17_factory_evaluator
  | 'security_scope_guard' // 18_security_scope_guard (deterministic+rules)
  | 'prompt_change_manager'; // 19_prompt_change_manager (deterministic)

export type ModelTier = 'cheap' | 'mid' | 'strong';

export type Tipo =
  | 'software_nuevo'
  | 'feature'
  | 'bug'
  | 'cambio_visual'
  | 'qa_only'
  | 'refactor'
  | 'pregunta'
  | 'desconocido';

export type Complejidad = 'baja' | 'media' | 'alta';
export type Riesgo = 'bajo' | 'medio' | 'alto';

export interface JobContext {
  issueNumber: number;
  repo: { owner: string; name: string };
  rawText: string;
  chatId: number;
  username: string | undefined;
}

export interface AgentUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  costUsd: number;
}

export interface AgentInvocationResult<T> {
  agent: AgentName;
  model: string;
  output: T;
  usage: AgentUsage;
}
