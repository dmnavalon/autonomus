import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  ArquitectoOutputSchema,
  type ArquitectoOutput,
  type PlanificadorOutput,
  type ClasificadorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface ArquitectoInput {
  spec: PlanificadorOutput;
  app_context: {
    slug?: string;
    stack?: string;
    files_index?: string[];
  } | null;
  complejidad: ClasificadorOutput['complejidad'];
  riesgo: ClasificadorOutput['riesgo'];
}

export async function runArquitecto(
  input: ArquitectoInput,
): Promise<{ output: ArquitectoOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('arquitecto', {
    complejidad: input.complejidad,
    riesgo: input.riesgo,
  });
  const prefix = loadAgentPrefix('arquitecto');

  // Trim files_index to keep input cap. Architect doesn't need 1000 paths;
  // it only uses them to spot existing patterns. Cap to 200.
  const trimmedInput = {
    ...input,
    app_context: input.app_context
      ? { ...input.app_context, files_index: input.app_context.files_index?.slice(0, 200) }
      : null,
  };
  const userInput = JSON.stringify(trimmedInput);

  const { output, usage } = await callAgentLLM({
    agent: 'arquitecto',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: ArquitectoOutputSchema,
    temperature: 0.1,
  });

  return { output, usage, model: choice.model };
}
