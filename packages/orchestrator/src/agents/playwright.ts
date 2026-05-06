/**
 * 12_playwright_agent — genera specs Playwright y consume resultados de CI.
 *
 * Two phases:
 *  - Generation (LLM mid): plan → e2e/factory/<n>.spec.ts files.
 *  - Execution (no LLM): CI workflow runs npx playwright test, parses results.json.
 *
 * In Phase 4 the workflow .github/workflows/qa-playwright.yml fires on
 * `deployment_status` and emits PlaywrightExecutionOutput as an Issue comment.
 */
import { chooseModel } from '../router.js';
import { loadAgentPrefix } from '../tools/prompt-loader.js';
import { callAgentLLM } from '../tools/llm.js';
import {
  PlaywrightGenerationOutputSchema,
  type PlaywrightGenerationOutput,
  type QaPlannerOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface PlaywrightGenerationInput {
  plan: QaPlannerOutput;
  preview_url: string;
  app_stack: 'next.js' | 'sveltekit' | 'astro' | 'other';
  existing_tests: string[];
}

export async function runPlaywrightGeneration(
  input: PlaywrightGenerationInput,
): Promise<{ output: PlaywrightGenerationOutput; usage: AgentUsage; model: string }> {
  const choice = chooseModel('playwright');
  const prefix = loadAgentPrefix('playwright');
  const userInput = JSON.stringify(input);

  const { output, usage } = await callAgentLLM({
    agent: 'playwright',
    model: choice.model,
    systemPrefix: prefix,
    userInput,
    schema: PlaywrightGenerationOutputSchema,
    temperature: 0,
  });

  return { output, usage, model: choice.model };
}
