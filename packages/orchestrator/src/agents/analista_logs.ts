/**
 * 13_log_analyst — clasifica fallas (producto/fabrica/infra/credenciales).
 * LLM mid (strong si bloqueante y previo fue strong). Output: AnalistaLogsOutput.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  AnalistaLogsOutputSchema,
  type AnalistaLogsOutput,
  type PlaywrightExecutionOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface AnalistaLogsInput {
  log_extract: string;
  playwright_results: PlaywrightExecutionOutput | null;
  context: {
    intento: number;
    tipo_solicitud: string;
    archivos_recientes: string[];
  };
  bloqueante?: boolean;
}

export async function runAnalistaLogs(
  input: AnalistaLogsInput,
): Promise<{ output: AnalistaLogsOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('analista_logs', { bloqueante: input.bloqueante });
  const prefix = loadAgentPrefix('analista_logs');
  const userInput = JSON.stringify({
    log_extract: input.log_extract,
    playwright_results: input.playwright_results,
    context: input.context,
  });

  const { output, usage } = await callAgentLLM({
    agent: 'analista_logs',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: AnalistaLogsOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
