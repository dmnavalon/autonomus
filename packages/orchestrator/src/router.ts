/**
 * Deterministic model selection. No LLM calls — pure function of agent name +
 * job characteristics.  Source: agents/05-router-modelos/instructions.md.
 */
import type { AgentName, ModelTier, Complejidad, Riesgo } from './types.js';

const MODEL_BY_TIER: Record<ModelTier, string> = {
  cheap: process.env.MODEL_CHEAP  ?? 'anthropic/claude-haiku-4-5',
  mid:   process.env.MODEL_MID    ?? 'openai/gpt-5',
  strong: process.env.MODEL_STRONG ?? 'anthropic/claude-opus-4-7',
};

const DEFAULT_TIER: Record<AgentName, ModelTier> = {
  // Phase-3 LLM agents
  recepcionista:    'cheap',
  clasificador:     'cheap',
  qa_planner:       'cheap',
  verificador:      'cheap',
  router:           'cheap',
  planificador:     'mid',
  arquitecto:       'mid',
  revisor_codigo:   'mid',
  analista_logs:    'mid',
  programador:      'strong',
  reparador:        'strong',
  playwright:       'mid',
  // Doc-maestro additions. Deterministic agents map to 'cheap' as a placeholder
  // (chooseModel is never called for them; their agent functions skip the LLM).
  coordinador:           'cheap', // pure orchestration, no LLM
  protocol_binder:       'cheap',
  github_operator:       'cheap', // deterministic
  telegram_notifier:     'cheap', // deterministic
  factory_evaluator:     'mid',
  security_scope_guard:  'cheap', // deterministic + rules; LLM tiebreaker mid
  prompt_change_manager: 'cheap',
};

export interface RouterContext {
  complejidad?: Complejidad;
  riesgo?: Riesgo;
  prDiffLoc?: number;
  bloqueante?: boolean;
  repairAttempt?: number;
}

export interface ModelChoice {
  tier: ModelTier;
  model: string;
  reasoningEnabled: boolean;
}

export function chooseModel(agent: AgentName, ctx: RouterContext = {}): ModelChoice {
  let tier = DEFAULT_TIER[agent];

  // Upgrade rules per agent.
  if (agent === 'arquitecto' && (ctx.complejidad === 'alta' || ctx.riesgo === 'alto')) {
    tier = 'strong';
  }
  if (agent === 'revisor_codigo' && (ctx.prDiffLoc ?? 0) > 1000) {
    tier = 'strong';
  }
  if (agent === 'analista_logs' && ctx.bloqueante === true) {
    tier = 'strong';
  }
  // Doc-maestro additions
  if (agent === 'protocol_binder' && (ctx.prDiffLoc ?? 0) > 5) {
    // > 5 agents simultaneously changed → bump to mid for cross-impact analysis
    tier = 'mid';
  }
  if (agent === 'security_scope_guard' && ctx.bloqueante === true) {
    // ambiguous case requiring textual analysis
    tier = 'mid';
  }
  if (agent === 'prompt_change_manager' && (ctx.prDiffLoc ?? 0) >= 3) {
    // ≥ 3 agents impacted → bump to mid
    tier = 'mid';
  }

  const reasoningEnabled = agent === 'reparador' && (ctx.repairAttempt ?? 0) >= 3;

  return { tier, model: MODEL_BY_TIER[tier], reasoningEnabled };
}
