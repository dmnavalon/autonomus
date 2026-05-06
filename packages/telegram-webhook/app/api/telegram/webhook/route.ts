/**
 * Telegram webhook entrypoint.
 *
 *   Telegram → POST /api/telegram/webhook → verify secret → dispatch:
 *     - message               → resolve project / handle command / create Issue
 *     - callback_query (button) → attach app to pending Issue or onboarding action
 *
 * Always returns 200 to Telegram (except on bad secret = 403) so the bot does
 * not retry; user-facing rejections are conveyed via sendMessage.
 */
import { isValidWebhookRequest } from '@/lib/auth';
import {
  isAuthorizedChatId,
  setLastActiveSlug,
} from '@/lib/registry';
import { resolveApp } from '@/lib/apps-resolver';
import {
  buildAppSelectionKeyboard,
  buildOnboardingKeyboard,
  parseCallbackData,
} from '@/lib/inline-keyboard';
import {
  attachAppSlug,
  createJobIssue,
} from '@/lib/github-issue';
import {
  answerCallbackQuery,
  sendMessage,
  withHeader,
} from '@/lib/telegram';
import { dispatchCommand, helpForOnboarding } from '@/lib/commands';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: { username?: string; first_name?: string };
}
interface TelegramCallbackQuery {
  id: string;
  data: string;
  message: TelegramMessage;
  from?: { username?: string; first_name?: string };
}
interface TelegramUpdate {
  message?: TelegramMessage;
  callback_query?: TelegramCallbackQuery;
}

export async function POST(req: Request): Promise<Response> {
  if (!isValidWebhookRequest(req)) {
    return new Response('forbidden', { status: 403 });
  }
  const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
  if (!update) return Response.json({ ok: true, skipped: 'no-body' });

  if (update.callback_query) {
    return handleCallbackQuery(update.callback_query);
  }
  if (update.message?.text) {
    return handleMessage(update.message);
  }
  return Response.json({ ok: true, skipped: 'no-text-or-callback' });
}

// ---------------------------------------------------------------------------
// message handler
// ---------------------------------------------------------------------------

async function handleMessage(message: TelegramMessage): Promise<Response> {
  if (typeof message.chat?.id !== 'number' || !message.text) {
    return Response.json({ ok: true, skipped: 'bad-message' });
  }
  const text = message.text.trim();
  const chatId = message.chat.id;
  const username = message.from?.username ?? message.from?.first_name;

  // /start, /id, /whoami — usable BEFORE auth so a new user can discover their chat_id.
  if (text === '/start' || text === '/id' || text === '/whoami') {
    await sendMessage(
      chatId,
      withHeader(
        null,
        [
          '*Autonomus — Software Factory Agent*',
          '',
          `Tu chat_id es: \`${chatId}\``,
          `Tu username: \`${username ?? '(sin username)'}\``,
          '',
          'Para autorizarte, agrega tu chat_id a `registry/users.json` en el repo.',
          'Después podés mandarme solicitudes y abro Issues.',
          'Usá `/help` para ver comandos.',
        ].join('\n'),
      ),
    );
    return Response.json({ ok: true, mode: 'onboarding' });
  }

  if (!(await isAuthorizedChatId(chatId))) {
    await sendMessage(
      chatId,
      withHeader(
        null,
        `chat_id \`${chatId}\` no autorizado. Pídele al admin que te agregue a \`registry/users.json\`.`,
      ),
    );
    return Response.json({ ok: true, mode: 'unauthorized', chatId });
  }

  // Slash commands (auth required)
  const cmd = await dispatchCommand(text, chatId, username);
  if (cmd) {
    await sendMessage(chatId, withHeader(cmd.headerSlug, cmd.text));
    return Response.json({ ok: true, mode: 'command' });
  }

  // Free-text message: detect software_nuevo intent (heuristic) — no project
  // resolution needed because the factory will create the repo. The Recepcionista
  // re-classifies on its end.
  if (looksLikeSoftwareNuevo(text)) {
    const issue = await createJobIssue({
      message: text,
      chatId,
      username,
      appSlug: null, // software_nuevo → factory creates the repo; null is fine
      availableAppSlugs: [],
    });
    await sendMessage(
      chatId,
      withHeader(
        null,
        `✅ Recibido. Job [#${issue.number}](${issue.url}) creado como \`software_nuevo\`. La fábrica creará el repo.`,
      ),
    );
    return Response.json({ ok: true, issue: issue.number, mode: 'software_nuevo' });
  }

  // Resolve the active project for an existing-app message.
  const r = await resolveApp(chatId);

  if (r.status === 'none') {
    await sendMessage(
      chatId,
      withHeader(null, helpForOnboarding()),
      { replyMarkup: buildOnboardingKeyboard() },
    );
    return Response.json({ ok: true, mode: 'no-apps' });
  }

  if (r.status === 'sticky' || r.status === 'unique') {
    if (r.status === 'unique') await setLastActiveSlug(chatId, r.app.slug);
    const issue = await createJobIssue({
      message: text,
      chatId,
      username,
      appSlug: r.app.slug,
    });
    await sendMessage(
      chatId,
      withHeader(
        r.app.slug,
        `✅ Recibido. Job [#${issue.number}](${issue.url}) creado.\nCuando esté listo te aviso aquí.`,
      ),
    );
    return Response.json({ ok: true, issue: issue.number, mode: r.status });
  }

  // r.status === 'multiple' → ask which app
  const issue = await createJobIssue({
    message: text,
    chatId,
    username,
    appSlug: null,
    availableAppSlugs: r.apps.map((a) => a.slug),
  });
  await sendMessage(
    chatId,
    withHeader(null, `Job [#${issue.number}](${issue.url}) creado. ¿Sobre qué app es?`),
    { replyMarkup: buildAppSelectionKeyboard(r.apps, issue.number) },
  );
  return Response.json({ ok: true, issue: issue.number, mode: 'pending-selection' });
}

