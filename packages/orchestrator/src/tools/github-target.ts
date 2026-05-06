/**
 * Octokit operations against ANY repo (not just the factory).
 *
 * The factory-side helpers in tools/github.ts are hardcoded to dmnavalon/autonomus
 * (Issues, comments, labels). This file is for operations on the TARGET app repo:
 *  - read files
 *  - create branches
 *  - write/commit files
 *  - open Pull Requests
 *
 * Authenticated via GH_AUTOMATION_TOKEN.
 */
import { getOctokit } from './github.js';

export interface RepoRef {
  owner: string;
  repo: string;
}

export function parseRepo(full: string): RepoRef {
  const [owner, repo] = full.split('/');
  if (!owner || !repo) throw new Error(`bad repo string: ${full}`);
  return { owner, repo };
}

export async function getDefaultBranch(ref: RepoRef): Promise<string> {
  const r = await getOctokit().repos.get({ owner: ref.owner, repo: ref.repo });
  return r.data.default_branch;
}

export async function getFileContentSafe(
  ref: RepoRef,
  branch: string,
  path: string,
): Promise<{ content: string; sha: string } | null> {
  try {
    const r = await getOctokit().repos.getContent({
      owner: ref.owner,
      repo: ref.repo,
      ref: branch,
      path,
    });
    if (Array.isArray(r.data) || r.data.type !== 'file') return null;
    const decoded = Buffer.from(r.data.content, r.data.encoding as BufferEncoding).toString('utf8');
    return { content: decoded, sha: r.data.sha };
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return null;
    throw err;
  }
}

export async function listRepoFilePaths(ref: RepoRef, branch: string, max = 500): Promise<string[]> {
  const branchInfo = await getOctokit().repos.getBranch({
    owner: ref.owner,
    repo: ref.repo,
    branch,
  });
  const treeSha = branchInfo.data.commit.commit.tree.sha;
  const tree = await getOctokit().git.getTree({
    owner: ref.owner,
    repo: ref.repo,
    tree_sha: treeSha,
    recursive: 'true',
  });
  return tree.data.tree
    .filter((t) => t.type === 'blob' && typeof t.path === 'string')
    .map((t) => t.path as string)
    .slice(0, max);
}

export async function branchExists(ref: RepoRef, branch: string): Promise<boolean> {
  try {
    await getOctokit().repos.getBranch({ owner: ref.owner, repo: ref.repo, branch });
    return true;
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (status === 404) return false;
    throw err;
  }
}

export async function createBranchFromBase(
  ref: RepoRef,
  baseBranch: string,
  newBranch: string,
): Promise<void> {
  const o = getOctokit();
  const base = await o.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${baseBranch}`,
  });
  await o.git.createRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `refs/heads/${newBranch}`,
    sha: base.data.object.sha,
  });
}

export interface FileEdit {
  path: string;
  content: string;
  operation: 'create' | 'update' | 'delete';
}

/**
 * Commits an array of FileEdits to a branch as a single tree+commit. Avoids the
 * race window of the per-file `createOrUpdateFileContents` API when changing many
 * files at once.
 */
export async function commitTreeToBranch(
  ref: RepoRef,
  branch: string,
  edits: FileEdit[],
  commitMessage: string,
  commitBody?: string,
): Promise<string> {
  if (edits.length === 0) throw new Error('no edits to commit');
  const o = getOctokit();
  const branchRef = await o.git.getRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
  });
  const baseSha = branchRef.data.object.sha;
  const baseCommit = await o.git.getCommit({
    owner: ref.owner,
    repo: ref.repo,
    commit_sha: baseSha,
  });
  const baseTree = baseCommit.data.tree.sha;

  const treeItems = await Promise.all(
    edits.map(async (e) => {
      if (e.operation === 'delete') {
        return { path: e.path, mode: '100644' as const, type: 'blob' as const, sha: null };
      }
      const blob = await o.git.createBlob({
        owner: ref.owner,
        repo: ref.repo,
        content: e.content,
        encoding: 'utf-8',
      });
      return {
        path: e.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blob.data.sha,
      };
    }),
  );

  const tree = await o.git.createTree({
    owner: ref.owner,
    repo: ref.repo,
    base_tree: baseTree,
    tree: treeItems,
  });

  const fullMessage = commitBody ? `${commitMessage}\n\n${commitBody}` : commitMessage;
  const commit = await o.git.createCommit({
    owner: ref.owner,
    repo: ref.repo,
    message: fullMessage,
    tree: tree.data.sha,
    parents: [baseSha],
  });

  await o.git.updateRef({
    owner: ref.owner,
    repo: ref.repo,
    ref: `heads/${branch}`,
    sha: commit.data.sha,
  });

  return commit.data.sha;
}

export interface OpenedPR {
  number: number;
  url: string;
}

export async function openPullRequest(
  ref: RepoRef,
  args: {
    head: string;
    base: string;
    title: string;
    body: string;
  },
): Promise<OpenedPR> {
  const o = getOctokit();
  const pr = await o.pulls.create({
    owner: ref.owner,
    repo: ref.repo,
    title: args.title,
    body: args.body,
    head: args.head,
    base: args.base,
  });
  return { number: pr.data.number, url: pr.data.html_url };
}
