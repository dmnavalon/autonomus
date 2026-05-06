/**
 * 18_security_scope_guard — bloquea acciones peligrosas / fuera de alcance.
 * DETERMINISTIC con regex blocklist. LLM mid solo para casos ambiguos (no implementado en MVP).
 */
import {
  SecurityGuardOutputSchema,
  type SecurityGuardOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

const SECRET_PATTERNS: ReadonlyArray<RegExp> = [
  /AKIA[A-Z0-9]{16}/,
  /ghp_[A-Za-z0-9]{36,}/,
  /xox[baprs]-[A-Za-z0-9-]+/,
  /sk-[A-Za-z0-9]{40,}/,
  /AIza[0-9A-Za-z_-]{35}/,
  /-----BEGIN (RSA|OPENSSH|PRIVATE) KEY-----/,
];

const FORBIDDEN_ACTIONS: ReadonlySet<string> = new Set([
  'merge_to_main',
  'deploy_production',
  'force_push_main',
  'modify_branch_protection',
  'rotate_secrets',
  'edit_secrets',
  'bypass_human_approval',
]);

const DESTRUCTIVE_DB_PATTERNS: ReadonlyArray<RegExp> = [
  /\bDROP\s+TABLE\b/i,
  /\bTRUNCATE\b/i,
  /\bDELETE\s+FROM\s+\w+\s*;/i, // DELETE without WHERE
];

export interface SecurityGuardInput {
  proposed_action: string;
  diff_summary: string;
  protocols: string[];
  risk_flags: string[];
  agent_invoking: string;
}

export function runSecurityScopeGuard(
  input: SecurityGuardInput,
): { output: SecurityGuardOutput; usage: AgentUsage; model: string } {
  const reasons: string[] = [];
  let severity: SecurityGuardOutput['severity'] = 'low';

  if (FORBIDDEN_ACTIONS.has(input.proposed_action)) {
    reasons.push(`forbidden_action:${input.proposed_action}`);
    severity = 'critical';
  }

  for (const re of SECRET_PATTERNS) {
    if (re.test(input.diff_summary)) {
      reasons.push('secret_in_diff');
      severity = 'critical';
      break;
    }
  }

  for (const re of DESTRUCTIVE_DB_PATTERNS) {
    if (re.test(input.diff_summary)) {
      reasons.push('destructive_db_operation');
      severity = severity === 'critical' ? 'critical' : 'high';
    }
  }

  // Greylist heuristics (non-blocking, marked high)
  const greylistPaths = [
    /app\/api\/auth\//,
    /app\/api\/stripe\//,
    /app\/api\/billing\//,
    /\.env(\.|$)/,
  ];
  for (const re of greylistPaths) {
    if (re.test(input.diff_summary)) {
      if (severity === 'low') severity = 'medium';
      reasons.push(`sensitive_path:${re.source}`);
    }
  }

  const allowed = severity !== 'critical';
  const required_human_approval = severity === 'critical' || severity === 'high';

  const remediation: string[] = [];
  if (!allowed) {
    remediation.push('La acción debe ser ejecutada manualmente por un humano vía GitHub UI.');
    remediation.push('El agente NUNCA debe llamar la API de merge/production/secret-rotation.');
  } else if (severity === 'medium') {
    remediation.push('Path sensible: confirmar que el cambio es intencional y respeta protocolos correspondientes.');
  }

  const output: SecurityGuardOutput = {
    allowed,
    blocked_reason: allowed ? null : reasons.join('; ').slice(0, 300),
    required_human_approval,
    remediation,
    severity,
  };

  const parsed = SecurityGuardOutputSchema.parse(output);
  return {
    output: parsed,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
    model: 'deterministic',
  };
}
