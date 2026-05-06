/**
 * Coordinator — state machine. No LLM calls; this is pure orchestration.
 *
 * Reference: agents/13-coordinador/instructions.md (`agent_id: 01_coordinator`).
 *
 * State coverage:
 *   - state:received    → Phase 3 (live)        : recepcionista → clasificador → planificador → arquitecto
 *   - state:retesting   → Phase 3 (live)        : same as state:received entry path (loop guard)
 *   - state:planning    → Phase 4 (stub)        : router → programador → branch + commit + PR
 *   - state:coding      → Phase 4 (stub)        : programador → 08_github_operator → state:pr-created
 *   - state:pr-created  → passive (deployment_status webhook fires state:waiting-preview)
 *   - state:waiting-preview → passive
 *   - state:preview-ready → Phase 5 (stub)      : qa_planner → state:qa-running
 *   - state:qa-running  → external workflow (qa-playwright.yml emits PlaywrightExecutionOutput)
 *   - state:qa-failed   → Phase 6 (stub)        : analista_logs → reparador → state:retesting
 *   - state:auto-approved → Phase 7 (stub)      : verificador (deterministic) → state:human-review-required
 *   - state:human-review-required → terminal    : 16_telegram_notifier sends canonical text
 *   - state:failed-needs-human    → terminal    : 16_telegram_notifier sends failure text
 *   - state:cancelled             → terminal    : no-op
 *
 * Stub branches log the intended next agent and transition the label so the
 * external observer (workflow / webhook) sees forward progress; the LLM call
 * itself lands when each Phase ships.
 */
import { JobLedger } from './budget.js';
import {
  fetchIssue,
  commentOnIssue,
  transitionState,
  parseTelegramJobBody,
  type IssueSnapshot,
} from './tools/github.js';
import { currentState } from './state/labels.js';
import { runRecepcionista } from './agents/recepcionista.js';
import { runClasificador } from './agents/clasificador.js';
import { runPlanificador } from './agents/planificador.js';
import { runArquitecto } from './agents/arquitecto.js';
import type { AgentName, AgentUsage } from './types.js';
import type {
  ClasificadorOutput,
  PlanificadorOutput,
  ArquitectoOutput,
  RecepcionistaOutput,
} from './schemas/index.js';

// Agent functions newly available (Phase 4+ wiring lands incrementally).
// Importing keeps them in the dependency graph so prompt-loader cache hits and
// schemas are exercised at build time.
import { runProgramador } from './agents/programador.js';
import { runRevisorCodigo } from './agents/revisor_codigo.js';
import { runQaPlanner } from './agents/qa_planner.js';
import { runPlaywrightGeneration } from './agents/playwright.js';
import { runAnalistaLogs } from './agents/analista_logs.js';
import { runReparador } from './agents/reparador.js';
import { runVerificador } from './agents/verificador.js';
import { runProtocolBinder } from './agents/protocol_binder.js';
import { runGithubOperator } from './agents/github_operator.js';
import { runTelegramNotifier } from './agents/telegram_notifier.js';
import { runFactoryEvaluator } from './agents/factory_evaluator.js';
import { runSecurityScopeGuard } from './agents/security_scope_guard.js';
import { runPromptChangeManager } from './agents/prompt_change_manager.js';

// Suppress "unused import" linting; these will be wired in Phase 4–7 and exposed
// through the dispatcher below.
void runProgramador;
void runRevisorCodigo;
void runQaPlanner;
void runPlaywrightGeneration;
void runAnalistaLogs;
void runReparador;
void runVerificador;
void runProtocolBinder;
void runGithubOperator;
void runTelegramNotifier;
void runFactoryEvaluator;
void runSecurityScopeGuard;
void runPromptChangeManager;

export interface RunResult {
  finalState: string;
  ledger: JobLedger;
}

