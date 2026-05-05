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
];

const requiredFlows = [
  'software_nuevo',
  'feature',
  'bug',
  'cambio_visual',
  'qa_only',
  'refactor',
];

describe('factory structure', () => {
  it('every agent has instructions.md', () => {
    for (const dir of requiredAgentDirs) {
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

  it('agent instructions stay under the 500-word soft cap', () => {
    for (const dir of requiredAgentDirs) {
      const content = readFileSync(join(repoRoot, 'agents', dir, 'instructions.md'), 'utf8');
      const words = content.trim().split(/\s+/).length;
      // Soft cap with a small buffer; if this fires, trim the prompt.
      expect(words, `${dir} is too verbose (${words} words)`).toBeLessThan(700);
    }
  });
});
