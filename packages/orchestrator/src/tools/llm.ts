/**
 * Vercel AI Gateway client wrapper.
 *
 * - Uses the AI SDK v6 `generateObject` with Zod schema validation.
 * - Sends a stable system prefix (cacheable) + variable user prompt.
 * - Records `inputTokens / outputTokens / cachedInputTokens` and computes
 *   USD cost via budget.PRICE_PER_M_TOKENS.
 * - Honors agent input cap before issuing the request (no over-budget calls).
 *
 * Caching strategy: pass the prefix as `system`. Anthropic enables prompt
 * cache via providerOptions; OpenAI caches automatically when the prefix
 * matches a recent request. Cache hits show up as `cachedInputTokens > 0`.
 */
import { generateObject, type LanguageModel } from 'ai';
import type { z } from 'zod';
import { AGENT_CAPS, BudgetExceededError, estimateCost } from '../budget.js';
import type { AgentName, AgentUsage } from '../types.js';

export interface LlmCallInput<T> {
  agent: AgentName;
  model: string;
  systemPrefix: string;
  userInput: string;
  schema: z.ZodSchema<T>;
  temperature?: number;
}

export interface LlmCallOutput<T> {
  output: T;
  usage: AgentUsage;
}

export async function callAgentLLM<T>(input: LlmCallInput<T>): Promise<LlmCallOutput<T>> {
  const cap = AGENT_CAPS[input.agent];
  // Cap applies to the variable user input only; the systemPrefix
  // (shared/system + shared/safety + agents/<n>/instructions.md) is stable across
  // calls and cached by the provider (Anthropic ephemeral, OpenAI auto), so it
  // amortises to ~10% effective cost. Counting it here would double-charge
  // the very thing prompt-caching is designed to make cheap.
  const approxUserInputTokens = Math.ceil(input.userInput.length / 4);
  if (approxUserInputTokens > cap.inputTokens) {
    throw new BudgetExceededError('agent_input');
  }

  const result = await generateObject({
    // The AI SDK accepts plain "provider/model" strings when AI_GATEWAY_API_KEY
    // is set in the environment.
    model: input.model as unknown as LanguageModel,
    schema: input.schema,
    system: input.systemPrefix,
    prompt: input.userInput,
    temperature: input.temperature ?? 0,
    maxOutputTokens: cap.outputTokens,
    providerOptions: {
      anthropic: {
        cacheControl: { type: 'ephemeral' },
      },
    },
  });

  // AI SDK v6 usage shape: { inputTokens, outputTokens, totalTokens, ... }.
  // Cached input may surface in providerMetadata depending on provider.
  const usage = result.usage;
  const cachedInputTokens = readCachedInputTokens(result.providerMetadata) ?? 0;

  const usd = estimateCost(input.model, {
    inputTokens: usage.inputTokens ?? 0,
    outputTokens: usage.outputTokens ?? 0,
    cachedInputTokens,
  });

  return {
    output: result.object,
    usage: {
      inputTokens: usage.inputTokens ?? 0,
      outputTokens: usage.outputTokens ?? 0,
      cachedInputTokens,
      costUsd: usd,
    },
  };
}

function readCachedInputTokens(meta: unknown): number | undefined {
  if (!meta || typeof meta !== 'object') return undefined;
  const m = meta as Record<string, unknown>;
  // Anthropic exposes cache_read_input_tokens in providerMetadata.anthropic.usage
  const a = m.anthropic as { usage?: { cacheReadInputTokens?: number } } | undefined;
  if (a?.usage?.cacheReadInputTokens != null) return a.usage.cacheReadInputTokens;
  // Some routes pass camelCase top-level
  const ant2 = m.anthropic as { cacheReadInputTokens?: number } | undefined;
  if (ant2?.cacheReadInputTokens != null) return ant2.cacheReadInputTokens;
  return undefined;
}
