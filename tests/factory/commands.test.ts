import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchCommand } from '../../packages/telegram-webhook/lib/commands';
import * as registry from '../../packages/telegram-webhook/lib/registry';
import * as gh from '../../packages/telegram-webhook/lib/github-issue';

const APP_A: registry.RegistryApp = { slug: 'app-a', repo: 'dmnavalon/app-a', default_branch: 'main', stack: 'nextjs', owner_chat_id: 1 };
const APP_B: registry.RegistryApp = { slug: 'app-b', repo: 'dmnavalon/app-b', default_branch: 'main', stack: 'nextjs', owner_chat_id: 1 };

describe('commands', () => {
  beforeEach(() => {
    vi.spyOn(registry, 'getLinkedApps').mockReset();
    vi.spyOn(registry, 'getLastActiveSlug').mockReset();
    vi.spyOn(registry, 'setLastActiveSlug').mockReset();
    vi.spyOn(gh, 'openLinkAppPR').mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns null for non-slash messages', async () => {
    expect(await dispatchCommand('hello world', 1, 'd')).toBeNull();
  });

  it('/apps lists linked apps and marks active', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-b');
    const r = await dispatchCommand('/apps', 1, 'd');
    expect(r?.text).toContain('app-a');
    expect(r?.text).toContain('app-b');
    expect(r?.text).toContain('✅');
    expect(r?.headerSlug).toBe('app-b');
  });

  it('/apps explains onboarding when zero apps', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/apps', 1, 'd');
    expect(r?.text).toMatch(/no tienes proyectos/i);
  });

  it('/use <slug> sets sticky when slug is authorized', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    const setter = vi.spyOn(registry, 'setLastActiveSlug').mockResolvedValue(undefined);
    const r = await dispatchCommand('/use app-b', 1, 'd');
    expect(setter).toHaveBeenCalledWith(1, 'app-b');
    expect(r?.headerSlug).toBe('app-b');
  });

  it('/use rejects unknown slug', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const setter = vi.spyOn(registry, 'setLastActiveSlug').mockResolvedValue(undefined);
    const r = await dispatchCommand('/use ghost', 1, 'd');
    expect(setter).not.toHaveBeenCalled();
    expect(r?.text).toMatch(/no encuentro/i);
  });

  it('/current shows active project', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-a');
    const r = await dispatchCommand('/current', 1, 'd');
    expect(r?.text).toMatch(/app-a/);
    expect(r?.headerSlug).toBe('app-a');
  });

  it('/current handles no active', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/current', 1, 'd');
    expect(r?.text).toMatch(/no tienes proyecto activo/i);
    expect(r?.headerSlug).toBeNull();
  });

  it('/help lists all commands', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/help', 1, 'd');
    for (const cmd of ['/apps', '/use', '/current', '/link', '/help']) {
      expect(r?.text).toContain(cmd);
    }
  });

  it('/link rejects malformed args', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/link onlyone', 1, 'd');
    expect(r?.text).toMatch(/Modo avanzado|usuario\/repo/i);
  });

  it('/link rejects invalid slug', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/link Invalid_Slug owner/repo', 1, 'd');
    expect(r?.text).toMatch(/inv[aá]lido/i);
  });

  it('/link opens PR on valid input', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const opener = vi.spyOn(gh, 'openLinkAppPR').mockResolvedValue({ number: 9, url: 'https://x/9' });
    const r = await dispatchCommand('/link my-app dmnavalon/repo-x', 1, 'diego');
    expect(opener).toHaveBeenCalledWith({ slug: 'my-app', repo: 'dmnavalon/repo-x', ownerChatId: 1, username: 'diego' });
    expect(r?.text).toContain('#9');
  });

  it('unknown command returns help nudge', async () => {
    const r = await dispatchCommand('/notreal', 1, 'd');
    expect(r?.text).toMatch(/desconocido|help/i);
  });

  it('/start, /id, /whoami return null (delegated to webhook)', async () => {
    expect(await dispatchCommand('/start', 1, 'd')).toBeNull();
    expect(await dispatchCommand('/id', 1, 'd')).toBeNull();
    expect(await dispatchCommand('/whoami', 1, 'd')).toBeNull();
  });
});
