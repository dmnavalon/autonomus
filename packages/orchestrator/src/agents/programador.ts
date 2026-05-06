/**
 * 09_implementation_agent — produces the file edits + commit/PR text.
 * LLM strong tier always. The actual git mutations live in tools/github-target.ts
 * and run after the GithubOperator preflight passes.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  ProgramadorPlanSchema,
  type ProgramadorPlan,
  type PlanificadorOutput,
  type ArquitectoOutput,
} from '../schemas/index.js';
import type { AgentUsage, Complejidad, Riesgo } from '../types.js';

export interface ProgramadorInput {
  spec: PlanificadorOutput;
  plan_tecnico: ArquitectoOutput;
  app_context: { slug: string; repo: string; default_branch: string };
  files_extracts: Record<string, string>;
  branch_name: string;
  complejidad?: Complejidad;
  riesgo?: Riesgo;
}

export async function runProgramador(
  input: ProgramadorInput,
): Promise<{ output: ProgramadorPlan; usage: AgentUsage; model: string }> {
  const choice = chooseModel('programador', {
    complejidad: input.complejidad,
    riesgo: input.riesgo,
  });
  const prefix = loadAgentPrefix('programador');
  const userInput = JSON.stringify({
    spec: input.spec,
    plan_tecnico: input.plan_tecnico,
    app_context: input.app_context,
    files_extracts: input.files_extracts,
    branch_name: input.branch_name,
  });

  const { output, usage } = await callAgentLLM({
    agent: 'programador',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: ProgramadorPlanSchema,
    temperature: 0.2,
  });

  return { output, usage, model: choice.model };
}
