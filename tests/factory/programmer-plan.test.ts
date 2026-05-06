import { describe, it, expect } from 'vitest';
import { ProgramadorPlanSchema, ReparadorPlanSchema } from '../../packages/orchestrator/src/schemas';

describe('ProgramadorPlanSchema', () => {
  it('accepts a minimal valid plan', () => {
    const p = ProgramadorPlanSchema.parse({
      archivos_modificados: [
        { path: 'app/page.tsx', content: 'export default function Page(){return null}', operation: 'update' },
      ],
      commit_message: '[factory] fix logout redirect',
      commit_body: 'Restores redirect to /login after session.destroy()',
      pr_title: 'fix: logout returns to /login',
      pr_summary: 'Restores the original behavior where pressing the logout button clears the cookie and redirects to /login.',
      diff_resumen: '1 file, 4 lines',
    });
    expect(p.archivos_modificados).toHaveLength(1);
  });

  it('rejects path with backslash', () => {
    expect(() =>
      ProgramadorPlanSchema.parse({
        archivos_modificados: [{ path: '..\\evil', content: 'x', operation: 'create' }],
        commit_message: '[factory] x',
        commit_body: '',
        pr_title: 'fix: x',
        pr_summary: 'Long enough summary text here.',
        diff_resumen: '',
      }),
    ).toThrow();
  });

  it('rejects empty file list', () => {
    expect(() =>
      ProgramadorPlanSchema.parse({
        archivos_modificados: [],
        commit_message: '[factory] x',
        commit_body: '',
        pr_title: 'fix: x',
        pr_summary: 'Long enough summary text here.',
        diff_resumen: '',
      }),
    ).toThrow();
  });

  it('caps array at 15 files', () => {
    const big = Array.from({ length: 16 }, (_, i) => ({
      path: `f${i}.ts`,
      content: 'x',
      operation: 'update' as const,
    }));
    expect(() =>
      ProgramadorPlanSchema.parse({
        archivos_modificados: big,
        commit_message: '[factory] x',
        commit_body: '',
        pr_title: 'fix: x',
        pr_summary: 'Long enough summary text here.',
        diff_resumen: '',
      }),
    ).toThrow();
  });
});

describe('ReparadorPlanSchema', () => {
  it('accepts a minimal valid plan', () => {
    const p = ReparadorPlanSchema.parse({
      archivos_modificados: [
        { path: 'lib/auth.ts', content: 'export const x=1;', operation: 'update' },
      ],
      commit_message: '[factory][repair:1] add missing await',
      commit_body: 'session.destroy() was synchronous-style.',
      cambios: 'Add missing await on session.destroy() in lib/auth.ts.',
    });
    expect(p.cambios).toContain('await');
  });

  it('caps at 10 files', () => {
    const big = Array.from({ length: 11 }, (_, i) => ({
      path: `f${i}.ts`,
      content: 'x',
      operation: 'update' as const,
    }));
    expect(() =>
      ReparadorPlanSchema.parse({
        archivos_modificados: big,
        commit_message: '[factory][repair:1] x',
        commit_body: '',
        cambios: 'changed many files',
      }),
    ).toThrow();
  });
});
