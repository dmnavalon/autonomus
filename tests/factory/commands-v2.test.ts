/**
 * Phase 3.6 changes to commands.ts: label-aware /apps and /current, /use accepts
 * label or slug, /help no longer mentions slug/owner-repo in primary section,
 * /cancel aborts active wizard, /link kept under "Modo avanzado".
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dispatchCommand } from '../../packages/telegram-webhook/lib/commands';
import * as registry from '../../packages/telegram-webhook/lib/registry';
import * as conv from '../../packages/telegram-webhook/lib/conversation-state';

const APP_A: registry.RegistryApp = {
  slug: 'app-a',
  label: 'App Comercial',
  repo: 'dmnavalon/app-a',
  default_branch: 'main',
  stack: 'nextjs',
  owner_chat_id: 1,
};
const APP_B: registry.RegistryApp = {
  slug: 'cotizador',
  label: 'Cotizador',
  repo: 'dmnavalon/cotizador',
  default_branch: 'main',
  stack: 'nextjs',
  owner_chat_id: 1,
};

describe('commands v2 (Phase 3.6)', () => {
  beforeEach(() => {
    vi.spyOn(registry, 'getLinkedApps').mockReset();
    vi.spyOn(registry, 'getLastActiveSlug').mockReset();
    vi.spyOn(registry, 'setLastActiveSlug').mockReset();
    vi.spyOn(conv, 'getWizard').mockReset();
    vi.spyOn(conv, 'clearWizard').mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('/apps shows label, not slug, with active marker', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('cotizador');
    const r = await dispatchCommand('/apps', 1, 'd');
    expect(r?.text).toContain('App Comercial');
    expect(r?.text).toContain('Cotizador');
    expect(r?.text).toContain('✅');
    expect(r?.text).not.toMatch(/dmnavalon\/app-a/);
  });

  it('/use accepts label (case-insensitive)', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const setter = vi.spyOn(registry, 'setLastActiveSlug').mockResolvedValue(undefined);
    const r = await dispatchCommand('/use cotizador', 1, 'd');
    expect(setter).toHaveBeenCalledWith(1, 'cotizador');
    expect(r?.headerSlug).toBe('cotizador');
    expect(r?.text).toContain('Cotizador');
  });

  it('/use accepts label even with prefix match', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const setter = vi.spyOn(registry, 'setLastActiveSlug').mockResolvedValue(undefined);
    const r = await dispatchCommand('/use App C', 1, 'd');
    expect(setter).toHaveBeenCalledWith(1, 'app-a');
    expect(r?.headerSlug).toBe('app-a');
  });

  it('/use rejects unknown name', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/use no-existe', 1, 'd');
    expect(r?.text).toMatch(/no encuentro|disponibles/i);
  });

  it('/current displays label, not slug', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-a');
    const r = await dispatchCommand('/current', 1, 'd');
    expect(r?.text).toContain('App Comercial');
    expect(r?.headerSlug).toBe('app-a');
  });

  it('/help has primary section without slug/owner-repo and advanced /link section', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/help', 1, 'd');
    const text = r?.text ?? '';
    const primaryEnd = text.indexOf('Modo avanzado');
    expect(primaryEnd).toBeGreaterThan(0);
    const primary = text.slice(0, primaryEnd);
    expect(primary).not.toMatch(/slug/i);
    expect(primary).not.toMatch(/owner\/repo/i);
    expect(primary).toContain('/apps');
    expect(primary).toContain('/use');
    expect(primary).toContain('/cancel');
    const advanced = text.slice(primaryEnd);
    expect(advanced).toContain('/link');
  });

  it('/cancel aborts active wizard', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    vi.spyOn(conv, 'getWizard').mockResolvedValue({
      chat_id: 1,
      wizard: 'create-project',
      step: 'name',
      draft: {},
      started_at: '2026-05-06T00:00:00Z',
      expires_at: '2026-05-06T00:30:00Z',
    });
    const clear = vi.spyOn(conv, 'clearWizard').mockResolvedValue(undefined);
    const r = await dispatchCommand('/cancel', 1, 'd');
    expect(clear).toHaveBeenCalledWith(1);
    expect(r?.text).toMatch(/cancelado/i);
  });

  it('/cancel with no active wizard says nothing to cancel', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    vi.spyOn(conv, 'getWizard').mockResolvedValue(null);
    const r = await dispatchCommand('/cancel', 1, 'd');
    expect(r?.text).toMatch(/no hay asistente/i);
  });

  it('/link still works as advanced shortcut', async () => {
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await dispatchCommand('/link malformed', 1, 'd');
    // bad args path
    expect(r?.text).toMatch(/Modo avanzado/);
  });
});
