import { describe, it, expect } from 'vitest';
import {
  currentState,
  currentTypeLabel,
  currentRepairAttempt,
} from '../../packages/orchestrator/src/state/labels';
import { parseTelegramJobBody } from '../../packages/orchestrator/src/tools/github';

describe('state machine labels', () => {
  it('currentState picks first state:* label', () => {
    expect(currentState(['state:received', 'source:telegram'])).toBe('state:received');
    expect(currentState(['type:bug', 'state:planning'])).toBe('state:planning');
    expect(currentState(['type:bug'])).toBeNull();
  });

  it('currentTypeLabel finds type:*', () => {
    expect(currentTypeLabel(['type:bug', 'state:received'])).toBe('type:bug');
    expect(currentTypeLabel(['state:received'])).toBeNull();
  });

  it('currentRepairAttempt parses N from repair:N', () => {
    expect(currentRepairAttempt(['repair:0'])).toBe(0);
    expect(currentRepairAttempt(['state:repairing', 'repair:3'])).toBe(3);
    expect(currentRepairAttempt(['state:received'])).toBe(0);
  });
});

describe('parseTelegramJobBody', () => {
  const body = `<!-- Created by Autonomus Telegram webhook. Do NOT edit by hand; comments below are written by agents. -->

## Solicitud original

> No funciona cerrar sesión

## Metadata

- chat_id: \`8676856542\`
- username: \`Diego\`
- received_at: \`2026-05-05T19:18:37.866Z\``;

  it('extracts the original message', () => {
    expect(parseTelegramJobBody(body).rawText).toBe('No funciona cerrar sesión');
  });

  it('extracts chat_id as a number', () => {
    expect(parseTelegramJobBody(body).chatId).toBe(8676856542);
  });

  it('extracts username when present', () => {
    expect(parseTelegramJobBody(body).username).toBe('Diego');
  });

  it('returns undefined username when "(none)"', () => {
    const b = body.replace('`Diego`', '`(none)`');
    expect(parseTelegramJobBody(b).username).toBeUndefined();
  });

  it('returns null appSlug when missing or pending', () => {
    expect(parseTelegramJobBody(body).appSlug).toBeNull();
    const pending = body.replace('username: `Diego`', 'username: `Diego`\n- app_slug: `(pending)`');
    expect(parseTelegramJobBody(pending).appSlug).toBeNull();
  });

  it('extracts app_slug when present', () => {
    const withSlug = body.replace(
      'username: `Diego`',
      'username: `Diego`\n- app_slug: `mi-tienda`',
    );
    expect(parseTelegramJobBody(withSlug).appSlug).toBe('mi-tienda');
  });
});
