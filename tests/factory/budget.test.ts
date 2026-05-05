import { describe, it, expect } from 'vitest';
import {
  AGENT_CAPS,
  JobLedger,
  estimateCost,
  fitsAgentInputCap,
  JOB_BUDGET,
} from '../../packages/orchestrator/src/budget';

describe('budget', () => {
  it('every agent has positive caps', () => {
    for (const [name, cap] of Object.entries(AGENT_CAPS)) {
      expect(cap.inputTokens, `${name} input cap`).toBeGreaterThan(0);
      expect(cap.outputTokens, `${name} output cap`).toBeGreaterThan(0);
    }
  });

  it('fitsAgentInputCap rejects oversize input', () => {
    // 2000 tokens cap for recepcionista; 12000 chars ≈ 3000 tokens → too big
    expect(fitsAgentInputCap('recepcionista', 'x'.repeat(12_000))).toBe(false);
    expect(fitsAgentInputCap('recepcionista', 'short')).toBe(true);
  });

  it('estimateCost returns 0 for unknown model', () => {
    expect(
      estimateCost('unknown/model', { inputTokens: 1000, outputTokens: 500, cachedInputTokens: 0 }),
    ).toBe(0);
  });

  it('estimateCost: claude-haiku-4-5 — 1k in, 500 out, 0 cached', () => {
    // pricing: $1.0/M in, $5.0/M out → 1000*1/1M + 500*5/1M = 0.001 + 0.0025 = 0.0035
    const c = estimateCost('anthropic/claude-haiku-4-5', {
      inputTokens: 1000,
      outputTokens: 500,
      cachedInputTokens: 0,
    });
    expect(c).toBeCloseTo(0.0035, 5);
  });

  it('estimateCost discounts cached input tokens', () => {
    const noCache = estimateCost('anthropic/claude-haiku-4-5', {
      inputTokens: 1000,
      outputTokens: 0,
      cachedInputTokens: 0,
    });
    const fullCache = estimateCost('anthropic/claude-haiku-4-5', {
      inputTokens: 1000,
      outputTokens: 0,
      cachedInputTokens: 1000,
    });
    expect(fullCache).toBeLessThan(noCache);
  });

  it('JobLedger transitions through ok / warning / over_budget', () => {
    const ledger = new JobLedger();
    expect(ledger.status()).toBe('ok');

    // Push cost above 70% threshold
    ledger.record('clasificador', 'anthropic/claude-haiku-4-5', {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      costUsd: JOB_BUDGET.costUsd * 0.8,
    });
    expect(ledger.status()).toBe('warning');

    // Push cost over 100%
    ledger.record('arquitecto', 'openai/gpt-5', {
      inputTokens: 0,
      outputTokens: 0,
      cachedInputTokens: 0,
      costUsd: JOB_BUDGET.costUsd * 0.5,
    });
    expect(ledger.status()).toBe('over_budget');
  });

  it('JobLedger summaryMarkdown contains required metrics', () => {
    const ledger = new JobLedger();
    ledger.record('recepcionista', 'anthropic/claude-haiku-4-5', {
      inputTokens: 200,
      outputTokens: 50,
      cachedInputTokens: 100,
      costUsd: 0.001,
    });
    const md = ledger.summaryMarkdown();
    expect(md).toContain('total_input_tokens');
    expect(md).toContain('total_output_tokens');
    expect(md).toContain('total_cached_tokens');
    expect(md).toContain('total_cost_usd');
    expect(md).toContain('200');
    expect(md).toContain('50');
  });
});
