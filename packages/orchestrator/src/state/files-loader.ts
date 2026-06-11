/**
 * Loads file extracts from the target app repo for the Programmer agent.
 *
 * Token-efficiency rule: each file capped at ~6k tokens (24000 chars). If a
 * file is larger, we keep the head and append a marker. The Programmer rewrites
 * whole files, so the coordinator BLOCKS `update` ops on truncated files — a
 * model that never saw the tail would destroy it (issue #14: landing-page.tsx
 * went 401 → 36 lines). `truncated` and `original_sizes` feed that guard.
 */
import { getFileContentSafe, type RepoRef } from '../tools/github-target.js';

const MAX_CHARS_PER_FILE = 24_000;

export interface FilesLoaderResult {
  files_extracts: Record<string, string>;
  not_found: string[];
  truncated: string[];
  original_sizes: Record<string, number>;
}

export async function loadFilesExtracts(
  ref: RepoRef,
  branch: string,
  paths: string[],
): Promise<FilesLoaderResult> {
  const files_extracts: Record<string, string> = {};
  const not_found: string[] = [];
  const truncated: string[] = [];
  const original_sizes: Record<string, number> = {};

  await Promise.all(
    paths.map(async (path) => {
      const file = await getFileContentSafe(ref, branch, path);
      if (file === null) {
        not_found.push(path);
        return;
      }
      let content = file.content;
      original_sizes[path] = content.length;
      if (content.length > MAX_CHARS_PER_FILE) {
        content = content.slice(0, MAX_CHARS_PER_FILE) + '\n\n// […truncated by files-loader…]';
        truncated.push(path);
      }
      files_extracts[path] = content;
    }),
  );

  return { files_extracts, not_found, truncated, original_sizes };
}
