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
import { generateObject, APICallError, NoObjectGeneratedError, type LanguageModel } from 'ai';
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

  // Failed attempts still consume provider tokens; accumulate their usage so
  // telemetry never under-reports what the job actually spent.
  let wastedInput = 0;
  let wastedOutput = 0;
  let wastedCached = 0;
  let lastError: unknown;

  for (let attempt = 0; attempt <= LLM_MAX_RETRIES; attempt++) {
    try {
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
      const cachedInputTokens = (readCachedInputTokens(result.providerMetadata) ?? 0) + wastedCached;
      const inputTokens = (usage.inputTokens ?? 0) + wastedInput;
      const outputTokens = (usage.outputTokens ?? 0) + wastedOutput;

      const usd = estimateCost(input.model, { inputTokens, outputTokens, cachedInputTokens });

      return {
        output: result.object,
        usage: { inputTokens, outputTokens, cachedInputTokens, costUsd: usd },
      };
    } catch (err) {
      lastError = err;
      if (err instanceof BudgetExceededError || !isRetryableLlmError(err) || attempt === LLM_MAX_RETRIES) {
        throw err;
      }
      const partial = readUsageFromError(err);
      wastedInput += partial.inputTokens;
      wastedOutput += partial.outputTokens;
      wastedCached += partial.cachedInputTokens;
      await sleep(LLM_RETRY_BACKOFF_MS * (attempt + 1));
    }
  }

  // Unreachable (the loop either returns or throws), but keeps TS satisfied.
  throw lastError instanceof Error ? lastError : new Error('LLM call failed');
}

const LLM_MAX_RETRIES = 2;
const LLM_RETRY_BACKOFF_MS = 2_000;

/**
 * Retry on the failure modes that are transient in practice: the model
 * returning no/invalid object (NoObjectGeneratedError), provider overload
 * (429/5xx) and network hiccups. Schema/validation bugs in our own code also
 * surface as NoObjectGeneratedError, but a bounded retry is cheap and the
 * error still propagates after the last attempt.
 */
export function isRetryableLlmError(err: unknown): boolean {
  if (NoObjectGeneratedError.isInstance(err)) return true;
  if (APICallError.isInstance(err)) {
    if (err.isRetryable) return true;
    const status = err.statusCode ?? 0;
    return status === 408 || status === 429 || status >= 500;
  }
  if (err instanceof TypeError && /fetch/i.test(err.message)) return true; // network failure
  return false;
}

function readUsageFromError(err: unknown): { inputTokens: number; outputTokens: number; cachedInputTokens: number } {
  if (NoObjectGeneratedError.isInstance(err) && err.usage) {
    return {
      inputTokens: err.usage.inputTokens ?? 0,
      outputTokens: err.usage.outputTokens ?? 0,
      cachedInputTokens: 0,
    };
  }
  return { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
