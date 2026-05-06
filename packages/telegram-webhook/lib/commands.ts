/**
 * Slash-command handlers for the Telegram bot.
 *
 * Public commands (visible in /help):
 *   /start, /id, /whoami      onboarding identity
 *   /apps                     list linked projects (by label)
 *   /use <name>               switch active project
 *   /current                  show active project
 *   /help                     this list
 *   /cancel                   abort the active wizard
 *
 * Advanced (only mentioned in /help under "Modo avanzado"):
 *   /link <slug> <user/repo>  manual one-shot linking
 */
import {
  getLastActiveSlug,
  getLinkedApps,
  setLastActiveSlug,
  type RegistryApp,
} from './registry';
import { openLinkAppPR } from './github-issue';
import { clearWizard, getWizard } from './conversation-state';
import { appDisplayName } from './projects-flow';
import type { InlineKeyboardMarkup } from './inline-keyboard';

export interface CommandResult {
  text: string;
  /** Slug to use in the project-header. null = no active project. */
  headerSlug: string | null;
  replyMarkup?: InlineKeyboardMarkup;
}

export async function handleApps(chatId: number): Promise<CommandResult> {
  const apps = await getLinkedApps(chatId);
  const sticky = await getLastActiveSlug(chatId);
  if (apps.length === 0) {
    return {
      text: 'No tienes proyectos vinculados todavía. Mandame un mensaje y te muestro las opciones para crear o vincular uno.',
      headerSlug: null,
    };
  }
  const lines = apps.map((a) => {
    const display = appDisplayName(a);
    const marker = a.slug === sticky ? '✅' : '•';
    return `${marker} *${display}*`;
  });
  return {
    text: ['*Tus proyectos:*', '', ...lines, '', 'Cambiar activo: `/use <nombre>` — Crear nuevo: `/new`'].join('\n'),
    headerSlug: sticky,
  };
}

