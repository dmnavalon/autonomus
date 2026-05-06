/**
 * Lists the bot owner's GitHub repos available for linking.
 *
 * Authenticated via GH_AUTOMATION_TOKEN. Excludes:
 *  - already-linked repos (slugs in registry/apps.json)
 *  - archived repos
 *  - forks (typically not the user's own work)
 *  - the factory repo itself (dmnavalon/autonomus)
 *
 * Sorted by `pushed_at` desc so the most-active repos surface first.
 * Cached in module memory for 60s.
 */
import { Octokit } from '@octokit/rest';
import { loadAppsRegistry } from './registry';

const FACTORY_REPO = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const CACHE_TTL_MS = 60_000;

export interface RepoCandidate {
  owner: string;
  name: string;
  full_name: string;
  description: string | null;
  pushed_at: string;
  private: boolean;
}

let _octokit: Octokit | null = null;
function getOctokit(): Octokit {
  if (_octokit) return _octokit;
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  _octokit = new Octokit({ auth: token, userAgent: 'autonomus-webhook' });
  return _octokit;
}

let cache: { value: RepoCandidate[]; expiresAt: number } | null = null;

export async function listLinkableRepos(): Promise<RepoCandidate[]> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;

  const o = getOctokit();
  const linked = new Set<string>();
  try {
    const apps = await loadAppsRegistry();
    for (const a of apps.apps) linked.add(a.repo);
  } catch {
    /* registry unreachable → treat as no exclusions */
  }
  linked.add(FACTORY_REPO);

  const repos = await o.paginate(o.repos.listForAuthenticatedUser, {
    affiliation: 'owner',
    sort: 'pushed',
    direction: 'desc',
    per_page: 100,
  });

  const filtered: RepoCandidate[] = repos
    .filter((r) => !r.archived && !r.fork && !linked.has(r.full_name))
    .map((r) => ({
      owner: r.owner?.login ?? '',
      name: r.name,
      full_name: r.full_name,
      description: r.description ?? null,
      pushed_at: r.pushed_at ?? '',
      private: r.private,
    }))
    .filter((r) => r.owner);

  cache = { value: filtered, expiresAt: Date.now() + CACHE_TTL_MS };
  return filtered;
}

export function __resetReposCache(): void {
  cache = null;
}
