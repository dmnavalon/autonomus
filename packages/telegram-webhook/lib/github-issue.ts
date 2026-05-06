/**
 * Creates and mutates Job Issues in dmnavalon/autonomus.
 *
 * - createJobIssue() — initial Issue creation; supports app_slug or pending state.
 * - attachAppSlug()  — when the user picks an app from inline keyboard, edit the
 *                      Issue body to add the slug and transition the label.
 * - openLinkAppPR()  — /link command opens a PR adding an app to apps.json.
 */
import { Octokit } from '@octokit/rest';

const FACTORY_REPO_FULL = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
const [FACTORY_OWNER, FACTORY_REPO_NAME] = FACTORY_REPO_FULL.split('/') as [string, string];

let octokit: Octokit | null = null;

export function getOctokit(): Octokit {
  if (octokit) return octokit;
  const token = process.env.GH_AUTOMATION_TOKEN;
  if (!token) throw new Error('GH_AUTOMATION_TOKEN missing');
  octokit = new Octokit({ auth: token, userAgent: 'autonomus-webhook' });
  return octokit;
}

export interface JobIssueInput {
  message: string;
  chatId: number;
  username: string | undefined;
  appSlug: string | null;       // null when state:pending-app-selection
  availableAppSlugs?: string[]; // shown in body when slug not yet chosen
}

export interface JobIssueResult {
  number: number;
  url: string;
}

function buildBody(input: JobIssueInput): string {
  const lines = [
    '<!-- Created by Autonomus Telegram webhook. Do NOT edit by hand; comments below are written by agents. -->',
    '',
    '## Solicitud original',
    '',
    '> ' + input.message.replace(/\n/g, '\n> '),
    '',
    '## Metadata',
    '',
    `- chat_id: \`${input.chatId}\``,
    `- username: \`${input.username ?? '(none)'}\``,
    `- app_slug: \`${input.appSlug ?? '(pending)'}\``,
    `- received_at: \`${new Date().toISOString()}\``,
  ];
  if (!input.appSlug && input.availableAppSlugs?.length) {
    lines.push('', '## Apps disponibles', '', ...input.availableAppSlugs.map((s) => `- \`${s}\``));
  }
  return lines.join('\n');
}

export async function createJobIssue(input: JobIssueInput): Promise<JobIssueResult> {
  const title = input.message.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Job sin título';
  const labels = [
    input.appSlug ? 'state:received' : 'state:pending-app-selection',
    'source:telegram',
  ];
  const { data } = await getOctokit().issues.create({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    title,
    body: buildBody(input),
    labels,
  });
  return { number: data.number, url: data.html_url };
}

/**
 * Called when user clicks an inline-keyboard pick. Edits the Issue body to
 * replace `app_slug: (pending)` with the chosen slug and transitions the
 * label `state:pending-app-selection` → `state:received` (which kicks off
 * the orchestrator workflow).
 */
export async function attachAppSlug(issueNumber: number, slug: string): Promise<void> {
  const o = getOctokit();
  const issue = await o.issues.get({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    issue_number: issueNumber,
  });
  const oldBody = issue.data.body ?? '';
  const newBody = oldBody.replace(/app_slug:\s*`\(pending\)`/, `app_slug: \`${slug}\``);
  await o.issues.update({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    issue_number: issueNumber,
    body: newBody,
  });
  // Replace pending-app-selection with state:received; preserve every other label.
  const currentLabels = issue.data.labels
    .map((l) => (typeof l === 'string' ? l : (l.name ?? '')))
    .filter(Boolean);
  const newLabels = currentLabels
    .filter((l) => l !== 'state:pending-app-selection')
    .concat('state:received');
  await o.issues.setLabels({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    issue_number: issueNumber,
    labels: newLabels,
  });
}

/**
 * Opens a PR on dmnavalon/autonomus that adds a new entry to registry/apps.json.
 * Used by /link command. Branch: registry/link-<slug>-<timestamp>.
 */
export async function openLinkAppPR(args: {
  slug: string;
  repo: string;
  ownerChatId: number;
  username: string | undefined;
}): Promise<{ number: number; url: string }> {
  const o = getOctokit();

  const baseRef = await o.git.getRef({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    ref: 'heads/main',
  });
  const branchName = `registry/link-${args.slug}-${Date.now()}`;
  await o.git.createRef({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.data.object.sha,
  });

  // Read current apps.json on main
  const file = await o.repos.getContent({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    path: 'registry/apps.json',
    ref: 'main',
  });
  if (Array.isArray(file.data) || file.data.type !== 'file') {
    throw new Error('registry/apps.json is not a file');
  }
  const current = JSON.parse(
    Buffer.from(file.data.content, file.data.encoding as BufferEncoding).toString('utf8'),
  ) as { version: 1; $schema?: string; apps: unknown[] };

  if ((current.apps as Array<{ slug: string }>).some((a) => a.slug === args.slug)) {
    throw new Error(`slug already linked: ${args.slug}`);
  }

  current.apps.push({
    slug: args.slug,
    repo: args.repo,
    default_branch: 'main',
    stack: 'nextjs',
    vercel_project_id: null,
    owner_chat_id: args.ownerChatId,
    collaborators: [],
    created_at: new Date().toISOString(),
    notes: `Linked via Telegram /link by ${args.username ?? 'unknown'}.`,
  });

  await o.repos.createOrUpdateFileContents({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    path: 'registry/apps.json',
    branch: branchName,
    message: `chore(registry): link app ${args.slug} (${args.repo})`,
    content: Buffer.from(JSON.stringify(current, null, 2) + '\n', 'utf8').toString('base64'),
    sha: file.data.sha,
  });

  const pr = await o.pulls.create({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    title: `Link app ${args.slug}`,
    head: branchName,
    base: 'main',
    body: [
      '## /link request',
      '',
      `- slug: \`${args.slug}\``,
      `- repo: \`${args.repo}\``,
      `- owner_chat_id: \`${args.ownerChatId}\``,
      `- requested_by: ${args.username ?? '(unknown username)'}`,
      '',
      'Mergea este PR para activar el linkeo. El cache del webhook expira 60s después.',
    ].join('\n'),
  });

  return { number: pr.data.number, url: pr.data.html_url };
}
