/**
 * 16_telegram_notifier — envía mensajes al usuario en Telegram. DETERMINISTIC.
 *
 * Frases canónicas (sec. 8 doc maestro). NO inventar. NO prometer cero errores.
 * Llama a sendMessage del webhook (packages/telegram-webhook/lib/telegram.ts)
 * vía un thin wrapper local.
 */
import {
  TelegramNotifierOutputSchema,
  type TelegramNotifierOutput,
} from '../schemas/index.js';
import type { AgentUsage } from '../types.js';

export type MessageType =
  | 'ask_user'
  | 'progress'
  | 'terminal_success'
  | 'terminal_failure'
  | 'blocked';

export interface TelegramNotifierInput {
  message_type: MessageType;
  summary: string;
  links: { pr_url?: string; preview_url?: string; issue_url?: string };
  requested_action: string | null;
  risk_level: 'bajo' | 'medio' | 'alto';
  chat_id: number;
  issue_number?: number;
}

const MAX_TG = 4096;

export function buildMessageText(input: TelegramNotifierInput): string {
  switch (input.message_type) {
    case 'terminal_success': {
      const preview = input.links.preview_url ?? '(no preview)';
      const pr = input.links.pr_url ?? '(no PR)';
      return `No se detectaron errores bloqueantes en QA automático. Listo para revisión humana. Preview: ${preview}. PR: ${pr}.`;
    }
    case 'terminal_failure': {
      const issueNum = input.issue_number ?? 0;
      return `La fábrica no pudo cerrar el ciclo automático. Revisa el Issue #${issueNum} en GitHub. Razón: ${input.summary}.`;
    }
    case 'blocked':
      return `Acción bloqueada: ${input.summary}. Se requiere aprobación humana antes de continuar.`;
    case 'ask_user':
      return input.requested_action
        ? `${input.summary}\n\n${input.requested_action}`
        : input.summary;
    case 'progress':
    default:
      return input.summary;
  }
}

export interface TelegramSender {
  send(chatId: number, text: string): Promise<{ message_id: number }>;
}

/**
 * Deterministic message build + send. The TelegramSender abstraction lets tests
 * inject a fake; in prod, wire it to packages/telegram-webhook/lib/telegram.ts
 * sendMessage at the Phase-4 orchestrator entrypoint.
 */
export async function runTelegramNotifier(
  input: TelegramNotifierInput,
  sender: TelegramSender,
): Promise<{ output: TelegramNotifierOutput; usage: AgentUsage; model: string }> {
  let text = buildMessageText(input);
  if (text.length > MAX_TG) {
    text = text.slice(0, MAX_TG - 3) + '...';
  }
  const { message_id } = await sender.send(input.chat_id, text);

  const output: TelegramNotifierOutput = {
    sent_message_id: message_id,
    message_text: text,
    pending_user_response: input.message_type === 'ask_user',
  };
  const parsed = TelegramNotifierOutputSchema.parse(output);
  return {
    output: parsed,
    usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, costUsd: 0 },
    model: 'deterministic',
  };
}
