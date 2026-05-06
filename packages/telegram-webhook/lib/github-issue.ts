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

interface AppEntry {
  slug: string;
  label?: string;
  repo: string;
  default_branch: string;
  stack: 'nextjs' | 'sveltekit' | 'astro' | 'other';
  vercel_project_id: string | null;
  owner_chat_id: number;
  collaborators: number[];
  created_at: string;
  notes: string;
}

interface AppsFile {
  version: 1;
  $schema?: string;
  apps: AppEntry[];
}

async function readAppsFile(): Promise<{ data: AppsFile; sha: string }> {
  const o = getOctokit();
  const file = await o.repos.getContent({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    path: 'registry/apps.json',
    ref: 'main',
  });
  if (Array.isArray(file.data) || file.data.type !== 'file') {
    throw new Error('registry/apps.json is not a file');
  }
  const decoded = Buffer.from(file.data.content, file.data.encoding as BufferEncoding).toString('utf8');
  return { data: JSON.parse(decoded) as AppsFile, sha: file.data.sha };
}

async function writeAppsFileOnBranch(
  branch: string,
  next: AppsFile,
  sha: string,
  message: string,
): Promise<void> {
  await getOctokit().repos.createOrUpdateFileContents({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    path: 'registry/apps.json',
    branch,
    message,
    content: Buffer.from(JSON.stringify(next, null, 2) + '\n', 'utf8').toString('base64'),
    sha,
  });
}

async function createBranchFromMain(branchName: string): Promise<void> {
  const o = getOctokit();
  const baseRef = await o.git.getRef({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    ref: 'heads/main',
  });
  await o.git.createRef({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    ref: `refs/heads/${branchName}`,
    sha: baseRef.data.object.sha,
  });
}

/**
 * Auto-merges a registry-PR opened by the wizard. The PR is the audit trail
 * (commit message + author + diff visible in GitHub history); the merge step
 * itself is mechanical and shouldn't block the user.
 *
 * Requires GH_AUTOMATION_TOKEN to have `contents: write` and the user to NOT
 * have branch protection blocking direct merges by themselves. If the merge
 * fails (protected branch, conflicts), the caller falls back to "manual merge".
 */
async function autoMergePR(prNumber: number): Promise<{ merged: boolean; reason?: string }> {
  const o = getOctokit();
  try {
    await o.pulls.merge({
      owner: FACTORY_OWNER,
      repo: FACTORY_REPO_NAME,
      pull_number: prNumber,
      merge_method: 'squash',
    });
    return { merged: true };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return { merged: false, reason: detail.slice(0, 200) };
  }
}

/**
 * Opens a PR on dmnavalon/autonomus that adds a new entry to registry/apps.json.
 * Used by /link command and the conversational link wizard.
 */
export async function openLinkAppPR(args: {
  slug: string;
  label?: string;
  repo: string;
  ownerChatId: number;
  username: string | undefined;
}): Promise<{ number: number; url: string; merged: boolean; mergeError?: string }> {
  const o = getOctokit();
  const branchName = `registry/link-${args.slug}-${Date.now()}`;
  await createBranchFromMain(branchName);

  const { data, sha } = await readAppsFile();
  if (data.apps.some((a) => a.slug === args.slug)) {
    throw new Error(`slug already linked: ${args.slug}`);
  }
  const newEntry: AppEntry = {
    slug: args.slug,
    repo: args.repo,
    default_branch: 'main',
    stack: 'nextjs',
    vercel_project_id: null,
    owner_chat_id: args.ownerChatId,
    collaborators: [],
    created_at: new Date().toISOString(),
    notes: `Linked via Telegram by ${args.username ?? 'unknown'}.`,
  };
  if (args.label) newEntry.label = args.label;
  data.apps.push(newEntry);

  await writeAppsFileOnBranch(
    branchName,
    data,
    sha,
    `chore(registry): link app ${args.slug} (${args.repo})`,
  );

  const pr = await o.pulls.create({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    title: `Link app ${args.label ?? args.slug}`,
    head: branchName,
    base: 'main',
    body: [
      '## Link app request',
      '',
      `- label: \`${args.label ?? args.slug}\``,
      `- slug: \`${args.slug}\``,
      `- repo: \`${args.repo}\``,
      `- owner_chat_id: \`${args.ownerChatId}\``,
      `- requested_by: ${args.username ?? '(unknown username)'}`,
      '',
      'Auto-merged by the wizard. PR remains as audit trail.',
    ].join('\n'),
  });

  const merge = await autoMergePR(pr.data.number);
  return {
    number: pr.data.number,
    url: pr.data.html_url,
    merged: merge.merged,
    ...(merge.reason ? { mergeError: merge.reason } : {}),
  };
}

