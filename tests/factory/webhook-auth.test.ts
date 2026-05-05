import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isValidWebhookRequest } from '../../packages/telegram-webhook/lib/auth';

describe('webhook auth', () => {
  const original = process.env.TELEGRAM_WEBHOOK_SECRET;

  beforeEach(() => {
    process.env.TELEGRAM_WEBHOOK_SECRET = 'expected-secret-abc123';
  });

  afterEach(() => {
    if (original === undefined) delete process.env.TELEGRAM_WEBHOOK_SECRET;
    else process.env.TELEGRAM_WEBHOOK_SECRET = original;
  });

  it('rejects when no header is sent', () => {
    const req = new Request('http://x/api/telegram/webhook', { method: 'POST' });
    expect(isValidWebhookRequest(req)).toBe(false);
  });

  it('rejects when header does not match', () => {
    const req = new Request('http://x/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'wrong' },
    });
    expect(isValidWebhookRequest(req)).toBe(false);
  });

  it('rejects when env is missing', () => {
    delete process.env.TELEGRAM_WEBHOOK_SECRET;
    const req = new Request('http://x/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'anything' },
    });
    expect(isValidWebhookRequest(req)).toBe(false);
  });

  it('accepts on exact match', () => {
    const req = new Request('http://x/api/telegram/webhook', {
      method: 'POST',
      headers: { 'x-telegram-bot-api-secret-token': 'expected-secret-abc123' },
    });
    expect(isValidWebhookRequest(req)).toBe(true);
  });
});
