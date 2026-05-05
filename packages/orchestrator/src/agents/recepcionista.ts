import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import { RecepcionistaOutputSchema, type RecepcionistaOutput } from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface RecepcionistaInput {
  raw_message: string;
  chat_id: number;
  username: string | undefined;
}

export async function runRecepcionista(
  input: RecepcionistaInput,
): Promise<{ output: RecepcionistaOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('recepcionista');
  const prefix = loadAgentPrefix('recepcionista');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'recepcionista',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: RecepcionistaOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
