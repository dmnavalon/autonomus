/**
 * Loads the cacheable prompt prefix for a given agent.
 * Order:
 *   1. prompts/shared/system.md
 *   2. prompts/shared/safety.md
 *   3. agents/<n>/instructions.md
 *
 * The result is fixed across calls for a given agent → maximises prompt cache hits.
 * Files are read from disk once per process and memoized.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AgentName } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// dist/tools → repo root is 4 levels up.
const REPO_ROOT = join(__dirname, '..', '..', '..', '..');

const AGENT_DIR: Record<AgentName, string> = {
  recepcionista:   '01-recepcionista',
  clasificador:    '02-clasificador',
  planificador:    '03-planificador',
  arquitecto:      '04-arquitecto',
  router:          '05-router-modelos',
  programador:     '06-programador',
  revisor_codigo:  '07-revisor-codigo',
  qa_planner:      '08-qa-planner',
  playwright:      '09-playwright',
  analista_logs:   '10-analista-logs',
  reparador:       '11-reparador',
  verificador:     '12-verificador-final',
};

const cache = new Map<string, string>();

function readMemoized(path: string): string {
  const hit = cache.get(path);
  if (hit !== undefined) return hit;
  const content = readFileSync(path, 'utf8');
  cache.set(path, content);
  return content;
}

export function loadAgentPrefix(agent: AgentName): string {
  const system = readMemoized(join(REPO_ROOT, 'prompts', 'shared', 'system.md'));
  const safety = readMemoized(join(REPO_ROOT, 'prompts', 'shared', 'safety.md'));
  const instructions = readMemoized(
    join(REPO_ROOT, 'agents', AGENT_DIR[agent], 'instructions.md'),
  );
  return [system, safety, instructions].join('\n\n---\n\n');
}

/** Test seam: clear the prompt cache. */
export function __resetPromptCache(): void {
  cache.clear();
}
