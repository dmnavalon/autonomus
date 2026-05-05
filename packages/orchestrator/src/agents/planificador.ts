import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  PlanificadorOutputSchema,
  type PlanificadorOutput,
  type ClasificadorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface PlanificadorInput {
  texto_limpio: string;
  tipo: ClasificadorOutput['tipo'];
  complejidad: ClasificadorOutput['complejidad'];
  app_context: {
    slug?: string;
    stack?: string;
    existing_routes?: string[];
  } | null;
}

export async function runPlanificador(
  input: PlanificadorInput,
): Promise<{ output: PlanificadorOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('planificador', { complejidad: input.complejidad });
  const prefix = loadAgentPrefix('planificador');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'planificador',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: PlanificadorOutputSchema,
    temperature: 0.1,
  });

  return { output, usage, model: choice.model };
}
