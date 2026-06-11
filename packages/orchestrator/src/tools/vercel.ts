/**
 * Minimal Vercel REST client. Used to find the preview URL for a branch
 * after the Programmer opens a PR on the target repo.
 *
 * Authenticated via VERCEL_TOKEN. Optional VERCEL_TEAM_ID scopes the requests
 * to a team (needed for personal-team accounts like diegomartinez-7745s-projects).
 */

const VERCEL_API = 'https://api.vercel.com';

export interface VercelDeployment {
  uid: string;
  url: string; // e.g. autonomus-tg-abc.vercel.app (no protocol)
  state: 'INITIALIZING' | 'BUILDING' | 'READY' | 'ERROR' | 'CANCELED' | 'QUEUED';
  meta?: {
    githubCommitRef?: string;
    githubCommitSha?: string;
  };
  created: number;
  ready?: number;
}

function teamQs(): string {
  const team = process.env.VERCEL_TEAM_ID;
  return team ? `&teamId=${encodeURIComponent(team)}` : '';
}

async function vercel<T>(path: string): Promise<T> {
  const token = process.env.VERCEL_TOKEN;
  if (!token) throw new Error('VERCEL_TOKEN missing');
  const sep = path.includes('?') ? '&' : '?';
  const url = `${VERCEL_API}${path}${sep}__=`.replace(/&__=$/, '') + teamQs();
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'autonomus-orchestrator' },
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`vercel ${path} failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return (await res.json()) as T;
}

export async function listDeployments(
  projectId: string,
  branch: string,
  limit = 5,
): Promise<VercelDeployment[]> {
  const data = await vercel<{ deployments: VercelDeployment[] }>(
    `/v6/deployments?projectId=${encodeURIComponent(projectId)}&limit=${limit}`,
  );
  return data.deployments.filter((d) => d.meta?.githubCommitRef === branch);
}

export interface WaitOptions {
  timeoutMs: number;
  pollIntervalMs: number;
}

export interface WaitResult {
  deployment: VercelDeployment | null;
  /** Last poll error, if any — an expired VERCEL_TOKEN looks identical to a
   * missing deployment otherwise (every poll throws and is swallowed). */
  lastError: string | null;
}

/**
 * Polls until a Vercel deployment for the given branch reaches state READY or ERROR.
 * `deployment` is null if the timeout expired with no deployment found.
 */
export async function waitForBranchDeployment(
  projectId: string,
  branch: string,
  opts: WaitOptions = { timeoutMs: 10 * 60_000, pollIntervalMs: 15_000 },
): Promise<WaitResult> {
  const deadline = Date.now() + opts.timeoutMs;
  let lastError: string | null = null;
  while (Date.now() < deadline) {
    let ds: VercelDeployment[] = [];
    try {
      ds = await listDeployments(projectId, branch);
      lastError = null;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    const newest = ds[0];
    if (newest && (newest.state === 'READY' || newest.state === 'ERROR' || newest.state === 'CANCELED')) {
      return { deployment: newest, lastError: null };
    }
    await sleep(opts.pollIntervalMs);
  }
  return { deployment: null, lastError };
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Returns the public URL of a Vercel deployment (with https://). */
export function previewUrl(d: VercelDeployment): string {
  return d.url.startsWith('http') ? d.url : `https://${d.url}`;
}