export async function handleUse(chatId: number, args: string): Promise<CommandResult> {
  const query = args.trim();
  if (!query) {
    return {
      text: 'Uso: `/use <nombre>`. Probá `/apps` para ver tus proyectos.',
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  const apps = await getLinkedApps(chatId);
  const found = matchApp(apps, query);
  if (!found) {
    const list = apps.length > 0
      ? apps.map((a) => `*${appDisplayName(a)}*`).join(', ')
      : '(ninguno)';
    return {
      text: `No encuentro un proyecto que coincida con "${query}".\n\nDisponibles: ${list}.`,
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  await setLastActiveSlug(chatId, found.slug);
  return {
    text: `Ahora trabajando en *${appDisplayName(found)}*.`,
    headerSlug: found.slug,
  };
}

export async function handleCurrent(chatId: number): Promise<CommandResult> {
  const sticky = await getLastActiveSlug(chatId);
  if (!sticky) {
    return { text: 'No tienes proyecto activo. Mandame un mensaje y te muestro las opciones.', headerSlug: null };
  }
  const apps = await getLinkedApps(chatId);
  const app = apps.find((a) => a.slug === sticky);
  return {
    text: `Proyecto activo: *${app ? appDisplayName(app) : sticky}*.`,
    headerSlug: sticky,
  };
}

export async function handleHelp(chatId: number): Promise<CommandResult> {
  const sticky = await getLastActiveSlug(chatId);
  return {
    text: [
      '*Comandos:*',
      '`/apps` — lista tus proyectos',
      '`/use <nombre>` — cambia el proyecto activo',
      '`/out` — salir del proyecto activo',
      '`/new` — crea un proyecto nuevo (asistente)',
      '`/current` — muestra el proyecto activo',
      '`/cancel` — aborta el asistente actual (si hay uno activo)',
      '`/help` — esta ayuda',
      '`/id` — muestra tu chat_id',
      '',
      'Cualquier otro mensaje se trata como solicitud sobre el proyecto activo. Si no tienes ninguno, te muestro un menú para crear o vincular uno.',
      '',
      '*Modo avanzado:*',
      '`/link <slug> <usuario/repo>` — vincular manualmente sin usar el asistente.',
    ].join('\n'),
    headerSlug: sticky,
  };
}

export async function handleOut(chatId: number): Promise<CommandResult> {
  const sticky = await getLastActiveSlug(chatId);
  if (!sticky) {
    return { text: 'No estás en ningún proyecto.', headerSlug: null };
  }
  await setLastActiveSlug(chatId, null);
  return { text: `Saliste del proyecto ${sticky}. Puedes elegir otro con /apps o crear uno con /new.`, headerSlug: null };
}

export async function handleCancel(chatId: number): Promise<CommandResult> {
  const wiz = await getWizard(chatId);
  if (!wiz) {
    return {
      text: 'No hay asistente activo.',
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  await clearWizard(chatId);
  return {
    text: 'Asistente cancelado.',
    headerSlug: await getLastActiveSlug(chatId),
  };
}

export async function handleLink(
  chatId: number,
  args: string,
  username: string | undefined,
): Promise<CommandResult> {
  const tokens = args.trim().split(/\s+/);
  if (tokens.length !== 2) {
    return {
      text: ['*Modo avanzado:* `/link <slug> <usuario/repo>`', '', 'Ejemplo:', '`/link mi-tienda dmnavalon/mi-tienda-online`'].join('\n'),
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  const [slug, repo] = tokens as [string, string];
  if (!/^[a-z][a-z0-9-]{0,29}$/.test(slug)) {
    return { text: `Slug inválido (\`${slug}\`). Debe ser kebab-case lowercase, ≤30 chars.`, headerSlug: null };
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return { text: `Repo inválido (\`${repo}\`). Formato esperado: \`usuario/repo\`.`, headerSlug: null };
  }
  try {
    const pr = await openLinkAppPR({ slug, repo, ownerChatId: chatId, username });
    return {
      text: [
        `PR abierto: [#${pr.number}](${pr.url})`,
        '',
        'Mergealo cuando estés listo. El cache del webhook expira ~60s después.',
      ].join('\n'),
      headerSlug: await getLastActiveSlug(chatId),
    };
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown';
    return { text: `No pude abrir el PR: ${detail.slice(0, 200)}`, headerSlug: null };
  }
}

function matchApp(apps: RegistryApp[], query: string): RegistryApp | null {
  const lower = query.toLowerCase();
  // Exact slug match first.
  const bySlug = apps.find((a) => a.slug === lower);
  if (bySlug) return bySlug;
  // Exact label match (case-insensitive).
  const byLabel = apps.find((a) => (a.label ?? '').toLowerCase() === lower);
  if (byLabel) return byLabel;
  // Prefix match on label or slug.
  const byPrefix = apps.find(
    (a) => a.slug.startsWith(lower) || (a.label ?? '').toLowerCase().startsWith(lower),
  );
  return byPrefix ?? null;
}

/** Returns null if not a recognised command; otherwise CommandResult. */
export async function dispatchCommand(
  text: string,
  chatId: number,
  username: string | undefined,
): Promise<CommandResult | null> {
  if (!text.startsWith('/')) return null;
  const space = text.indexOf(' ');
  const cmd = (space === -1 ? text : text.slice(0, space)).toLowerCase();
  const args = space === -1 ? '' : text.slice(space + 1);

  switch (cmd) {
    case '/apps':
      return handleApps(chatId);
    case '/use':
      return handleUse(chatId, args);
    case '/current':
      return handleCurrent(chatId);
    case '/help':
      return handleHelp(chatId);
    case '/out':
    case '/exit':
    case '/salir':
      return handleOut(chatId);
    case '/cancel':
      return handleCancel(chatId);
    case '/link':
      return handleLink(chatId, args, username);
    case '/new':
    case '/start':
    case '/id':
    case '/whoami':
      return null; // delegated to webhook (onboarding response / flow)
    default:
      return { text: `Comando desconocido: \`${cmd}\`. Usá \`/help\`.`, headerSlug: null };
  }
}

export type { RegistryApp };
