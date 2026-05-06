import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { resolveApp } from '../../packages/telegram-webhook/lib/apps-resolver';
import * as registry from '../../packages/telegram-webhook/lib/registry';

const APP_A: registry.RegistryApp = { slug: 'app-a', repo: 'dmnavalon/app-a', default_branch: 'main', stack: 'nextjs', owner_chat_id: 1 };
const APP_B: registry.RegistryApp = { slug: 'app-b', repo: 'dmnavalon/app-b', default_branch: 'main', stack: 'nextjs', owner_chat_id: 1 };

describe('apps-resolver', () => {
  beforeEach(() => {
    vi.spyOn(registry, 'getLinkedApps').mockReset();
    vi.spyOn(registry, 'getLastActiveSlug').mockReset();
  });
  afterEach(() => vi.restoreAllMocks());

  it('returns "none" when chat has zero linked apps', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await resolveApp(1);
    expect(r.status).toBe('none');
  });

  it('returns "unique" when chat has exactly one linked app and no sticky', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await resolveApp(1);
    expect(r.status).toBe('unique');
    if (r.status === 'unique') expect(r.app.slug).toBe('app-a');
  });

  it('returns "sticky" when sticky slug is in linked apps', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-b');
    const r = await resolveApp(1);
    expect(r.status).toBe('sticky');
    if (r.status === 'sticky') expect(r.app.slug).toBe('app-b');
  });

  it('returns "multiple" when N apps and no usable sticky', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue(null);
    const r = await resolveApp(1);
    expect(r.status).toBe('multiple');
    if (r.status === 'multiple') expect(r.apps.map((a) => a.slug)).toEqual(['app-a', 'app-b']);
  });

  it('falls back to multiple when sticky slug is no longer authorized', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A, APP_B]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-c-removed');
    const r = await resolveApp(1);
    expect(r.status).toBe('multiple');
  });

  it('still picks unique when sticky is stale but only one app remains', async () => {
    vi.spyOn(registry, 'getLinkedApps').mockResolvedValue([APP_A]);
    vi.spyOn(registry, 'getLastActiveSlug').mockResolvedValue('app-c-removed');
    const r = await resolveApp(1);
    expect(r.status).toBe('unique');
    if (r.status === 'unique') expect(r.app.slug).toBe('app-a');
  });
});
