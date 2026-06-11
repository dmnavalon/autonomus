import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock only generateObject; keep the real error classes so instanceof checks work.
vi.mock('ai', async (importOriginal) => {
  const actual = await importOriginal<typeof import('ai')>();
  return { ...actual, generateObject: vi.fn() };
});

import { generateObject, NoObjectGeneratedError, APICallError } from 'ai';
import { z } from 'zod';
import { callAgentLLM, isRetryableLlmError } from '../../packages/orchestrator/src/tools/llm';

const generateObjectMock = vi.mocked(generateObject);

const schema = z.object({ ok: z.boolean() });

function okResult(partial?: { inputTokens?: number; outputTokens?: number }) {
  return {
    object: { ok: true },
    usage: { inputTokens: partial?.inputTokens ?? 100, outputTokens: partial?.outputTokens ?? 10 },
    providerMetadata: undefined,
  } as never;
}

function noObjectError(usage?: { inputTokens: number; outputTokens: number }) {
  return new NoObjectGeneratedError({
    message: 'No object generated: the model did not return a response.',
    usage: usage
      ? { inputTokens: usage.inputTokens, outputTokens: usage.outputTokens, totalTokens: usage.inputTokens + usage.outputTokens }
      : undefined,
  } as never);
}

describe('isRetryableLlmError', () => {
  it('retries NoObjectGeneratedError', () => {
    expect(isRetryableLlmError(noObjectError())).toBe(true);
  });

  it('retries 429/5xx APICallError, not 4xx', () => {
    const make = (statusCode: number, isRetryable = false) =>
      new APICallError({
        message: `status ${statusCode}`,
        url: 'https://gateway',
        requestBodyValues: {},
        statusCode,
        isRetryable,
      });
    expect(isRetryableLlmError(make(429))).toBe(true);
    expect(isRetryableLlmError(make(500))).toBe(true);
    expect(isRetryableLlmError(make(503))).toBe(true);
    expect(isRetryableLlmError(make(400))).toBe(false);
    expect(isRetryableLlmError(make(401))).toBe(false);
  });

  it('does not retry arbitrary errors', () => {
    expect(isRetryableLlmError(new Error('schema bug'))).toBe(false);
  });
});

describe('callAgentLLM retry loop', () => {
  beforeEach(() => {
    generateObjectMock.mockReset();
  });

  it('returns on first success', async () => {
    generateObjectMock.mockResolvedValueOnce(okResult());
    const r = await callAgentLLM({
      agent: 'planificador',
      model: 'anthropic/claude-sonnet-4-6',
      systemPrefix: 'sys',
      userInput: '{"x":1}',
      schema,
    });
    expect(r.output).toEqual({ ok: true });
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it('retries after NoObjectGeneratedError and accumulates wasted usage', async () => {
    generateObjectMock
      .mockRejectedValueOnce(noObjectError({ inputTokens: 50, outputTokens: 5 }))
      .mockResolvedValueOnce(okResult({ inputTokens: 100, outputTokens: 10 }));

    const r = await callAgentLLM({
      agent: 'planificador',
      model: 'anthropic/claude-sonnet-4-6',
      systemPrefix: 'sys',
      userInput: '{"x":1}',
      schema,
    });

    expect(generateObjectMock).toHaveBeenCalledTimes(2);
    expect(r.output).toEqual({ ok: true });
    // 50 wasted + 100 real input; 5 wasted + 10 real output
    expect(r.usage.inputTokens).toBe(150);
    expect(r.usage.outputTokens).toBe(15);
  });

  it('gives up after exhausting retries', async () => {
    generateObjectMock.mockRejectedValue(noObjectError());
    await expect(
      callAgentLLM({
        agent: 'planificador',
        model: 'anthropic/claude-sonnet-4-6',
        systemPrefix: 'sys',
        userInput: '{"x":1}',
        schema,
      }),
    ).rejects.toThrow(/No object generated/);
    expect(generateObjectMock).toHaveBeenCalledTimes(3); // 1 + 2 retries
  });

  it('does not retry non-retryable errors', async () => {
    generateObjectMock.mockRejectedValue(new Error('bad schema'));
    await expect(
      callAgentLLM({
        agent: 'planificador',
        model: 'anthropic/claude-sonnet-4-6',
        systemPrefix: 'sys',
        userInput: '{"x":1}',
        schema,
      }),
    ).rejects.toThrow('bad schema');
    expect(generateObjectMock).toHaveBeenCalledTimes(1);
  });

  it('tames gpt-5: minimal reasoning effort, no temperature', async () => {
    generateObjectMock.mockResolvedValueOnce(okResult());
    await callAgentLLM({
      agent: 'programador',
      model: 'openai/gpt-5',
      systemPrefix: 'sys',
      userInput: '{"x":1}',
      schema,
      temperature: 0.2,
    });
    const args = generateObjectMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.temperature).toBeUndefined();
    expect(args.providerOptions).toMatchObject({ openai: { reasoningEffort: 'minimal' } });
  });

  it('keeps temperature and skips openai options for anthropic models', async () => {
    generateObjectMock.mockResolvedValueOnce(okResult());
    await callAgentLLM({
      agent: 'clasificador',
      model: 'anthropic/claude-haiku-4-5',
      systemPrefix: 'sys',
      userInput: '{"x":1}',
      schema,
      temperature: 0.1,
    });
    const args = generateObjectMock.mock.calls[0]![0] as Record<string, unknown>;
    expect(args.temperature).toBe(0.1);
    expect((args.providerOptions as Record<string, unknown>).openai).toBeUndefined();
  });
}, 30_000);
