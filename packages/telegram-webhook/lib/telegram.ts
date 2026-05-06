/**
 * Minimal Telegram Bot API client used by the webhook.
 * Includes inline-keyboard helpers + a project-header formatter so every
 * user-facing message displays the active app.
 */

import type { InlineKeyboardMarkup } from './inline-keyboard';

const TELEGRAM_API = 'https://api.telegram.org';

interface SendOpts {
  /**
   * Default is plain text (no parse_mode) because legacy Markdown breaks on stray
   * underscores (chat_id, file_path, etc.). Pass 'HTML' for explicit formatting.
   */
  parseMode?: 'Markdown' | 'HTML' | 'plain';
  disablePreview?: boolean;
  replyMarkup?: InlineKeyboardMarkup;
  /** When true, Telegram forces the user's next message to be a reply to this one. */
  forceReply?: boolean;
}

function token(): string {
  const t = process.env.TELEGRAM_BOT_TOKEN;
  if (!t) throw new Error('TELEGRAM_BOT_TOKEN missing');
  return t;
}

async function call(method: string, body: object): Promise<unknown> {
  const res = await fetch(`${TELEGRAM_API}/bot${token()}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`telegram ${method} failed: ${res.status} ${detail.slice(0, 200)}`);
  }
  return res.json();
}

export async function sendMessage(chatId: number, text: string, opts: SendOpts = {}): Promise<void> {
  const reply_markup = opts.forceReply
    ? { force_reply: true, selective: true }
    : opts.replyMarkup;
  // Default = plain text. Markdown breaks on stray `_` (chat_id, etc.); we
  // strip Markdown markers from `text` so messages still look reasonable
  // when authors used `*bold*` or backticks.
  const useMarkdown = opts.parseMode === 'Markdown' || opts.parseMode === 'HTML';
  const finalText = useMarkdown ? text : stripMarkdownMarkers(text);
  await call('sendMessage', {
    chat_id: chatId,
    text: finalText,
    parse_mode: useMarkdown ? opts.parseMode : undefined,
    disable_web_page_preview: opts.disablePreview ?? true,
    reply_markup,
  });
}

/**
 * Removes Markdown wrappers so plain-text messages don't show the asterisks
 * and backticks literally. Conservative: only handles the simple cases we
 * actually emit (`*bold*`, `` `code` `` , `[text](url)`).
 */
function stripMarkdownMarkers(s: string): string {
  return s
    .replace(/\*([^*\n]+)\*/g, '$1')
    .replace(/`([^`\n]+)`/g, '$1')
    // [text](url) → "text (url)" so Telegram autolinks the URL.
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1 ($2)');
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
  await call('answerCallbackQuery', { callback_query_id: callbackQueryId, text });
}

export async function editMessageText(
  chatId: number,
  messageId: number,
  text: string,
  opts: SendOpts = {},
): Promise<void> {
  await call('editMessageText', {
    chat_id: chatId,
    message_id: messageId,
    text,
    parse_mode: opts.parseMode ?? 'Markdown',
    disable_web_page_preview: opts.disablePreview ?? true,
    reply_markup: opts.replyMarkup,
  });
}

/**
 * Prepends a project header to every user-facing message. If `slug` is null,
 * indicates no active project (selection pending or onboarding).
 */
export function withHeader(slug: string | null, body: string): string {
  const header =
    slug === null
      ? '📁 *Proyecto:* (sin elegir)'
      : `📁 *Proyecto:* \`${slug}\``;
  return `${header}\n\n${body}`;
}
