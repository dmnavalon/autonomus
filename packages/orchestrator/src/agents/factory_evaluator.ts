/**
 * 17_factory_evaluator — corre evals contra cambios de agentes/protocolos.
 * LLM mid. Output: FactoryEvaluatorOutput.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  FactoryEvaluatorOutputSchema,
  type FactoryEvaluatorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface FactoryEvaluatorInput {
  changed_agent_files: string[];
  changed_protocol_files: string[];
  eval_dataset: {
    classification: unknown[];
    handoff: unknown[];
    protocol_compliance: unknown[];
  };
}

export async function runFactoryEvaluator(
  input: FactoryEvaluatorInput,
): Promise<{ output: FactoryEvaluatorOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('factory_evaluator');
  const prefix = loadAgentPrefix('factory_evaluator');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'factory_evaluator',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: FactoryEvaluatorOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
