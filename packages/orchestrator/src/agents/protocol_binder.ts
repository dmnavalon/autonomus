/**
 * 07_protocol_binder — audita coherencia agentes ↔ protocolos.
 * LLM cheap por default; mid si > 5 agentes simultáneos cambian.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  ProtocolBinderOutputSchema,
  type ProtocolBinderOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface ProtocolBinderInput {
  agent_file: string;
  agent_role: string;
  allowed_tools: string[];
  forbidden_actions: string[];
  system_area: string;
}

export async function runProtocolBinder(
  input: ProtocolBinderInput,
): Promise<{ output: ProtocolBinderOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('protocol_binder');
  const prefix = loadAgentPrefix('protocol_binder');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'protocol_binder',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: ProtocolBinderOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