/**
 * Wizard "Crear proyecto":
 *  1. Creates the GitHub repo (private, initialized with README) under the
 *     authenticated user's account (typically `dmnavalon`).
 *  2. Opens a PR on dmnavalon/autonomus adding the entry to registry/apps.json.
 *
 * The repo is created first so it's navigable immediately; the PR-merge step
 * only activates routing inside the bot.
 */
export async function openCreateProjectPR(args: {
  slug: string;
  label: string;
  description: string | undefined;
  type: 'web' | 'saas' | 'dashboard' | 'bot' | 'api' | 'otro';
  ownerChatId: number;
  username: string | undefined;
}): Promise<{
  repoUrl: string;
  pr: { number: number; url: string; merged: boolean; mergeError?: string };
}> {
  const o = getOctokit();

  const repo = await o.repos.createForAuthenticatedUser({
    name: args.slug,
    description: args.description?.slice(0, 100) || `Generado por Autonomus (${args.label})`,
    private: true,
    auto_init: true,
  });
  const fullRepo = repo.data.full_name;

  const branchName = `registry/create-${args.slug}-${Date.now()}`;
  await createBranchFromMain(branchName);
  const { data, sha } = await readAppsFile();
  if (data.apps.some((a) => a.slug === args.slug)) {
    throw new Error(`slug already in registry: ${args.slug}`);
  }
  const notesParts: string[] = [`Created via Telegram wizard by ${args.username ?? 'unknown'}.`];
  notesParts.push(`type=${args.type}`);
  if (args.type === 'bot' || args.type === 'api') {
    notesParts.push('Phase 4.5 will branch scaffolding by stack.');
  }
  if (args.description) notesParts.push(`description: ${args.description}`);
  const newEntry: AppEntry = {
    slug: args.slug,
    label: args.label,
    repo: fullRepo,
    default_branch: 'main',
    stack: 'nextjs',
    vercel_project_id: null,
    owner_chat_id: args.ownerChatId,
    collaborators: [],
    created_at: new Date().toISOString(),
    notes: notesParts.join(' | '),
  };
  data.apps.push(newEntry);

  await writeAppsFileOnBranch(
    branchName,
    data,
    sha,
    `chore(registry): create project ${args.slug} (${fullRepo})`,
  );

  const pr = await o.pulls.create({
    owner: FACTORY_OWNER,
    repo: FACTORY_REPO_NAME,
    title: `Create project: ${args.label}`,
    head: branchName,
    base: 'main',
    body: [
      '## Create project (vía wizard de Telegram)',
      '',
      `- label: \`${args.label}\``,
      `- slug: \`${args.slug}\``,
      `- repo: \`${fullRepo}\` (creado, privado, initialized)`,
      `- tipo: ${args.type}`,
      args.description ? `- descripción: ${args.description}` : null,
      `- owner_chat_id: \`${args.ownerChatId}\``,
      `- requested_by: ${args.username ?? '(unknown username)'}`,
      '',
      'Auto-merged by the wizard. PR remains as audit trail. Repo already created.',
    ]
      .filter((l): l is string => l !== null)
      .join('\n'),
  });

  const merge = await autoMergePR(pr.data.number);
  return {
    repoUrl: repo.data.html_url,
    pr: {
      number: pr.data.number,
      url: pr.data.html_url,
      merged: merge.merged,
      ...(merge.reason ? { mergeError: merge.reason } : {}),
    },
  };
}