export async function runJob(issueNumber: number): Promise<RunResult> {
  const issue = await fetchIssue(issueNumber);
  const ledger = new JobLedger();

  const state = currentState(issue.labels);

  // Phase 3+: dispatch on state. Unknown states are no-op stubs; Phase 4–7
  // expand the dispatch table. See agents/13-coordinador/instructions.md.
  switch (state) {
    case 'state:received':
    case 'state:retesting':
      return await runIntakeAndPlanning(issue, ledger);
    case 'state:planning':
      return await stub(issue, ledger, 'state:planning', '06_model_context_router → 09_implementation_agent (Phase 4)');
    case 'state:coding':
      return await stub(issue, ledger, 'state:coding', '08_github_operator → state:pr-created (Phase 4)');
    case 'state:pr-created':
    case 'state:waiting-preview':
      return await passive(issue, ledger, state, 'awaiting deployment_status webhook (passive)');
    case 'state:preview-ready':
      return await stub(issue, ledger, 'state:preview-ready', '11_qa_planner (Phase 5)');
    case 'state:qa-running':
      return await passive(issue, ledger, state, 'qa-playwright.yml runs out-of-band; results return as comment');
    case 'state:qa-failed':
      return await stub(issue, ledger, 'state:qa-failed', '13_log_analyst → 14_repair_agent (Phase 6)');
    case 'state:repairing':
      return await stub(issue, ledger, 'state:repairing', '14_repair_agent runs, then state:retesting (Phase 6)');
    case 'state:auto-approved':
      return await stub(issue, ledger, 'state:auto-approved', '15_final_verifier → 16_telegram_notifier (Phase 7)');
    case 'state:human-review-required':
    case 'state:failed-needs-human':
    case 'state:cancelled':
      return await terminal(issue, ledger, state);
    default:
      await commentOnIssue(
        issueNumber,
        `> Coordinator: state \`${state ?? 'unknown'}\` not in dispatch table.`,
      );
      return { finalState: state ?? 'unknown', ledger };
  }
}

async function runIntakeAndPlanning(issue: IssueSnapshot, ledger: JobLedger): Promise<RunResult> {
  const issueNumber = issue.number;
  const meta = parseTelegramJobBody(issue.body);

  // ---------- step 1: Recepcionista ------------------------------------
  await transitionState(issueNumber, issue.labels, 'state:classifying');

  const recepResult = await runRecepcionista({
    raw_message: meta.rawText || issue.title,
    chat_id: meta.chatId ?? 0,
    username: meta.username,
    app_slug: meta.appSlug,
  });
  ledger.record('recepcionista', recepResult.model, recepResult.usage);
  await postAgentComment(issueNumber, 'recepcionista', recepResult.model, recepResult.output, recepResult.usage);

  if (recepResult.output.falta_info_critica) {
    await commentOnIssue(
      issueNumber,
      [
        '> Coordinator: Recepcionista detected missing critical info.',
        '',
        'Preguntas:',
        ...recepResult.output.preguntas.map((q) => `- ${q}`),
      ].join('\n'),
    );
    await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:human-review-required');
    await postLedger(issueNumber, ledger);
    return { finalState: 'state:human-review-required', ledger };
  }

  // ---------- step 2: Clasificador -------------------------------------
  const appContext = meta.appSlug ? { exists: true, slug: meta.appSlug } : null;
  const claResult = await runClasificador({
    texto_limpio: recepResult.output.texto_limpio,
    intencion_inicial: recepResult.output.intencion_inicial,
    app_context: appContext,
  });
  ledger.record('clasificador', claResult.model, claResult.usage);
  await postAgentComment(issueNumber, 'clasificador', claResult.model, claResult.output, claResult.usage);

  await ensureTypeLabel(issueNumber, claResult.output.tipo);

  if (claResult.output.siguiente_agente === 'finalizar') {
    await commentOnIssue(
      issueNumber,
      `> Coordinator: classified as \`${claResult.output.tipo}\`; no work needed.`,
    );
    await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:human-review-required');
    await postLedger(issueNumber, ledger);
    return { finalState: 'state:human-review-required', ledger };
  }

  if (claResult.output.siguiente_agente === 'preguntar_humano') {
    await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:failed-needs-human');
    await postLedger(issueNumber, ledger);
    return { finalState: 'state:failed-needs-human', ledger };
  }

  if (claResult.output.siguiente_agente === 'qa_planner') {
    await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:qa-planning');
    await commentOnIssue(
      issueNumber,
      '> Coordinator: handing off to QA planner — Phase 6 will implement this branch.',
    );
    await postLedger(issueNumber, ledger);
    return { finalState: 'state:qa-planning', ledger };
  }

  // ---------- step 3: Planificador -------------------------------------
  await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:planning');

  const planResult = await runPlanificador({
    texto_limpio: recepResult.output.texto_limpio,
    tipo: claResult.output.tipo,
    complejidad: claResult.output.complejidad,
    app_context: meta.appSlug ? { slug: meta.appSlug } : null,
  });
  ledger.record('planificador', planResult.model, planResult.usage);
  await postAgentComment(issueNumber, 'planificador', planResult.model, planResult.output, planResult.usage);

  if (planResult.output.preguntas_pendientes.length > 0) {
    await transitionState(issueNumber, await refreshLabels(issueNumber), 'state:human-review-required');
    await postLedger(issueNumber, ledger);
    return { finalState: 'state:human-review-required', ledger };
  }

  // ---------- step 4: Arquitecto ---------------------------------------
  const arqResult = await runArquitecto({
    spec: planResult.output,
    app_context: null,
    complejidad: claResult.output.complejidad,
    riesgo: claResult.output.riesgo,
  });
  ledger.record('arquitecto', arqResult.model, arqResult.usage);
  await postAgentComment(issueNumber, 'arquitecto', arqResult.model, arqResult.output, arqResult.usage);

  // Phase 3 stops here. Phase 4 picks up state:planning to invoke the Programmer.
  await commentOnIssue(
    issueNumber,
    [
      '> Coordinator: Phase 3 complete (planning + architecture).',
      '> Phase 4 (Programador) will pick up from `state:planning` and write code.',
    ].join('\n'),
  );

  await postLedger(issueNumber, ledger);
  return { finalState: 'state:planning', ledger };
}

