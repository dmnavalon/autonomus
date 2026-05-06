/**
 * 15_final_verifier — checklist determinista pre-aviso humano.
 * Mostly deterministic: API calls fill checklist booleans. LLM cheap solo formatea
 * razon_si_no_go cuando algo falla.
 */
import {
  VerificadorOutputSchema,
  type VerificadorOutput,
  type PlaywrightExecutionOutput,
  type RevisorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface VerificadorInput {
  issue_number: number;
  branch: string;
  pr_number: number;
  preview_url: string;
  last_qa_result: PlaywrightExecutionOutput;
  last_review_result: RevisorOutput;
  last_commit_sha: string;
  qa_commit_sha: string; // sha that QA actually executed against
  build_ok: boolean;
  lint_ok: boolean;
  typecheck_ok: boolean;
}

/**
 * Deterministic verification. No LLM call by default; only if you need to
 * format `razon_si_no_go` with rich context, route to LLM cheap separately.
 */
export function runVerificador(
  input: VerificadorInput,
): { output: VerificadorOutput; usage: AgentUsage; model: string } {
  const checklist = {
    branch_existe: input.branch.length > 0,
    pr_existe: input.pr_number > 0,
    preview_existe: input.preview_url.startsWith('https://'),
    build_ok: input.build_ok,
    lint_ok: input.lint_ok,
    typecheck_ok: input.typecheck_ok,
    tests_ok: input.last_qa_result.estado === 'passed',
    no_bloqueantes: input.last_qa_result.fallos.length === 0,
    revisor_aprobo: input.last_review_result.aprobado === true,
    ultimo_commit_testeado: input.last_commit_sha === input.qa_commit_sha,
  };

  const failed = Object.entries(checklist)
    .filter(([, v]) => !v)
    .map(([k]) => k);

  const go = failed.length === 0;
  const razon_si_no_go = go ? '' : `Checks fallidos: ${failed.join(', ')}`.slice(0, 200);

  const output: VerificadorOutput = { go, checklist, razon_si_no_go };
  const parsed = VerificadorOutputSchema.parse(output);

  return {
    output: parsed,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
    model: 'deterministic',
  };
}
