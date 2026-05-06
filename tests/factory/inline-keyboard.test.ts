/**
 * Legacy keyboard tests (Phase 3.5). Phase-3.6 builders are tested in
 * inline-keyboard-v2.test.ts; the `onboard:*` shape was replaced by `start:*`.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAppSelectionKeyboard,
  parseCallbackData,
} from '../../packages/telegram-webhook/lib/inline-keyboard';
import type { RegistryApp } from '../../packages/telegram-webhook/lib/registry';

const A: RegistryApp = { slug: 'a', repo: 'x/a', default_branch: 'main', stack: 'nextjs' };
const B: RegistryApp = { slug: 'b', repo: 'x/b', default_branch: 'main', stack: 'nextjs' };
const C: RegistryApp = { slug: 'c', repo: 'x/c', default_branch: 'main', stack: 'nextjs' };

describe('inline-keyboard (legacy)', () => {
  it('buildAppSelectionKeyboard wraps 2 buttons per row', () => {
    const kb = buildAppSelectionKeyboard([A, B, C], 42);
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    expect(kb.inline_keyboard[1]).toHaveLength(1);
    expect(kb.inline_keyboard[0]?.[0]?.callback_data).toBe('pick:a:42');
  });

  it('parseCallbackData parses pick:<slug>:<issue>', () => {
    const r = parseCallbackData('pick:my-app:7');
    expect(r).toEqual({ kind: 'pick', slug: 'my-app', issueNumber: 7 });
  });

  it('parseCallbackData returns unknown on bad input', () => {
    expect(parseCallbackData('garbage').kind).toBe('unknown');
    expect(parseCallbackData('pick:').kind).toBe('unknown');
  });

  it('callback_data fits in 64 bytes for realistic slugs', () => {
    const long = 'a'.repeat(30);
    const data = `pick:${long}:99999`;
    expect(data.length).toBeLessThanOrEqual(64);
    expect(parseCallbackData(data).kind).toBe('pick');
  });
});
