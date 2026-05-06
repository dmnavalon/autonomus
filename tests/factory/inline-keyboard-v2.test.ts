/**
 * Phase 3.6 additions: welcome screen, app type, confirm-create, GitHub repos
 * pagination, and the extended callback-data parser.
 */
import { describe, it, expect } from 'vitest';
import {
  buildAppTypeKeyboard,
  buildConfirmCreateKeyboard,
  buildGithubReposKeyboard,
  buildWelcomeKeyboard,
  parseCallbackData,
  REPOS_PER_PAGE,
} from '../../packages/telegram-webhook/lib/inline-keyboard';
import type { RegistryApp } from '../../packages/telegram-webhook/lib/registry';
import type { RepoCandidate } from '../../packages/telegram-webhook/lib/github-repos';

const A: RegistryApp = { slug: 'a', label: 'App Comercial', repo: 'x/a', default_branch: 'main', stack: 'nextjs' };
const B: RegistryApp = { slug: 'b', repo: 'x/b', default_branch: 'main', stack: 'nextjs' };

describe('buildWelcomeKeyboard', () => {
  it('uses label when present, slug otherwise', () => {
    const kb = buildWelcomeKeyboard([A, B], 0);
    const labels = kb.inline_keyboard.flat().map((b) => b.text);
    expect(labels).toContain('App Comercial'); // A's label
    expect(labels).toContain('b');             // B has no label → slug
  });

  it('always includes Crear / Vincular / Cancelar action rows', () => {
    const kb = buildWelcomeKeyboard([], 0);
    const cbs = kb.inline_keyboard.flat().map((b) => b.callback_data);
    expect(cbs).toContain('start:new');
    expect(cbs).toContain('start:link');
    expect(cbs).toContain('start:cancel');
  });

  it('encodes pending issue number in pick callback', () => {
    const kb = buildWelcomeKeyboard([A], 42);
    const pick = kb.inline_keyboard.flat().find((b) => b.callback_data.startsWith('pick:'));
    expect(pick?.callback_data).toBe('pick:a:42');
  });
});

describe('buildAppTypeKeyboard', () => {
  it('lists 6 types + cancel', () => {
    const kb = buildAppTypeKeyboard();
    const cbs = kb.inline_keyboard.flat().map((b) => b.callback_data);
    expect(cbs).toContain('apptype:web');
    expect(cbs).toContain('apptype:saas');
    expect(cbs).toContain('apptype:dashboard');
    expect(cbs).toContain('apptype:bot');
    expect(cbs).toContain('apptype:api');
    expect(cbs).toContain('apptype:otro');
    expect(cbs).toContain('cancel-wizard');
  });
});

describe('buildConfirmCreateKeyboard', () => {
  it('has Confirmar + Cancelar', () => {
    const kb = buildConfirmCreateKeyboard();
    const cbs = kb.inline_keyboard.flat().map((b) => b.callback_data);
    expect(cbs).toEqual(['confirm-create:1', 'cancel-wizard']);
  });
});

describe('buildGithubReposKeyboard', () => {
  function makeCandidates(n: number): RepoCandidate[] {
    return Array.from({ length: n }, (_, i) => ({
      owner: 'o',
      name: `r${i}`,
      full_name: `o/r${i}`,
      description: null,
      pushed_at: '',
      private: i % 2 === 0,
    }));
  }

  it('shows up to 8 repos per page with private lock icon', () => {
    const kb = buildGithubReposKeyboard(makeCandidates(10), 0);
    // 8 repo rows + nav row + cancel row
    expect(kb.inline_keyboard.length).toBe(8 + 1 + 1);
    const firstButton = kb.inline_keyboard[0]?.[0];
    expect(firstButton?.text.startsWith('🔒 ')).toBe(true);
  });

  it('renders next-only nav on first page when overflow', () => {
    const kb = buildGithubReposKeyboard(makeCandidates(20), 0);
    const nav = kb.inline_keyboard.find((row) =>
      row.some((b) => b.callback_data.startsWith('gh-page:')),
    );
    const cbs = nav!.map((b) => b.callback_data);
    expect(cbs).toEqual(['gh-page:1']);
  });

  it('renders prev-only nav on last page', () => {
    const kb = buildGithubReposKeyboard(makeCandidates(10), 1);
    const nav = kb.inline_keyboard.find((row) =>
      row.some((b) => b.callback_data.startsWith('gh-page:')),
    );
    expect(nav?.map((b) => b.callback_data)).toEqual(['gh-page:0']);
  });

  it('renders both prev and next on middle page', () => {
    const kb = buildGithubReposKeyboard(makeCandidates(30), 1);
    const nav = kb.inline_keyboard.find((row) =>
      row.some((b) => b.callback_data.startsWith('gh-page:')),
    );
    expect(nav?.map((b) => b.callback_data).sort()).toEqual(['gh-page:0', 'gh-page:2']);
  });

  it('REPOS_PER_PAGE is 8', () => {
    expect(REPOS_PER_PAGE).toBe(8);
  });
});

describe('parseCallbackData (Phase 3.6 shapes)', () => {
  it('parses start:* actions', () => {
    expect(parseCallbackData('start:new')).toEqual({ kind: 'start', action: 'new' });
    expect(parseCallbackData('start:link')).toEqual({ kind: 'start', action: 'link' });
    expect(parseCallbackData('start:cancel')).toEqual({ kind: 'start', action: 'cancel' });
  });

  it('parses apptype:<type>', () => {
    expect(parseCallbackData('apptype:web')).toEqual({ kind: 'apptype', type: 'web' });
    expect(parseCallbackData('apptype:dashboard')).toEqual({ kind: 'apptype', type: 'dashboard' });
  });

  it('rejects unknown apptype', () => {
    expect(parseCallbackData('apptype:mobile').kind).toBe('unknown');
  });

  it('parses confirm-create:1', () => {
    expect(parseCallbackData('confirm-create:1')).toEqual({ kind: 'confirm-create' });
  });

  it('parses pick-gh:<idx>', () => {
    expect(parseCallbackData('pick-gh:0')).toEqual({ kind: 'pick-gh', index: 0 });
    expect(parseCallbackData('pick-gh:7')).toEqual({ kind: 'pick-gh', index: 7 });
  });

  it('parses gh-page:<n>', () => {
    expect(parseCallbackData('gh-page:0')).toEqual({ kind: 'gh-page', page: 0 });
    expect(parseCallbackData('gh-page:3')).toEqual({ kind: 'gh-page', page: 3 });
  });

  it('parses cancel-wizard', () => {
    expect(parseCallbackData('cancel-wizard')).toEqual({ kind: 'cancel-wizard' });
  });

  it('callback_data fits in 64 bytes for typical shapes', () => {
    const cases = [
      'pick:cotizador-de-vuelos:9999',
      'apptype:dashboard',
      'confirm-create:1',
      'pick-gh:99',
      'gh-page:99',
      'cancel-wizard',
      'start:new',
    ];
    for (const c of cases) {
      expect(c.length, c).toBeLessThanOrEqual(64);
      expect(parseCallbackData(c).kind).not.toBe('unknown');
    }
  });
});
