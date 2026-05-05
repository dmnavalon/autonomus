/**
 * Minimal Telegram Bot API client. Only sendMessage is needed in the webhook;
 * richer interactions live in the orchestrator (running in GitHub Actions).
 */

const TELEGRAM_API = 'https://api.telegram.org';

export async function sendMessage(
  chatId: number,
  text: string,
  opts: { parseMode?: 'Markdown' | 'HTML'; disablePreview?: boolean } = {},
): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');

  const res = await fetch(`${TELEGRAM_API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: opts.parseMode ?? 'Markdown',
      disable_web_page_preview: opts.disablePreview ?? true,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`telegram sendMessage failed: ${res.status} ${detail.slice(0, 200)}`);
  }
}
