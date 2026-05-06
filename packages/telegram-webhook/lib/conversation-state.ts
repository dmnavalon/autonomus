/**
 * Per-chat wizard state, persisted to registry/conversations.json (GitHub-first).
 *
 * Each step writes a commit with `[skip ci]` so workflow runners don't fire on
 * wizard updates. 30-min TTL cleared lazily on next interaction.
 *
 * Volume budget: <10 wizards/day × 5 commits each = <50 commits/day. If this
 * grows past 50/day routinely, swap the impl for Upstash Redis (Vercel
 * Marketplace) without changing this module's public API.
 */

const FACTORY_REPO = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const TTL_MS = 2 * 60 * 60_000; // 2 hours
const CACHE_TTL_MS = 30_000;

export type WizardKind = 'create-project' | 'link-repo';
export type WizardStep =
  | 'name'
  | 'description'
  | 'type'
  | 'confirm'
  | 'label'
  | 'pick-gh';

export interface WizardDraft {
  name?: string;
  description?: string;
  type?: 'web' | 'saas' | 'dashboard' | 'bot' | 'api' | 'otro';
  slug?: string;
  repo?: string;
  label?: string;
  candidates?: Array<{ owner: string; name: string }>;
  page?: number;
}

export interface WizardState {
  chat_id: number;
  wizard: WizardKind;
  step: WizardStep;
  draft: WizardDraft;
  started_at: string;
  expires_at: string;
}

interface ConversationsFile {
  version: 1;
  $schema?: string;
  conversations: WizardState[];
}

interface CacheEntry {
  value: ConversationsFile;
  sha: string;
  expiresAt: number;
}
let cache: CacheEntry | null = null;

async function ghGet(): Promise<{ content: ConversationsFile; sha: string }> {
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  const url = `https://api.github.com/repos/${FACTORY_REPO}/contents/registry/conversations.json?ref=main`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'autonomus-webhook',
    },
  });
  if (!res.ok) throw new Error(`conversations.json fetch failed: ${res.status}`);
  const json = (await res.json()) as { content: string; encoding: string; sha: string };
  const decoded = Buffer.from(json.content, json.encoding as BufferEncoding).toString('utf8');
  return { content: JSON.parse(decoded) as ConversationsFile, sha: json.sha };
}

async function ghPut(file: ConversationsFile, sha: string, message: string): Promise<void> {
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  const url = `https://api.github.com/repos/${FACTORY_REPO}/contents/registry/conversations.json`;
  const res = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'autonomus-webhook',
    },
    body: JSON.stringify({
      message: `${message} [skip ci]`,
      content: Buffer.from(JSON.stringify(file, null, 2) + '\n', 'utf8').toString('base64'),
      sha,
      branch: 'main',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`conversations.json write failed: ${res.status} ${detail.slice(0, 200)}`);
  }
}

async function load(): Promise<{ content: ConversationsFile; sha: string }> {
  if (cache && Date.now() < cache.expiresAt) {
    return { content: cache.value, sha: cache.sha };
  }
  const { content, sha } = await ghGet();
  cache = { value: content, sha, expiresAt: Date.now() + CACHE_TTL_MS };
  return { content, sha };
}

function bustCache(): void {
  cache = null;
}

function isExpired(w: WizardState): boolean {
  return new Date(w.expires_at).getTime() < Date.now();
}

export async function getWizard(chatId: number): Promise<WizardState | null> {
  try {
    const { content } = await load();
    const found = content.conversations.find((w) => w.chat_id === chatId);
    if (!found) return null;
    if (isExpired(found)) {
      // lazy cleanup
      await clearWizard(chatId).catch(() => undefined);
      return null;
    }
    return found;
  } catch {
    return null;
  }
}

export async function setWizard(state: Omit<WizardState, 'expires_at'>): Promise<void> {
  const { content, sha } = await load();
  const now = Date.now();
  const next: WizardState = {
    ...state,
    expires_at: new Date(now + TTL_MS).toISOString(),
  };
  const filtered = content.conversations.filter(
    (w) => w.chat_id !== state.chat_id && !isExpired(w),
  );
  filtered.push(next);
  await ghPut(
    { ...content, conversations: filtered },
    sha,
    `chore(conv): wizard step ${state.step} for chat ${state.chat_id}`,
  );
  bustCache();
}

export async function clearWizard(chatId: number): Promise<void> {
  const { content, sha } = await load();
  const before = content.conversations.length;
  const filtered = content.conversations.filter((w) => w.chat_id !== chatId && !isExpired(w));
  if (filtered.length === before && before === content.conversations.length) {
    // nothing to clear
    return;
  }
  await ghPut(
    { ...content, conversations: filtered },
    sha,
    `chore(conv): clear wizard for chat ${chatId}`,
  );
  bustCache();
}

/** Test seam */
export function __resetConversationCache(): void {
  cache = null;
}