function looksLikeSoftwareNuevo(text: string): boolean {
  return /\b(quiero una app|crear una app|nueva aplicaci[oó]n|crear app nueva|app que detect[eé]|app para)\b/i.test(
    text,
  );
}

// ---------------------------------------------------------------------------
// callback_query handler
// ---------------------------------------------------------------------------

async function handleCallbackQuery(cq: TelegramCallbackQuery): Promise<Response> {
  const chatId = cq.message.chat.id;
  const parsed = parseCallbackData(cq.data);

  if (parsed.kind === 'pick') {
    if (!(await isAuthorizedChatId(chatId))) {
      await answerCallbackQuery(cq.id, 'no autorizado');
      return Response.json({ ok: true, mode: 'unauthorized-callback' });
    }
    try {
      await attachAppSlug(parsed.issueNumber, parsed.slug);
      await setLastActiveSlug(chatId, parsed.slug);
      await answerCallbackQuery(cq.id, `Trabajando en ${parsed.slug}`);
      await sendMessage(
        chatId,
        withHeader(
          parsed.slug,
          `Job [#${parsed.issueNumber}](https://github.com/${process.env.FACTORY_REPO ?? 'dmnavalon/autonomus'}/issues/${parsed.issueNumber}) ahora apunta a \`${parsed.slug}\`. Te aviso cuando esté listo.`,
        ),
      );
      return Response.json({ ok: true, mode: 'pick-applied' });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'unknown';
      await answerCallbackQuery(cq.id, 'error aplicando pick');
      await sendMessage(chatId, withHeader(null, `No pude aplicar la selección: ${detail.slice(0, 200)}`));
      return Response.json({ ok: false, error: detail.slice(0, 200) });
    }
  }

  if (parsed.kind === 'onboard') {
    await answerCallbackQuery(cq.id);
    if (parsed.action === 'link') {
      await sendMessage(chatId, withHeader(null, helpForOnboarding()));
    } else if (parsed.action === 'new') {
      await sendMessage(
        chatId,
        withHeader(
          null,
          'Ok. Describime la app que quieres crear (qué hace, en una o dos frases) y abro un Issue de tipo `software_nuevo`. La fábrica crea el repo y el Vercel project.',
        ),
      );
    } else {
      await sendMessage(chatId, withHeader(null, helpForOnboarding()));
    }
    return Response.json({ ok: true, mode: 'onboard' });
  }

  await answerCallbackQuery(cq.id, 'callback desconocido');
  return Response.json({ ok: true, mode: 'unknown-callback' });
}
