/**
 * 14_repair_agent — corrige fallas diagnosticadas. Cap: 5 ciclos por job.
 * LLM strong; reasoning ON si attempt ≥ 3. Output: ReparadorPlan (file edits).
 * The actual commit is performed by tools/github-target.ts.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  ReparadorPlanSchema,
  type ReparadorPlan,
  type AnalistaLogsOutput,
  type PlanificadorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface ReparadorInput {
  spec: PlanificadorOutput;
  diagnosis: AnalistaLogsOutput;
  diff_actual: string;
  files_extracts: Record<string, string>;
  intento: number;
}

export async function runReparador(
  input: ReparadorInput,
): Promise<{ output: ReparadorPlan; usage: AgentUsage; model: string }> {
  if (input.intento > 5) {
    throw new Error('max_repair_cycles_reached');
  }
  const choice = chooseModel('reparador', { repairAttempt: input.intento });
  const prefix = loadAgentPrefix('reparador');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'reparador',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: ReparadorPlanSchema,
    temperature: 0.2,
  });

  return { output, usage, model: choice.model };
}
