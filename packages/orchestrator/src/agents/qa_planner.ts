/**
 * 11_qa_planner — produce plan E2E corto y prioritizado desde criterios_aceptacion.
 * LLM cheap. Output: QaPlannerOutput.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  QaPlannerOutputSchema,
  type QaPlannerOutput,
  type PlanificadorOutput,
} from '../schemas/index.js';
import type { AgentUsage, Tipo } from '../types.js';

export interface QaPlannerInput {
  spec: PlanificadorOutput;
  tipo: Tipo;
  preview_url: string;
}

export async function runQaPlanner(
  input: QaPlannerInput,
): Promise<{ output: QaPlannerOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('qa_planner');
  const prefix = loadAgentPrefix('qa_planner');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'qa_planner',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: QaPlannerOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
