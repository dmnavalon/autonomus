import { describe, it, expect } from 'vitest';
import {
  buildAppSelectionKeyboard,
  buildOnboardingKeyboard,
  parseCallbackData,
} from '../../packages/telegram-webhook/lib/inline-keyboard';
import type { RegistryApp } from '../../packages/telegram-webhook/lib/registry';

const A: RegistryApp = { slug: 'a', repo: 'x/a', default_branch: 'main', stack: 'nextjs' };
const B: RegistryApp = { slug: 'b', repo: 'x/b', default_branch: 'main', stack: 'nextjs' };
const C: RegistryApp = { slug: 'c', repo: 'x/c', default_branch: 'main', stack: 'nextjs' };

describe('inline-keyboard', () => {
  it('buildAppSelectionKeyboard wraps 2 buttons per row', () => {
    const kb = buildAppSelectionKeyboard([A, B, C], 42);
    expect(kb.inline_keyboard).toHaveLength(2);
    expect(kb.inline_keyboard[0]).toHaveLength(2);
    expect(kb.inline_keyboard[1]).toHaveLength(1);
    expect(kb.inline_keyboard[0]?.[0]?.callback_data).toBe('pick:a:42');
  });

  it('buildOnboardingKeyboard has 3 onboarding actions', () => {
    const kb = buildOnboardingKeyboard();
    const data = kb.inline_keyboard.flat().map((b) => b.callback_data);
    expect(data).toEqual(['onboard:link', 'onboard:new', 'onboard:help']);
  });

  it('parseCallbackData parses pick:<slug>:<issue>', () => {
    const r = parseCallbackData('pick:my-app:7');
    expect(r).toEqual({ kind: 'pick', slug: 'my-app', issueNumber: 7 });
  });

  it('parseCallbackData parses onboard:<action>', () => {
    expect(parseCallbackData('onboard:link')).toEqual({ kind: 'onboard', action: 'link' });
    expect(parseCallbackData('onboard:new')).toEqual({ kind: 'onboard', action: 'new' });
    expect(parseCallbackData('onboard:help')).toEqual({ kind: 'onboard', action: 'help' });
  });

  it('parseCallbackData returns unknown on bad input', () => {
    expect(parseCallbackData('garbage').kind).toBe('unknown');
    expect(parseCallbackData('pick:').kind).toBe('unknown');
    expect(parseCallbackData('onboard:invalid').kind).toBe('unknown');
  });

  it('callback_data fits in 64 bytes for realistic slugs', () => {
    // Telegram cap is 64 bytes. Slug max 30 chars + "pick:" + ":" + 5-digit issue = 41 bytes max.
    const long = 'a'.repeat(30);
    const data = `pick:${long}:99999`;
    expect(data.length).toBeLessThanOrEqual(64);
    expect(parseCallbackData(data).kind).toBe('pick');
  });
});
