/**
 * Loads registry/{users,apps}.json from the autonomus repo via GitHub Contents API.
 * Cached in module memory for 60s. Authentication: GH_AUTOMATION_TOKEN.
 *
 * Mutating helpers (setLastActiveSlug, openLinkAppPR) commit to the autonomus
 * repo via the Contents API and bypass the cache for the next read.
 */

export interface RegistryUser {
  chat_id: number | null;
  username: string;
  role: 'owner' | 'developer' | 'viewer';
  last_active_slug?: string | null;
  notes?: string;
}

export interface UsersRegistry {
  version: 1;
  $schema?: string;
  users: RegistryUser[];
}

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

export interface AppsRegistry {
  version: 1;
  $schema?: string;
  apps: RegistryApp[];
}

const TTL_MS = 60_000;
const FACTORY_REPO = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}
let usersCache: CacheEntry<UsersRegistry> | null = null;
let appsCache: CacheEntry<AppsRegistry> | null = null;

async function ghContents<T>(path: string): Promise<{ content: T; sha: string }> {
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  const url = `https://api.github.com/repos/${FACTORY_REPO}/contents/${path}?ref=main`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonomus-webhook',
    },
  });
  if (!res.ok) throw new Error(`registry fetch failed: ${path} ${res.status}`);
  const json = (await res.json()) as { content: string; encoding: string; sha: string };
  const decoded = Buffer.from(json.content, json.encoding as BufferEncoding).toString('utf8');
  return { content: JSON.parse(decoded) as T, sha: json.sha };
}

async function ghPut(
  path: string,
  newContent: object,
  sha: string,
  message: string,
): Promise<void> {
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  const url = `https://api.github.com/repos/${FACTORY_REPO}/contents/${path}`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'autonomus-webhook',
    },
    body: JSON.stringify({
      message,
      content: Buffer.from(JSON.stringify(newContent, null, 2) + '\n', 'utf8').toString('base64'),
      sha,
      branch: 'main',
    }),
  });
  if (!res.ok) throw new Error(`registry write failed: ${path} ${res.status} ${await res.text()}`);
}

export async function loadUsersRegistry(): Promise<UsersRegistry> {
  if (usersCache && Date.now() < usersCache.expiresAt) return usersCache.value;
  const { content } = await ghContents<UsersRegistry>('registry/users.json');
  usersCache = { value: content, expiresAt: Date.now() + TTL_MS };
  return content;
}

export async function loadAppsRegistry(): Promise<AppsRegistry> {
  if (appsCache && Date.now() < appsCache.expiresAt) return appsCache.value;
  const { content } = await ghContents<AppsRegistry>('registry/apps.json');
  appsCache = { value: content, expiresAt: Date.now() + TTL_MS };
  return content;
}

export async function isAuthorizedChatId(chatId: number): Promise<boolean> {
  try {
    const reg = await loadUsersRegistry();
    return reg.users.some((u) => u.chat_id === chatId);
  } catch {
    return false;
  }
}

/** Apps where the chat_id is the owner OR in collaborators. */
export async function getLinkedApps(chatId: number): Promise<RegistryApp[]> {
  try {
    const reg = await loadAppsRegistry();
    return reg.apps.filter(
      (a) => a.owner_chat_id === chatId || (a.collaborators ?? []).includes(chatId),
    );
  } catch {
    return [];
  }
}

export async function getLastActiveSlug(chatId: number): Promise<string | null> {
  const reg = await loadUsersRegistry();
  const u = reg.users.find((x) => x.chat_id === chatId);
  return u?.last_active_slug ?? null;
}

export async function setLastActiveSlug(chatId: number, slug: string): Promise<void> {
  const { content, sha } = await ghContents<UsersRegistry>('registry/users.json');
  const idx = content.users.findIndex((x) => x.chat_id === chatId);
  if (idx === -1) throw new Error(`chat_id ${chatId} not in registry/users.json`);
  if (content.users[idx]!.last_active_slug === slug) return; // no-op
  content.users[idx] = { ...content.users[idx]!, last_active_slug: slug };
  await ghPut(
    'registry/users.json',
    content,
    sha,
    `chore(registry): set last_active_slug=${slug} for chat_id=${chatId}`,
  );
  usersCache = null;
}

/** Test seam: clear caches. */
export function __resetRegistryCache(): void {
  usersCache = null;
  appsCache = null;
}
