/**
 * Telegram webhook entrypoint.
 *
 *   Telegram → POST /api/telegram/webhook → verify secret → dispatch:
 *     - active wizard? → projects-flow handles message/callback → respond
 *     - message               → command? command-flow → resolve project / create Issue
 *     - callback_query        → start-menu / wizard-step / pick-app / onboarding
 *
 * Always returns 200 to Telegram (except on bad secret = 403).
 */
import { isValidWebhookRequest } from '@/lib/auth';
import {
  isAuthorizedChatId,
  setLastActiveSlug,
} from '@/lib/registry';
import { resolveApp } from '@/lib/apps-resolver';
import {
  buildAppSelectionKeyboard,
  parseCallbackData,
  type ParsedCallback,
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
import { dispatchCommand } from '@/lib/commands';
import { clearWizard, getWizard } from '@/lib/conversation-state';
import {
  appDisplayName,
  continueWizardOnCallback,
  continueWizardOnText,
  isWizardTextStep,
  startCreateWizard,
  startLinkWizard,
  welcomeMessage,
  type FlowMessage,
  type FlowResult,
} from '@/lib/projects-flow';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TelegramMessage {
  message_id: number;
  text?: string;
  chat: { id: number };
  from?: { username?: string; first_name?: string };
  reply_to_message?: { message_id: number };
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
  try {
    const update = (await req.json().catch(() => null)) as TelegramUpdate | null;
    if (!update) return Response.json({ ok: true, skipped: 'no-body' });

    if (update.callback_query) {
      return await handleCallbackQuery(update.callback_query);
    }
    if (update.message?.text) {
      return await handleMessage(update.message);
    }
    return Response.json({ ok: true, skipped: 'no-text-or-callback' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    const stack = err instanceof Error ? err.stack : undefined;
    console.error('[webhook] handler crashed:', detail);
    if (stack) console.error(stack);
    // Return 200 so Telegram doesn't retry the same broken update forever.
    return Response.json({ ok: false, error: detail.slice(0, 300) }, { status: 200 });
  }
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

  // Onboarding identity commands work without auth so a new user can find their chat_id.
  if (text === '/start' || text === '/id' || text === '/whoami') {
    await sendMessage(
      chatId,
      withHeader(
        null,
        [
          '*Autonomus*',
          '',
          `Tu chat_id es: \`${chatId}\``,
          `Tu username: \`${username ?? '(sin username)'}\``,
          '',
          'Si el admin ya te autorizó, mandame cualquier mensaje y te muestro tus proyectos.',
          'Sino, pídele que te agregue al registro.',
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
        `chat_id \`${chatId}\` no autorizado. Pídele al admin que te agregue.`,
      ),
    );
    return Response.json({ ok: true, mode: 'unauthorized', chatId });
  }

  // Active wizard → forward text to the wizard handler.
  const wizard = await getWizard(chatId);
  if (wizard && isWizardTextStep(wizard) && !text.startsWith('/')) {
    await applyFlow(chatId, await continueWizardOnText(wizard, text, username));
    return Response.json({ ok: true, mode: 'wizard-text' });
  }

  // /new — starts the create-project wizard regardless of active sticky
  if (text === '/new') {
    await applyFlow(chatId, await startCreateWizard(chatId));
    return Response.json({ ok: true, mode: 'wizard-create' });
  }

  // Slash commands (auth required)
  const cmd = await dispatchCommand(text, chatId, username);
  if (cmd) {
    await sendMessage(chatId, withHeader(cmd.headerSlug, cmd.text), {
      replyMarkup: cmd.replyMarkup,
    });
    return Response.json({ ok: true, mode: 'command' });
  }

  // Chitchat filter — greetings, thanks, short acks don't create Issues.
  const chitchat = classifyChitchat(text);
  if (chitchat) {
    const sticky = await import('@/lib/registry').then((m) => m.getLastActiveSlug(chatId));
    const reply = sticky
      ? `${chitchat} Estás en el proyecto ${sticky}. Cuando quieras pedirme algo, escríbelo directamente.`
      : `${chitchat} Cuando quieras empezar, dime qué necesitas o usa /new para crear un proyecto.`;
    await sendMessage(chatId, withHeader(sticky, reply));
    return Response.json({ ok: true, mode: 'chitchat' });
  }

  // Vague-task filter — "quiero mandar un bug" has intent but no actual content.
  // Ask for the real description before creating any Issue.
  if (looksLikeVagueTask(text)) {
    const sticky = await import('@/lib/registry').then((m) => m.getLastActiveSlug(chatId));
    await sendMessage(
      chatId,
      withHeader(
        sticky,
        '¿Qué necesitás exactamente? Describílo con detalle (qué pasa, cómo reproducirlo, qué esperabas) y lo proceso enseguida.',
      ),
    );
    return Response.json({ ok: true, mode: 'vague-task' });
  }

  // Free-text message — software_nuevo intent shortcut (no project resolution needed).
  if (looksLikeSoftwareNuevo(text)) {
    const issue = await createJobIssue({
      message: text,
      chatId,
      username,
      appSlug: null,
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
    await applyFlow(chatId, await welcomeMessage(chatId, 0));
    return Response.json({ ok: true, mode: 'welcome' });
  }

  if (r.status === 'sticky') {
    const issue = await createJobIssue({ message: text, chatId, username, appSlug: r.app.slug });
    await sendMessage(
      chatId,
      withHeader(
        r.app.slug,
        `✅ Recibido. Job #${issue.number} en ${appDisplayName(r.app)}.\nCuando esté listo te aviso aquí.`,
      ),
    );
    return Response.json({ ok: true, issue: issue.number, mode: 'sticky' });
  }

  if (r.status === 'unique') {
    // One project exists but no sticky (user did /out). Create the Issue in pending
    // state and ask for a one-tap confirmation — same pattern as 'multiple'.
    const issue = await createJobIssue({
      message: text,
      chatId,
      username,
      appSlug: null,
      availableAppSlugs: [r.app.slug],
    });
    await sendMessage(
      chatId,
      withHeader(null, `Job #${issue.number} listo. ¿Va para ${appDisplayName(r.app)}?`),
      { replyMarkup: buildAppSelectionKeyboard([r.app], issue.number) },
    );
    return Response.json({ ok: true, issue: issue.number, mode: 'unique-confirm' });
  }

  // r.status === 'multiple' → ask which project
  const issue = await createJobIssue({
    message: text,
    chatId,
    username,
    appSlug: null,
    availableAppSlugs: r.apps.map((a) => a.slug),
  });
  await sendMessage(
    chatId,
    withHeader(null, `Job [#${issue.number}](${issue.url}) creado. ¿Sobre qué proyecto es?`),
    { replyMarkup: buildAppSelectionKeyboard(r.apps, issue.number) },
  );
  return Response.json({ ok: true, issue: issue.number, mode: 'pending-selection' });
}

/**
 * Catches messages that express task intent without actual content, e.g.:
 * "quiero mandar un bug", "tengo un error", "quiero hacer un cambio".
 * These need clarification before an Issue can be created.
 */
function looksLikeVagueTask(text: string): boolean {
  const t = text.trim();
  const words = t.split(/\s+/).length;
  // Must be short enough to lack a real description
  if (words > 14) return false;
  return /\b(quiero\s+(mandar|enviar|reportar|hacer|crear|subir)\s+(un|una)\s+(bug|error|problema|cambio|feature|mejora|tarea|solicitud|ticket|issue)|tengo\s+(un|una)\s+(bug|error|problema|duda|consulta)|hay\s+(un|una)\s+(bug|error|problema)|necesito\s+(reportar|enviar|mandar)\s+(un|una|algo)|quiero\s+reportar\s+algo)\b/i.test(t);
}

function looksLikeSoftwareNuevo(text: string): boolean {
  return /\b(quiero una app|crear una app|nueva aplicaci[oó]n|crear app nueva|app que detect[eé]|app para)\b/i.test(
    text,
  );
}

/**
 * Detects messages that are social/meta (greetings, thanks, acks, bot questions)
 * and should NOT create a GitHub Issue. Returns a short reply string if chitchat,
 * or null if the message looks like a real task request.
 */
function classifyChitchat(text: string): string | null {
  const t = text.trim().toLowerCase();

  // Very short messages with no actionable verb are almost always chitchat
  if (t.split(/\s+/).length <= 2) {
    if (/^(hola|buenas|hey|hi|hello|buen\s?d[ií]a|buenos\s?d[ií]as|buenas\s?tardes|buenas\s?noches|qu[eé]\s?tal|c[oó]mo\s?est[aá]s?)/.test(t)) {
      return '👋 Hola!';
    }
    if (/^(gracias|thanks|ok\s?gracias|muchas\s?gracias|thx|genial|perfecto|dale|listo|entendido|de\s?acuerdo|claro|ok|okay|bien|chevere|chévere|excelente|nominal)$/.test(t)) {
      return '👍';
    }
    if (/^(adi[oó]s|chau|bye|hasta\s?luego|hasta\s?pronto|nos\s?vemos|ciao)/.test(t)) {
      return '👋 Hasta luego!';
    }
    if (/^(s[ií]|no|nop|nope|yep|yup)$/.test(t)) {
      return '👍 Entendido.';
    }
  }

  // Longer meta-questions about the bot
  if (/\b(qu[eé]\s+puedes\s+hacer|para\s+qu[eé]\s+sirves|c[oó]mo\s+funciona[sz]?|qu[eé]\s+eres|ayuda\s+con\s+qu[eé])\b/.test(t)) {
    return '🤖 Soy tu fábrica de software. Descríbeme qué necesitas hacer en tu proyecto y lo convierto en un PR listo para revisar. Usa /help para ver los comandos disponibles.';
  }

  return null;
}

// ---------------------------------------------------------------------------
// callback_query handler
// ---------------------------------------------------------------------------

async function handleCallbackQuery(cq: TelegramCallbackQuery): Promise<Response> {
  const chatId = cq.message.chat.id;
  const username = cq.from?.username ?? cq.from?.first_name;
  const parsed = parseCallbackData(cq.data);

  if (!(await isAuthorizedChatId(chatId))) {
    await answerCallbackQuery(cq.id, 'no autorizado');
    return Response.json({ ok: true, mode: 'unauthorized-callback' });
  }

  // Welcome menu actions
  if (parsed.kind === 'start') {
    await answerCallbackQuery(cq.id);
    if (parsed.action === 'new') {
      await applyFlow(chatId, await startCreateWizard(chatId));
    } else if (parsed.action === 'link') {
      await applyFlow(chatId, await startLinkWizard(chatId));
    } else {
      await sendMessage(chatId, withHeader(null, 'Cancelado.'));
    }
    return Response.json({ ok: true, mode: 'start-menu' });
  }

  if (parsed.kind === 'cancel-wizard') {
    await answerCallbackQuery(cq.id, 'cancelado');
    await clearWizard(chatId);
    await sendMessage(chatId, withHeader(null, 'Asistente cancelado.'));
    return Response.json({ ok: true, mode: 'cancel-wizard' });
  }

  // Pick existing app for a pending Issue (or set sticky if issue=0)
  if (parsed.kind === 'pick') {
    return handlePickApp(cq, parsed);
  }

  // Wizard step callbacks
  const wizard = await getWizard(chatId);
  if (wizard) {
    await answerCallbackQuery(cq.id);
    await applyFlow(chatId, await continueWizardOnCallback(wizard, parsed, username));
    return Response.json({ ok: true, mode: 'wizard-callback' });
  }

  await answerCallbackQuery(cq.id, 'callback desconocido');
  return Response.json({ ok: true, mode: 'unknown-callback' });
}

async function handlePickApp(
  cq: TelegramCallbackQuery,
  parsed: Extract<ParsedCallback, { kind: 'pick' }>,
): Promise<Response> {
  const chatId = cq.message.chat.id;
  try {
    if (parsed.issueNumber > 0) {
      await attachAppSlug(parsed.issueNumber, parsed.slug);
    }
    await setLastActiveSlug(chatId, parsed.slug);
    await answerCallbackQuery(cq.id, `Trabajando en ${parsed.slug}`);
    const factoryRepo = process.env.FACTORY_REPO ?? 'dmnavalon/autonomus';
    const text = parsed.issueNumber > 0
      ? `Job [#${parsed.issueNumber}](https://github.com/${factoryRepo}/issues/${parsed.issueNumber}) ahora apunta a \`${parsed.slug}\`. Te aviso cuando esté listo.`
      : `Trabajando en *${parsed.slug}*. Mandame tu solicitud.`;
    await sendMessage(chatId, withHeader(parsed.slug, text));
    return Response.json({ ok: true, mode: 'pick-applied' });
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    await answerCallbackQuery(cq.id, 'error');
    await sendMessage(chatId, withHeader(null, `No pude aplicar la selección: ${detail.slice(0, 200)}`));
    return Response.json({ ok: false, error: detail.slice(0, 200) });
  }
}

// ---------------------------------------------------------------------------
// helper
// ---------------------------------------------------------------------------

async function applyFlow(chatId: number, result: FlowResult): Promise<void> {
  for (const m of result.messages) {
    await sendUserMessage(chatId, m);
  }
  if (result.setSticky) {
    await setLastActiveSlug(chatId, result.setSticky).catch(() => undefined);
  }
}

async function sendUserMessage(chatId: number, m: FlowMessage): Promise<void> {
  await sendMessage(chatId, m.text, {
    replyMarkup: m.replyMarkup,
    forceReply: m.forceReply,
  });
}
