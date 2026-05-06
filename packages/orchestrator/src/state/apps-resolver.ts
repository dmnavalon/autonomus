/**
 * Server-side reader for registry/apps.json. Used by the coordinator to resolve
 * an app_slug → repo / default_branch / stack before invoking the Programmer.
 *
 * Cached in module memory for 60s.
 */
import { getOctokit } from '../tools/github.js';

export interface RegistryApp {
  slug: string;
  repo: string;
  default_branch: string;
  stack: 'nextjs' | 'sveltekit' | 'astro' | 'other';
  vercel_project_id?: string | null;
  owner_chat_id?: number | null;
  collaborators?: number[];
  created_at?: string;
  notes?: string;
}

interface AppsRegistry {
  version: 1;
  apps: RegistryApp[];
}

const FACTORY_REPO_FULL = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const [FACTORY_OWNER, FACTORY_REPO_NAME] = FACTORY_REPO_FULL.split('/') as [string, string];
const TTL_MS = 60_000;

let cache: { value: AppsRegistry; expiresAt: number } | null = null;

export async function loadAppsRegistry(): Promise<AppsRegistry> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;
  const r = await getOctokit().repos.getContent({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    path: 'registry/apps.json',
    ref: 'main',
  });
  if (Array.isArray(r.data) || r.data.type !== 'file') {
    throw new Error('registry/apps.json is not a file');
  }
  const decoded = Buffer.from(r.data.content, r.data.encoding as BufferEncoding).toString('utf8');
  const parsed = JSON.parse(decoded) as AppsRegistry;
  cache = { value: parsed, expiresAt: Date.now() + TTL_MS };
  return parsed;
}

export async function findAppBySlug(slug: string): Promise<RegistryApp | null> {
  const reg = await loadAppsRegistry();
  return reg.apps.find((a) => a.slug === slug) ?? null;
}

export function __resetAppsRegistryCache(): void {
  cache = null;
}