async function stub(
  issue: IssueSnapshot,
  ledger: JobLedger,
  state: string,
  nextAgentSummary: string,
): Promise<RunResult> {
  await commentOnIssue(
    issue.number,
    [
      `> Coordinator stub for \`${state}\`.`,
      `> Next: ${nextAgentSummary}`,
      '> Logic ships in the corresponding Phase per agents/13-coordinador/instructions.md.',
    ].join('\n'),
  );
  return { finalState: state, ledger };
}

async function passive(
  issue: IssueSnapshot,
  ledger: JobLedger,
  state: string,
  reason: string,
): Promise<RunResult> {
  await commentOnIssue(issue.number, `> Coordinator: \`${state}\` is passive — ${reason}.`);
  return { finalState: state, ledger };
}

async function terminal(
  issue: IssueSnapshot,
  ledger: JobLedger,
  state: string,
): Promise<RunResult> {
  await commentOnIssue(
    issue.number,
    `> Coordinator: \`${state}\` is terminal. The human takes over from here.`,
  );
  return { finalState: state, ledger };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

async function refreshLabels(issueNumber: number): Promise<string[]> {
  return (await fetchIssue(issueNumber)).labels;
}

async function ensureTypeLabel(issueNumber: number, tipo: string): Promise<void> {
  const issue = await fetchIssue(issueNumber);
  const without = issue.labels.filter((l) => !l.startsWith('type:'));
  without.push(`type:${tipo}`);
  // setLabels replaces all labels; preserve state:* by reading the current set first.
  const { setLabels } = await import('./tools/github.js');
  await setLabels(issueNumber, without);
}

function compactJson(obj: unknown): string {
  return JSON.stringify(obj, null, 2);
}

async function postAgentComment(
  issueNumber: number,
  agent: AgentName,
  model: string,
  output: unknown,
  usage: AgentUsage,
): Promise<void> {
  const body = [
    `### 🤖 \`${agent}\` · \`${model}\``,
    '',
    '```json',
    compactJson(output),
    '```',
    '',
    `<sub>tokens: in=${usage.inputTokens} out=${usage.outputTokens} cached=${usage.cachedInputTokens} · cost=$${usage.costUsd.toFixed(4)}</sub>`,
  ].join('\n');
  await commentOnIssue(issueNumber, body);
}

async function postLedger(issueNumber: number, ledger: JobLedger): Promise<void> {
  await commentOnIssue(
    issueNumber,
    ['## 💸 Telemetry (so far)', '', ledger.summaryMarkdown()].join('\n'),
  );
}

// Re-export some types for tests
export type { ClasificadorOutput, PlanificadorOutput, ArquitectoOutput, RecepcionistaOutput, IssueSnapshot };
