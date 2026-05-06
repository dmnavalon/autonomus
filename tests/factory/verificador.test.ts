import { describe, it, expect } from 'vitest';
import { runVerificador } from '../../packages/orchestrator/src/agents/verificador';
import type {
  PlaywrightExecutionOutput,
  RevisorOutput,
} from '../../packages/orchestrator/src/schemas';

const goodQa: PlaywrightExecutionOutput = {
  estado: 'passed',
  totales: { ran: 3, passed: 3, failed: 0, skipped: 0 },
  fallos: [],
  duration_ms: 1234,
};
const goodReview: RevisorOutput = { aprobado: true, observaciones: [], cambios_solicitados: [] };

describe('runVerificador', () => {
  it('go=true when everything passes', () => {
    const r = runVerificador({
      issue_number: 1,
      branch: 'factory/1',
      pr_number: 7,
      preview_url: 'https://x.vercel.app',
      last_qa_result: goodQa,
      last_review_result: goodReview,
      last_commit_sha: 'abc',
      qa_commit_sha: 'abc',
      build_ok: true,
      lint_ok: true,
      typecheck_ok: true,
    });
    expect(r.output.go).toBe(true);
    expect(r.output.razon_si_no_go).toBe('');
  });

  it('go=false when QA failed', () => {
    const r = runVerificador({
      issue_number: 1,
      branch: 'factory/1',
      pr_number: 7,
      preview_url: 'https://x.vercel.app',
      last_qa_result: { ...goodQa, estado: 'failed' },
      last_review_result: goodReview,
      last_commit_sha: 'abc',
      qa_commit_sha: 'abc',
      build_ok: true,
      lint_ok: true,
      typecheck_ok: true,
    });
    expect(r.output.go).toBe(false);
    expect(r.output.razon_si_no_go).toContain('tests_ok');
  });

  it('go=false when commit drifted (qa ran on old sha)', () => {
    const r = runVerificador({
      issue_number: 1,
      branch: 'factory/1',
      pr_number: 7,
      preview_url: 'https://x.vercel.app',
      last_qa_result: goodQa,
      last_review_result: goodReview,
      last_commit_sha: 'new',
      qa_commit_sha: 'old',
      build_ok: true,
      lint_ok: true,
      typecheck_ok: true,
    });
    expect(r.output.go).toBe(false);
    expect(r.output.razon_si_no_go).toContain('ultimo_commit_testeado');
  });

  it('go=false when reviewer rejected', () => {
    const r = runVerificador({
      issue_number: 1,
      branch: 'factory/1',
      pr_number: 7,
      preview_url: 'https://x.vercel.app',
      last_qa_result: goodQa,
      last_review_result: { ...goodReview, aprobado: false },
      last_commit_sha: 'abc',
      qa_commit_sha: 'abc',
      build_ok: true,
      lint_ok: true,
      typecheck_ok: true,
    });
    expect(r.output.go).toBe(false);
  });

  it('preview_url must be https', () => {
    const r = runVerificador({
      issue_number: 1,
      branch: 'factory/1',
      pr_number: 7,
      preview_url: 'http://insecure',
      last_qa_result: goodQa,
      last_review_result: goodReview,
      last_commit_sha: 'abc',
      qa_commit_sha: 'abc',
      build_ok: true,
      lint_ok: true,
      typecheck_ok: true,
    });
    expect(r.output.go).toBe(false);
    expect(r.output.razon_si_no_go).toContain('preview_existe');
  });
});
