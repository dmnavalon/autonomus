/**
 * 10_code_reviewer — revisa diff/PR contra alcance, calidad, seguridad y protocolos.
 * LLM mid (strong si diff > 1000 LOC). Output: RevisorOutput.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  RevisorOutputSchema,
  type RevisorOutput,
  type PlanificadorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface RevisorInput {
  spec: PlanificadorOutput;
  diff: string;
  pr_metadata: {
    title: string;
    files_changed: string[];
    additions: number;
    deletions: number;
  };
}

export async function runRevisorCodigo(
  input: RevisorInput,
): Promise<{ output: RevisorOutput; usage: AgentUsage; model: string }> {
  const prDiffLoc = input.pr_metadata.additions + input.pr_metadata.deletions;
  const choice = chooseModel('revisor_codigo', { prDiffLoc });
  const prefix = loadAgentPrefix('revisor_codigo');
  const userInput = JSON.stringify({
    spec: { objetivo: input.spec.objetivo, criterios_aceptacion: input.spec.criterios_aceptacion },
    diff: input.diff,
    pr_metadata: input.pr_metadata,
  });

  const { output, usage } = await callAgentLLM({
    agent: 'revisor_codigo',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: RevisorOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
