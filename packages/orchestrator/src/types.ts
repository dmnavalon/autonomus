/**
 * Core domain types for the orchestrator.
 * Keep these minimal — Zod schemas in src/schemas/ are the source of truth
 * for cross-agent JSON shapes.
 */

export type AgentName =
  | 'recepcionista'
  | 'clasificador'
  | 'planificador'
  | 'arquitecto'
  | 'router'
  | 'programador'
  | 'revisor_codigo'
  | 'qa_planner'
  | 'playwright'
  | 'analista_logs'
  | 'reparador'
  | 'verificador';

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
