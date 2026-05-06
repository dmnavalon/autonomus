import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  isAuthorizedChatId,
  loadUsersRegistry,
  __resetRegistryCache,
} from '../../packages/telegram-webhook/lib/registry';

const ORIGINAL_TOKEN = process.env.GH_AUTOMATION_TOKEN;

describe('registry loader', () => {
  beforeEach(() => {
    process.env.GH_AUTOMATION_TOKEN = 'fake-token';
    __resetRegistryCache();
  });

  afterEach(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.GH_AUTOMATION_TOKEN;
    else process.env.GH_AUTOMATION_TOKEN = ORIGINAL_TOKEN;
    vi.restoreAllMocks();
  });

  /** Wraps a JSON registry value in the shape returned by the GitHub Contents API. */
  function ghContentsResponse(value: unknown): Response {
    const content = Buffer.from(JSON.stringify(value), 'utf8').toString('base64');
    return new Response(JSON.stringify({ content, encoding: 'base64', sha: 'abc' }), {
      status: 200,
    });
  }

  it('parses users.json with multiple authorized chat_ids', async () => {
    const fixture = {
      version: 1,
      users: [
        { chat_id: 111, username: 'a', role: 'owner' },
        { chat_id: 222, username: 'b', role: 'developer' },
        { chat_id: null, username: 'c', role: 'viewer' },
      ],
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(ghContentsResponse(fixture));

    const reg = await loadUsersRegistry();
    expect(reg.users).toHaveLength(3);
    expect(reg.version).toBe(1);
  });

  it('isAuthorizedChatId returns true for known chat_id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ghContentsResponse({
        version: 1,
        users: [{ chat_id: 12345, username: 'diego', role: 'owner' }],
      }),
    );
    expect(await isAuthorizedChatId(12345)).toBe(true);
  });

  it('isAuthorizedChatId returns false for unknown chat_id', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ghContentsResponse({
        version: 1,
        users: [{ chat_id: 12345, username: 'diego', role: 'owner' }],
      }),
    );
    expect(await isAuthorizedChatId(99999)).toBe(false);
  });

  it('null chat_id placeholders never match', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      ghContentsResponse({
        version: 1,
        users: [{ chat_id: null, username: 'placeholder', role: 'owner' }],
      }),
    );
    // even passing 0 / NaN should not auth-bypass
    expect(await isAuthorizedChatId(0)).toBe(false);
    expect(await isAuthorizedChatId(Number.NaN)).toBe(false);
  });

  it('fails closed when GitHub returns an error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response('not found', { status: 404 }),
    );
    expect(await isAuthorizedChatId(12345)).toBe(false);
  });

  it('fails closed when token is missing', async () => {
    delete process.env.GH_AUTOMATION_TOKEN;
    expect(await isAuthorizedChatId(12345)).toBe(false);
  });
});
