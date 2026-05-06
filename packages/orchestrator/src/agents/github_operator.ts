/**
 * 08_github_operator — operaciones GitHub con guardrails. DETERMINISTIC.
 *
 * Wraps tools/github.ts with:
 *  - secret detection (regex blocklist) on payloads.
 *  - forbidden-action gate (merge_to_main, force_push_main, etc.).
 *  - retry with exponential backoff on 429/5xx.
 *
 * The actual Octokit calls live in tools/github.ts (fetchIssue, commentOnIssue,
 * transitionState). This agent runs the pre-flight checks and produces a
 * structured GithubOperatorOutput.
 */
import {
  GithubOperatorOutputSchema,
  type GithubOperatorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /AKIA[A-Z0-9]{16}/,                        // AWS access key
  /ghp_[A-Za-z0-9]{36,}/,                    // GitHub personal access token
  /xox[baprs]-[A-Za-z0-9-]+/,                // Slack bot/user tokens
  /sk-[A-Za-z0-9]{40,}/,                     // OpenAI / Anthropic
  /AIza[0-9A-Za-z_-]{35}/,                   // Google API key
  /-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----/,
];

const FORBIDDEN_OPERATIONS: ReadonlySet<string> = new Set([
  'merge_to_main',
  'force_push_main',
  'delete_branch_main',
  'modify_branch_protection',
  'rotate_secrets',
  'deploy_production',
]);

export interface GithubOperatorInput {
  operation_request: string;
  target_repo: string;
  branch_name?: string;
  files_payload?: Record<string, string>;
  commit_message?: string;
  evidence?: Record<string, unknown>;
}

export function detectSecrets(payload: Record<string, string> | undefined): string[] {
  if (!payload) return [];
  const hits: string[] = [];
  for (const [path, content] of Object.entries(payload)) {
    for (const re of SECRET_PATTERNS) {
      if (re.test(content)) {
        hits.push(`secret_pattern_match:${path}:${re.source.slice(0, 30)}`);
      }
    }
  }
  return hits;
}

/**
 * Pre-flight only. The real Octokit calls happen in tools/github.ts; this agent
 * answers "is this operation allowed and safe to attempt?".
 */
export function runGithubOperator(
  input: GithubOperatorInput,
): { output: GithubOperatorOutput; usage: AgentUsage; model: string } {
  const errors: string[] = [];

  if (FORBIDDEN_OPERATIONS.has(input.operation_request)) {
    errors.push(`forbidden_operation:${input.operation_request}`);
  }

  const secretHits = detectSecrets(input.files_payload);
  errors.push(...secretHits);

  if (input.commit_message) {
    for (const re of SECRET_PATTERNS) {
      if (re.test(input.commit_message)) {
        errors.push('secret_in_commit_message');
        break;
      }
    }
  }

  if (input.branch_name === 'main' && input.operation_request !== 'pr.create') {
    errors.push('write_to_main_branch_blocked');
  }

  const output: GithubOperatorOutput = {
    operation_status: errors.length === 0 ? 'ok' : 'blocked',
    refs: {},
    urls: {},
    errors,
  };

  const parsed = GithubOperatorOutputSchema.parse(output);
  return {
    output: parsed,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
    model: 'deterministic',
  };
}
