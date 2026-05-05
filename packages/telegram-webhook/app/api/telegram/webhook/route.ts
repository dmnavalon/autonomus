/**
 * Telegram webhook entrypoint.
 *
 *   Telegram → POST /api/telegram/webhook → verify secret → check chat_id →
 *   create GitHub Issue → reply on Telegram → 200 OK.
 *
 * Always returns 200 to Telegram (except on bad secret = 403) so the bot does
 * not retry; user-facing rejections are conveyed via sendMessage.
 */
import { isValidWebhookRequest } from '@/lib/auth';
import { isAuthorizedChatId } from '@/lib/registry';
import { createJobIssue } from '@/lib/github-issue';
import { sendMessage } from '@/lib/telegram';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TelegramUpdate {
  message?: {
    text?: string;
    chat: { id: number };
    from?: { username?: string; first_name?: string };
  };
  edited_message?: unknown;
}

export async function POST(req: Request): Promise<Response> {
  if (!isValidWebhookRequest(req)) {
    return new Response('forbidden', { status: 403 });
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  const message = update?.message;

  // Skip non-text updates (edits, photos, etc. — handled in later phases).
  if (!message?.text || typeof message.chat?.id !== 'number') {
    return Response.json({ ok: true, skipped: 'no-text-message' });
  }

  const text = message.text.trim();
  const chatId = message.chat.id;
  const username = message.from?.username ?? message.from?.first_name;

  // Onboarding helpers — usable BEFORE the user is in the registry.
  if (text === '/start' || text === '/id' || text === '/whoami') {
    await sendMessage(
      chatId,
      [
        '*Autonomus — Software Factory Agent*',
        '',
        `Tu chat_id es: \`${chatId}\``,
        `Tu username: \`${username ?? '(sin username)'}\``,
        '',
        'Para autorizarte, agrega tu chat_id a `registry/users.json` en el repo y hace push.',
        'Una vez autorizado, escribime cualquier solicitud (bug, feature, app nueva) y abriré un Issue.',
      ].join('\n'),
    );
    return Response.json({ ok: true, mode: 'onboarding' });
  }

  if (!(await isAuthorizedChatId(chatId))) {
    await sendMessage(
      chatId,
      [
        `chat_id \`${chatId}\` no autorizado.`,
        'Pídele al admin que te agregue a `registry/users.json` en el repo `dmnavalon/autonomus`.',
        'Mientras tanto, podes usar `/id` para ver tu chat_id.',
      ].join('\n'),
    );
    return Response.json({ ok: true, mode: 'unauthorized', chatId });
  }

  try {
    const issue = await createJobIssue({ message: text, chatId, username });
    await sendMessage(
      chatId,
      [
        `✅ Recibido. Job [#${issue.number}](${issue.url}) creado.`,
        'Cuando esté listo para revisión humana te aviso aquí.',
      ].join('\n'),
    );
    return Response.json({ ok: true, issue: issue.number });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown error';
    console.error('webhook error:', detail);
    await sendMessage(
      chatId,
      'No pude crear el Job. Intenta de nuevo en unos minutos. Si persiste, revisa Vercel function logs.',
    ).catch(() => undefined);
    return Response.json({ ok: false, error: detail.slice(0, 200) }, { status: 200 });
  }
}
