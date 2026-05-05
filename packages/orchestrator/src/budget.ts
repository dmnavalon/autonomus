/**
 * Per-agent input/output token caps and per-job cost ceiling.
 * Source of truth for the "principio rector" of token efficiency.
 *
 * Caps mirror agents/<n>/instructions.md. If you change them here, update there too.
 */
import type { AgentName, AgentUsage } from './types.js';

export interface AgentCap {
  inputTokens: number;
  outputTokens: number;
}

export const AGENT_CAPS: Record<AgentName, AgentCap> = {
  recepcionista: { inputTokens: 2_000, outputTokens: 300 },
  clasificador: { inputTokens: 1_500, outputTokens: 200 },
  planificador: { inputTokens: 4_000, outputTokens: 800 },
  arquitecto: { inputTokens: 6_000, outputTokens: 1_200 },
  router: { inputTokens: 1_500, outputTokens: 200 },
  programador: { inputTokens: 16_000, outputTokens: 4_000 },
  revisor_codigo: { inputTokens: 8_000, outputTokens: 600 },
  qa_planner: { inputTokens: 3_000, outputTokens: 600 },
  playwright: { inputTokens: 3_000, outputTokens: 1_500 },
  analista_logs: { inputTokens: 6_000, outputTokens: 500 },
  reparador: { inputTokens: 12_000, outputTokens: 3_000 },
  verificador: { inputTokens: 1_500, outputTokens: 200 },
};

export const JOB_BUDGET = {
  inputTokens: Number(process.env.MAX_JOB_INPUT_TOKENS ?? 80_000),
  outputTokens: Number(process.env.MAX_JOB_OUTPUT_TOKENS ?? 15_000),
  costUsd: Number(process.env.MAX_JOB_COST_USD ?? 2.0),
  warnAtFraction: 0.7,
};

/**
 * Approximate USD cost per million tokens. Source: 2026-Q1 published rates from
 * Anthropic and OpenAI, accessed via Vercel AI Gateway (which adds a small markup
 * but uses the same per-token pricing). Update when pricing changes.
 */
export const PRICE_PER_M_TOKENS: Record<string, { input: number; output: number; cachedInput?: number }> = {
  'anthropic/claude-haiku-4-5':  { input: 1.0,  output: 5.0,  cachedInput: 0.1 },
  'anthropic/claude-sonnet-4-6': { input: 3.0,  output: 15.0, cachedInput: 0.3 },
  'anthropic/claude-opus-4-7':   { input: 15.0, output: 75.0, cachedInput: 1.5 },
  'openai/gpt-5-mini':           { input: 0.25, output: 2.0,  cachedInput: 0.025 },
  'openai/gpt-5':                { input: 1.25, output: 10.0, cachedInput: 0.125 },
  'openai/gpt-5-pro':            { input: 15.0, output: 60.0, cachedInput: 1.5 },
};

export function estimateCost(model: string, usage: { inputTokens: number; outputTokens: number; cachedInputTokens: number }): number {
  const price = PRICE_PER_M_TOKENS[model];
  if (!price) return 0;
  const cachedRate = price.cachedInput ?? price.input * 0.1;
  const freshInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens);
  return (
    (freshInput * price.input) / 1_000_000 +
    (usage.cachedInputTokens * cachedRate) / 1_000_000 +
    (usage.outputTokens * price.output) / 1_000_000
  );
}

export class BudgetExceededError extends Error {
  constructor(public readonly which: 'agent_input' | 'agent_output' | 'job_input' | 'job_output' | 'job_cost') {
    super(`budget_exceeded: ${which}`);
  }
}

/**
 * Verifies a planned LLM call respects the agent's input cap. If over,
 * returns false and the caller should compress / abort. Token estimate is
 * coarse: ~4 chars ≈ 1 token, see https://platform.openai.com/tokenizer.
 */
export function fitsAgentInputCap(agent: AgentName, approxText: string): boolean {
  const cap = AGENT_CAPS[agent].inputTokens;
  const estimated = Math.ceil(approxText.length / 4);
  return estimated <= cap;
}

export class JobLedger {
  totalInput = 0;
  totalOutput = 0;
  totalCachedInput = 0;
  totalCostUsd = 0;
  calls: Array<{ agent: AgentName; model: string } & AgentUsage> = [];

  record(agent: AgentName, model: string, usage: AgentUsage): void {
    this.totalInput += usage.inputTokens;
    this.totalOutput += usage.outputTokens;
    this.totalCachedInput += usage.cachedInputTokens;
    this.totalCostUsd += usage.costUsd;
    this.calls.push({ agent, model, ...usage });
  }

  status(): 'ok' | 'warning' | 'over_budget' {
    if (this.totalCostUsd >= JOB_BUDGET.costUsd) return 'over_budget';
    if (this.totalInput >= JOB_BUDGET.inputTokens) return 'over_budget';
    if (this.totalOutput >= JOB_BUDGET.outputTokens) return 'over_budget';
    if (this.totalCostUsd >= JOB_BUDGET.costUsd * JOB_BUDGET.warnAtFraction) return 'warning';
    return 'ok';
  }

  summaryMarkdown(): string {
    return [
      '| metric | value |',
      '|---|---|',
      `| total_input_tokens | ${this.totalInput.toLocaleString()} |`,
      `| total_output_tokens | ${this.totalOutput.toLocaleString()} |`,
      `| total_cached_tokens | ${this.totalCachedInput.toLocaleString()} |`,
      `| total_cost_usd | $${this.totalCostUsd.toFixed(4)} |`,
      `| status | ${this.status()} |`,
    ].join('\n');
  }
}
