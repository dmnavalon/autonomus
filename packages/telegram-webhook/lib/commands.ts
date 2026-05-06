/**
 * Slash-command handlers for the Telegram bot.
 *
 * Each handler returns the text body. The webhook prepends the project header
 * and sends. Commands never create Issues — they manage user state only.
 */
import {
  getLastActiveSlug,
  getLinkedApps,
  setLastActiveSlug,
  type RegistryApp,
} from './registry';
import { openLinkAppPR } from './github-issue';

export interface CommandResult {
  text: string;
  /** Slug to use in the project-header. null = no active project. */
  headerSlug: string | null;
}

const ONBOARDING_HELP = `*Linkear app existente al bot:*

\`\`\`
/link <slug> <owner/repo>
\`\`\`

Ejemplo:
\`/link mi-tienda dmnavalon/mi-tienda-online\`

Esto abre un PR en \`dmnavalon/autonomus\` agregando tu app a \`registry/apps.json\`. Mergea el PR y en ~60s ya puedes pedirle bug fixes/features sobre esa app.

*Crear app nueva (no linkear):*
Solo describe la app: _"Quiero una app para subir una foto y detectar colores"_. El flow \`software_nuevo\` se encarga.`;

export async function handleApps(chatId: number): Promise<CommandResult> {
  const apps = await getLinkedApps(chatId);
  const sticky = await getLastActiveSlug(chatId);
  if (apps.length === 0) {
    return {
      text: 'No tienes apps linkeadas. Usa `/link <slug> <owner/repo>` para linkear una existente, o describime una nueva.',
      headerSlug: null,
    };
  }
  const lines = apps.map((a) => `${a.slug === sticky ? '✅' : '•'} \`${a.slug}\` → ${a.repo}`);
  return {
    text: ['*Apps linkeadas:*', '', ...lines, '', 'Usá `/use <slug>` para cambiar el activo.'].join(
      '\n',
    ),
    headerSlug: sticky,
  };
}

export async function handleUse(chatId: number, args: string): Promise<CommandResult> {
  const slug = args.trim();
  if (!slug) {
    return { text: 'Uso: `/use <slug>`. Mira las disponibles con `/apps`.', headerSlug: null };
  }
  const apps = await getLinkedApps(chatId);
  const found = apps.find((a) => a.slug === slug);
  if (!found) {
    return {
      text: `No tienes acceso a \`${slug}\`. Apps disponibles: ${apps.map((a) => '`' + a.slug + '`').join(', ') || '(ninguna)'}`,
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  await setLastActiveSlug(chatId, slug);
  return { text: `Ahora trabajando en \`${slug}\`.`, headerSlug: slug };
}

export async function handleCurrent(chatId: number): Promise<CommandResult> {
  const sticky = await getLastActiveSlug(chatId);
  if (!sticky) {
    return { text: 'No tienes proyecto activo. Usá `/use <slug>` o `/apps`.', headerSlug: null };
  }
  return { text: `Proyecto activo: \`${sticky}\`.`, headerSlug: sticky };
}

export async function handleHelp(chatId: number): Promise<CommandResult> {
  const sticky = await getLastActiveSlug(chatId);
  return {
    text: [
      '*Comandos:*',
      '`/apps` — lista tus apps linkeadas',
      '`/use <slug>` — cambia el proyecto activo',
      '`/current` — muestra el proyecto activo',
      '`/link <slug> <owner/repo>` — linkea una app existente (abre PR)',
      '`/help` — esta ayuda',
      '`/id` — muestra tu chat_id',
      '',
      'Cualquier otro mensaje se trata como solicitud sobre el proyecto activo.',
    ].join('\n'),
    headerSlug: sticky,
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
      text: ['Uso: `/link <slug> <owner/repo>`', '', 'Ejemplo:', '`/link mi-tienda dmnavalon/mi-tienda-online`'].join('\n'),
      headerSlug: await getLastActiveSlug(chatId),
    };
  }
  const [slug, repo] = tokens as [string, string];
  if (!/^[a-z][a-z0-9-]{0,29}$/.test(slug)) {
    return { text: `Slug inválido (\`${slug}\`). Debe ser kebab-case lowercase, ≤30 chars.`, headerSlug: null };
  }
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) {
    return { text: `Repo inválido (\`${repo}\`). Formato esperado: \`owner/name\`.`, headerSlug: null };
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

export function helpForOnboarding(): string {
  return ONBOARDING_HELP;
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
    case '/link':
      return handleLink(chatId, args, username);
    case '/start':
    case '/id':
    case '/whoami':
      return null; // delegated to webhook (onboarding response)
    default:
      return { text: `Comando desconocido: \`${cmd}\`. Usá \`/help\`.`, headerSlug: null };
  }
}

export type { RegistryApp };
