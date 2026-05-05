/**
 * Coordinator — state machine. No LLM calls; this is pure orchestration.
 *
 * For Phase 3 we cover: state:received → state:classifying → state:planning.
 * Phase 4 adds state:coding (Programador) and onward.
 */
import { JobLedger } from './budget.js';
import {
  fetchIssue,
  commentOnIssue,
  transitionState,
  parseTelegramJobBody,
  type IssueSnapshot,
} from './tools/github.js';
import { currentState, currentTypeLabel } from './state/labels.js';
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

export interface RunResult {
  finalState: string;
  ledger: JobLedger;
}

export async function runJob(issueNumber: number): Promise<RunResult> {
  const issue = await fetchIssue(issueNumber);
  const ledger = new JobLedger();

  const meta = parseTelegramJobBody(issue.body);
  const state = currentState(issue.labels);

  if (state !== 'state:received' && state !== 'state:retesting') {
    await commentOnIssue(
      issueNumber,
      `> Coordinator: state \`${state ?? 'unknown'}\` not handled in Phase 3 yet. No-op.`,
    );
    return { finalState: state ?? 'unknown', ledger };
  }

  // ---------- step 1: Recepcionista ------------------------------------
  await transitionState(issueNumber, issue.labels, 'state:classifying');

  const recepResult = await runRecepcionista({
    raw_message: meta.rawText || issue.title,
    chat_id: meta.chatId ?? 0,
    username: meta.username,
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
  const claResult = await runClasificador({
    texto_limpio: recepResult.output.texto_limpio,
    intencion_inicial: recepResult.output.intencion_inicial,
    app_context: null, // Phase 4 will populate this from registry/apps.json
  });
  ledger.record('clasificador', claResult.model, claResult.usage);
  await postAgentComment(issueNumber, 'clasificador', claResult.model, claResult.output, claResult.usage);

  // Add type label
  await ensureTypeLabel(issueNumber, claResult.output.tipo);

  // Branch by classifier decision
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
    app_context: null,
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

  // Phase 3 stops here. Phase 4 picks this up to invoke the Programmer.
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
  // setLabels replaces all labels; we already preserve state:*, so include them
  // by reading the current set.
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
