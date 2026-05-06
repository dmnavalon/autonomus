/**
 * Octokit wrapper for the orchestrator. Reads the Issue, posts agent comments,
 * transitions labels, and (in later phases) opens branches and PRs.
 *
 * Authenticated via GH_AUTOMATION_TOKEN (PAT with scopes: repo, workflow).
 */
import { Octokit } from '@octokit/rest';

const FACTORY_REPO_FULL = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const [FACTORY_OWNER, FACTORY_NAME] = FACTORY_REPO_FULL.split('/') as [string, string];

let _client: Octokit | null = null;
export function getOctokit(): Octokit {
  if (_client) return _client;
  const token = process.env.GH_AUTOMATION_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  _client = new Octokit({ auth: token, userAgent: 'autonomus-orchestrator' });
  return _client;
}

export interface IssueSnapshot {
  number: number;
  title: string;
  body: string;
  labels: string[];
  user: { login: string };
  state: 'open' | 'closed';
  comments: Array<{ id: number; body: string; created_at: string; author: string }>;
}

export async function fetchIssue(issueNumber: number): Promise<IssueSnapshot> {
  const o = getOctokit();
  const [issue, comments] = await Promise.all([
    o.issues.get({ owner: FACTORY_OWNER, repo: FACTORY_NAME, issue_number: issueNumber }),
    o.issues.listComments({
      owner: FACTORY_OWNER,
      repo: FACTORY_NAME,
      issue_number: issueNumber,
      per_page: 100,
    }),
  ]);

  return {
    number: issue.data.number,
    title: issue.data.title,
    body: issue.data.body ?? '',
    labels: issue.data.labels.map((l) => (typeof l === 'string' ? l : (l.name ?? ''))).filter(Boolean),
    user: { login: issue.data.user?.login ?? 'unknown' },
    state: issue.data.state as 'open' | 'closed',
    comments: comments.data.map((c) => ({
      id: c.id,
      body: c.body ?? '',
      created_at: c.created_at,
      author: c.user?.login ?? 'unknown',
    })),
  };
}

export async function commentOnIssue(issueNumber: number, body: string): Promise<void> {
  await getOctokit().issues.createComment({
    owner: FACTORY_OWNER,
    repo: FACTORY_NAME,
    issue_number: issueNumber,
    body,
  });
}

export async function setLabels(issueNumber: number, labels: string[]): Promise<void> {
  await getOctokit().issues.setLabels({
    owner: FACTORY_OWNER,
    repo: FACTORY_NAME,
    issue_number: issueNumber,
    labels,
  });
}

/**
 * Replace any current state:* label with the given one, preserving non-state labels.
 */
export async function transitionState(
  issueNumber: number,
  current: string[],
  newState: string,
): Promise<string[]> {
  const next = current.filter((l) => !l.startsWith('state:'));
  next.push(newState);
  await setLabels(issueNumber, next);
  return next;
}

export async function addLabel(issueNumber: number, label: string): Promise<void> {
  await getOctokit().issues.addLabels({
    owner: FACTORY_OWNER,
    repo: FACTORY_NAME,
    issue_number: issueNumber,
    labels: [label],
  });
}

/**
 * Parses the auto-created Issue body emitted by the Telegram webhook to recover
 * chat_id, username, app_slug, and the original raw text.
 *
 * `appSlug` is null when the body has `app_slug: \`(pending)\`` (issue still in
 * state:pending-app-selection) or when the field is missing entirely.
 */
export function parseTelegramJobBody(body: string): {
  rawText: string;
  chatId: number | null;
  username: string | undefined;
  appSlug: string | null;
} {
  const rawMatch = body.match(/## Solicitud original\s*\n+>([\s\S]*?)\n##/);
  const rawText = rawMatch?.[1]?.trim().replace(/^>\s?/gm, '').trim() ?? '';
  const chatIdMatch = body.match(/chat_id:\s*`([\d-]+)`/);
  const chatId = chatIdMatch ? Number(chatIdMatch[1]) : null;
  const usernameMatch = body.match(/username:\s*`([^`]*)`/);
  const username = usernameMatch && usernameMatch[1] !== '(none)' ? usernameMatch[1] : undefined;
  const slugMatch = body.match(/app_slug:\s*`([^`]*)`/);
  const slug = slugMatch?.[1] ?? null;
  const appSlug = !slug || slug === '(pending)' ? null : slug;
  return { rawText, chatId, username, appSlug };
}

export const FACTORY_REPO = { owner: FACTORY_OWNER, name: FACTORY_NAME };
