/**
 * Minimal Telegram client for the orchestrator. The Coordinator uses this to
 * send the terminal canonical messages (human-review-required, failed-needs-human).
 */
const API = 'https://api.telegram.org';

export async function sendTelegramMessage(chatId: number, text: string): Promise<void> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN missing');
  const res = await fetch(`${API}/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'Markdown',
      disable_web_page_preview: true,
    }),
  });
  if (!res.ok) throw new Error(`telegram sendMessage failed: ${res.status}`);
}
