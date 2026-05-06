/**
 * Structural sanity check for the factory itself.
 * Cheaper than a full pipeline test; runs in <1s and catches accidental deletes.
 */
import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(__dirname, '..', '..');

const requiredAgentDirs = [
  '01-recepcionista',
  '02-clasificador',
  '03-planificador',
  '04-arquitecto',
  '05-router-modelos',
  '06-programador',
  '07-revisor-codigo',
  '08-qa-planner',
  '09-playwright',
  '10-analista-logs',
  '11-reparador',
  '12-verificador-final',
  '13-coordinador',
  // Doc maestro additions (sec. 7 + sec. 8). Each instructions.md follows the
  // augmented format: YAML frontmatter + 13 sections (Propósito, Responsabilidades,
  // Límites, Protocolo de comunicación, Contrato de entrada, Contrato de salida,
  // Handoffs, Prompt del agente, Criterios de éxito, Modos de falla, Reglas de
  // eficiencia de tokens, Tests mínimos).
  '14-protocol-binder',
  '15-github-operator',
  '16-telegram-notifier',
  '17-factory-evaluator',
  '18-security-scope-guard',
  '19-prompt-change-manager',
];

const requiredFlows = [
  'software_nuevo',
  'feature',
  'bug',
  'cambio_visual',
  'qa_only',
  'refactor',
];

// Folders 14-19 are populated incrementally during the doc-maestro rollout
// (Fase B+E). Until each instructions.md exists, the existence assertion
// would fail; the soft cap test below already skips missing dirs.
const phase3AgentDirs = requiredAgentDirs.filter((d) => {
  const num = parseInt(d.split('-')[0]!, 10);
  return num >= 1 && num <= 13;
});

describe('factory structure', () => {
  it('every Phase-3 agent has instructions.md', () => {
    for (const dir of phase3AgentDirs) {
      const path = join(repoRoot, 'agents', dir, 'instructions.md');
      expect(existsSync(path), `missing ${path}`).toBe(true);
    }
  });

  it('every flow doc exists', () => {
    for (const f of requiredFlows) {
      const path = join(repoRoot, 'flows', `${f}.md`);
      expect(existsSync(path), `missing ${path}`).toBe(true);
    }
  });

  it('shared prompts are present', () => {
    expect(existsSync(join(repoRoot, 'prompts/shared/system.md'))).toBe(true);
    expect(existsSync(join(repoRoot, 'prompts/shared/safety.md'))).toBe(true);
    expect(existsSync(join(repoRoot, 'prompts/shared/json-schemas.md'))).toBe(true);
  });

  it('registry files are valid JSON with version=1', () => {
    const users = JSON.parse(readFileSync(join(repoRoot, 'registry/users.json'), 'utf8'));
    const apps = JSON.parse(readFileSync(join(repoRoot, 'registry/apps.json'), 'utf8'));
    expect(users.version).toBe(1);
    expect(apps.version).toBe(1);
    expect(Array.isArray(users.users)).toBe(true);
    expect(Array.isArray(apps.apps)).toBe(true);
  });

  it('agent instructions stay under the augmented-format soft cap', () => {
    // The doc maestro format (frontmatter + 13 sections) inflates word count vs.
    // the legacy minimal format. Soft cap is 4000 words; the LLM prefix is cached,
    // so cost impact is amortized across runs. If a file approaches this cap,
    // consider whether sections can be moved to /docs or /protocols by reference.
    for (const dir of requiredAgentDirs) {
      const path = join(repoRoot, 'agents', dir, 'instructions.md');
      if (!existsSync(path)) continue; // skip dirs not yet populated
      const content = readFileSync(path, 'utf8');
      const words = content.trim().split(/\s+/).length;
      expect(words, `${dir} is too verbose (${words} words)`).toBeLessThan(4000);
    }
  });
});
