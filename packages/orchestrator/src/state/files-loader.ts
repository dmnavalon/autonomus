/**
 * Loads file extracts from the target app repo for the Programmer agent.
 *
 * Token-efficiency rule: each file capped at 2k tokens (≈8000 chars). If a file
 * is larger, we keep the first 2k tokens and append a marker — the Programmer
 * works with this truncated view (it's allowed because the Architect only
 * lists files it actually needs to read; if 2k isn't enough, that's a sign the
 * Architect over-scoped).
 */
import { getFileContentSafe, type RepoRef } from '../tools/github-target.js';

const MAX_CHARS_PER_FILE = 8_000;

export interface FilesLoaderResult {
  files_extracts: Record<string, string>;
  not_found: string[];
}

export async function loadFilesExtracts(
  ref: RepoRef,
  branch: string,
  paths: string[],
): Promise<FilesLoaderResult> {
  const files_extracts: Record<string, string> = {};
  const not_found: string[] = [];

  await Promise.all(
    paths.map(async (path) => {
      const file = await getFileContentSafe(ref, branch, path);
      if (file === null) {
        not_found.push(path);
        return;
      }
      let content = file.content;
      if (content.length > MAX_CHARS_PER_FILE) {
        content = content.slice(0, MAX_CHARS_PER_FILE) + '\n\n// […truncated by files-loader…]';
      }
      files_extracts[path] = content;
    }),
  );

  return { files_extracts, not_found };
}
