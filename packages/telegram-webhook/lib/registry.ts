/**
 * Loads registry/users.json from the autonomus repo via GitHub Contents API.
 * Cached in module memory for 60s to avoid hammering the API while still
 * reflecting registry edits within ~1 minute of merge.
 *
 * The autonomus repo is private, so we authenticate with GH_AUTOMATION_TOKEN.
 * `registry/users.json` is the single source of truth for who can use the bot.
 */

export interface RegistryUser {
  chat_id: number | null;
  username: string;
  role: 'owner' | 'developer' | 'viewer';
  notes?: string;
}

export interface UsersRegistry {
  version: 1;
  users: RegistryUser[];
}

interface CacheEntry {
  value: UsersRegistry;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const TTL_MS = 60_000;

const FACTORY_REPO = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';

export async function loadUsersRegistry(): Promise<UsersRegistry> {
  if (cache && Date.now() < cache.expiresAt) return cache.value;

  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');

  const url = `https://api.github.com/repos/${FACTORY_REPO}/contents/registry/users.json?ref=main`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.raw',
      'User-Agent': 'autonomus-webhook',
    },
  });
  if (!res.ok) throw new Error(`registry fetch failed: ${res.status} ${res.statusText}`);

  const value = (await res.json()) as UsersRegistry;
  cache = { value, expiresAt: Date.now() + TTL_MS };
  return value;
}

export async function isAuthorizedChatId(chatId: number): Promise<boolean> {
  try {
    const reg = await loadUsersRegistry();
    return reg.users.some((u) => u.chat_id === chatId);
  } catch {
    // Fail closed — if we cannot verify the registry, deny.
    return false;
  }
}

/** Test seam: clear the cache. Used in unit tests. */
export function __resetRegistryCache(): void {
  cache = null;
}
