/**
 * 19_prompt_change_manager — versiona y audita cambios a agents/protocols/prompts/flows.
 * DETERMINISTIC con diff inspection. LLM cheap optional si > 3 agentes impactados.
 */
import {
  PromptChangeManagerOutputSchema,
  type PromptChangeManagerOutput,
  type FactoryEvaluatorOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export interface PromptChangeManagerInput {
  changed_files: string[];
  change_reason: string;
  impact_matrix_present: boolean;
  eval_results: FactoryEvaluatorOutput | null;
  forbidden_actions_diff?: { added: string[]; removed: string[] };
}

function bumpFor(file: string): 'major' | 'minor' | 'patch' {
  // Frontmatter changes (allowed_tools, forbidden_actions, contracts) → MAJOR.
  // We only see file paths here; bump heuristic uses path category. Real diff
  // analysis happens in the LLM tier (mid) when impacted_agents > 3.
  if (/required_protocols|allowed_tools|forbidden_actions|input_contract|output_contract|handoff_/.test(file)) {
    return 'major';
  }
  if (/instructions\.md$|protocols\/.*\.md$/.test(file)) return 'minor';
  return 'patch';
}

function semverBump(current: string, kind: 'major' | 'minor' | 'patch'): string {
  const [maj, min, pat] = current.split('.').map((s) => parseInt(s, 10));
  if (kind === 'major') return `${(maj ?? 1) + 1}.0.0`;
  if (kind === 'minor') return `${maj ?? 1}.${(min ?? 0) + 1}.0`;
  return `${maj ?? 1}.${min ?? 0}.${(pat ?? 0) + 1}`;
}

export function impactedAgentsFromFiles(changed: string[]): string[] {
  const ids = new Set<string>();
  for (const f of changed) {
    // agents/<NN>-<n>/instructions.md → infer agent_id from folder by lookup elsewhere; here we just note path.
    const m = f.match(/agents\/(\d{2})-([a-z-]+)\/instructions\.md/);
    if (m) ids.add(`${m[1]}-${m[2]}`);
    if (/^prompts\/shared\//.test(f)) ids.add('*all'); // shared prompt = all impacted
  }
  return [...ids];
}

export function runPromptChangeManager(
  input: PromptChangeManagerInput,
): { output: PromptChangeManagerOutput; usage: AgentUsage; model: string } {
  const impacted = impactedAgentsFromFiles(input.changed_files);

  // Approval rules
  let recommendation: PromptChangeManagerOutput['approval_recommendation'] = 'approve';
  if (input.eval_results && input.eval_results.eval_status === 'failed') {
    recommendation = 'block';
  } else if (impacted.length > 3 && !input.impact_matrix_present) {
    recommendation = 'request_changes';
  } else if (
    input.forbidden_actions_diff &&
    input.forbidden_actions_diff.removed.length > 0
  ) {
    // Removing items from forbidden_actions reduces guardrails → must be reviewed by Guardian.
    recommendation = 'block';
  } else if (!input.eval_results) {
    recommendation = 'request_changes'; // need evals before approve
  }

  // Version bumps per impacted file
  const version_bumps: Record<string, string> = {};
  for (const f of input.changed_files) {
    const kind = bumpFor(f);
    version_bumps[f] = semverBump('1.0.0', kind);
  }

  const today = new Date().toISOString().slice(0, 10);
  const changelogLines = [`## Changes - ${today}`];
  for (const f of input.changed_files) {
    changelogLines.push(`- ${f} (${bumpFor(f)})`);
  }

  const output: PromptChangeManagerOutput = {
    change_summary: `${input.changed_files.length} archivos, ${impacted.length} agente(s) impactado(s).`.slice(0, 300),
    impacted_agents: impacted,
    required_evals: ['agent_creation', 'handoff', 'protocol_compliance'],
    approval_recommendation: recommendation,
    version_bumps,
    changelog_entry: changelogLines.join('\n').slice(0, 2000),
  };

  const parsed = PromptChangeManagerOutputSchema.parse(output);
  return {
    output: parsed,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
    model: 'deterministic',
  };
}
