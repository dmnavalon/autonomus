/**
 * Pinning the canonical Telegram messages so accidental rewordings get caught.
 * Source of truth: agents/12-verificador-final/instructions.md (sec. "Mensajes canónicos").
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CANONICAL_SUCCESS =
  'No se detectaron errores bloqueantes en QA automático. Listo para revisión humana.';
const CANONICAL_FAILURE_PREFIX = 'La fábrica no pudo cerrar el ciclo automático.';

const repoRoot = join(__dirname, '..', '..');

describe('canonical Telegram messages', () => {
  it('Verificador instructions still document the canonical success message', () => {
    const content = readFileSync(join(repoRoot, 'agents/12-verificador-final/instructions.md'), 'utf8');
    expect(content).toContain(CANONICAL_SUCCESS);
  });

  it('Verificador instructions still document the canonical failure prefix', () => {
    const content = readFileSync(join(repoRoot, 'agents/12-verificador-final/instructions.md'), 'utf8');
    expect(content).toContain(CANONICAL_FAILURE_PREFIX);
  });

  it('Coordinator emits the canonical success in notifyTerminal', () => {
    const content = readFileSync(join(repoRoot, 'packages/orchestrator/src/coordinator.ts'), 'utf8');
    expect(content).toContain(CANONICAL_SUCCESS);
    expect(content).toContain(CANONICAL_FAILURE_PREFIX);
  });
});
