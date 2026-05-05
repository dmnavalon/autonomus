import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import { ClasificadorOutputSchema, type ClasificadorOutput, type RecepcionistaOutput } from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface ClasificadorInput {
  texto_limpio: string;
  intencion_inicial: RecepcionistaOutput['intencion_inicial'];
  app_context: { exists: boolean; slug?: string; stack?: string } | null;
}

export async function runClasificador(
  input: ClasificadorInput,
): Promise<{ output: ClasificadorOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('clasificador');
  const prefix = loadAgentPrefix('clasificador');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'clasificador',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: ClasificadorOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
