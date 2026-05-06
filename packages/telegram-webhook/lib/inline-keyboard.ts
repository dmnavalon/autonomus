/**
 * Telegram inline-keyboard builders + callback_data parser.
 *
 * Telegram limits callback_data to 64 bytes. Shapes used:
 *   pick:<slug>:<issue>     — user picks app for a pending Issue (or sticky-only when issue=0)
 *   start:new|link|cancel   — welcome menu actions
 *   apptype:<type>          — wizard step 3 (web|saas|dashboard|bot|api|otro)
 *   confirm-create:1        — confirm create-project draft
 *   pick-gh:<idx>           — picks idx-th repo in link wizard (mapping in wizard.draft.candidates)
 *   gh-page:<n>             — paginate the link-wizard repo list
 *   cancel-wizard           — abort the current wizard
 */
import type { RegistryApp } from './registry';
import type { RepoCandidate } from './github-repos';

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

const APP_TYPES = [
  { label: 'Web', code: 'web' as const },
  { label: 'SaaS', code: 'saas' as const },
  { label: 'Dashboard', code: 'dashboard' as const },
  { label: 'Bot', code: 'bot' as const },
  { label: 'API', code: 'api' as const },
  { label: 'Otro', code: 'otro' as const },
] as const;

export type AppTypeCode = (typeof APP_TYPES)[number]['code'];

export const APP_TYPE_LABELS: Record<AppTypeCode, string> = Object.fromEntries(
  APP_TYPES.map((t) => [t.code, t.label]),
) as Record<AppTypeCode, string>;

function projectLabel(app: RegistryApp): string {
  return app.label && app.label.length > 0 ? app.label : app.slug;
}

export function buildAppSelectionKeyboard(
  apps: RegistryApp[],
  issueNumber: number,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < apps.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    for (const app of apps.slice(i, i + 2)) {
      row.push({
        text: projectLabel(app),
        callback_data: `pick:${app.slug}:${issueNumber}`,
      });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

/**
 * Welcome screen — shown when the user has no sticky and either zero apps or
 * just typed `/start`. Lists existing apps as quick-select + actions to create
 * or link a new one. issueNumber=0 means "set sticky only" (no pending Issue).
 */
export function buildWelcomeKeyboard(
  apps: RegistryApp[],
  issueNumber: number,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < apps.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    for (const app of apps.slice(i, i + 2)) {
      row.push({
        text: projectLabel(app),
        callback_data: `pick:${app.slug}:${issueNumber}`,
      });
    }
    rows.push(row);
  }
  rows.push([
    { text: '➕ Crear proyecto', callback_data: 'start:new' },
    { text: '🔗 Vincular GitHub', callback_data: 'start:link' },
  ]);
  rows.push([{ text: '❌ Cancelar', callback_data: 'start:cancel' }]);
  return { inline_keyboard: rows };
}

export function buildAppTypeKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: APP_TYPES[0].label, callback_data: `apptype:${APP_TYPES[0].code}` },
        { text: APP_TYPES[1].label, callback_data: `apptype:${APP_TYPES[1].code}` },
        { text: APP_TYPES[2].label, callback_data: `apptype:${APP_TYPES[2].code}` },
      ],
      [
        { text: APP_TYPES[3].label, callback_data: `apptype:${APP_TYPES[3].code}` },
        { text: APP_TYPES[4].label, callback_data: `apptype:${APP_TYPES[4].code}` },
        { text: APP_TYPES[5].label, callback_data: `apptype:${APP_TYPES[5].code}` },
      ],
      [{ text: '❌ Cancelar', callback_data: 'cancel-wizard' }],
    ],
  };
}

export function buildConfirmCreateKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: '✅ Confirmar', callback_data: 'confirm-create:1' },
        { text: '❌ Cancelar', callback_data: 'cancel-wizard' },
      ],
    ],
  };
}

export const REPOS_PER_PAGE = 8;

export function buildGithubReposKeyboard(
  candidates: RepoCandidate[],
  page: number,
): InlineKeyboardMarkup {
  const start = page * REPOS_PER_PAGE;
  const slice = candidates.slice(start, start + REPOS_PER_PAGE);
  const rows: InlineKeyboardButton[][] = slice.map((r, i) => [
    {
      text: `${r.private ? '🔒 ' : ''}${r.name}`,
      callback_data: `pick-gh:${start + i}`,
    },
  ]);
  const navRow: InlineKeyboardButton[] = [];
  if (page > 0) navRow.push({ text: '◀ Anterior', callback_data: `gh-page:${page - 1}` });
  if (start + REPOS_PER_PAGE < candidates.length) {
    navRow.push({ text: 'Siguiente ▶', callback_data: `gh-page:${page + 1}` });
  }
  if (navRow.length > 0) rows.push(navRow);
  rows.push([{ text: '❌ Cancelar', callback_data: 'cancel-wizard' }]);
  return { inline_keyboard: rows };
}

export type ParsedCallback =
  | { kind: 'pick'; slug: string; issueNumber: number }
  | { kind: 'start'; action: 'new' | 'link' | 'cancel' }
  | { kind: 'apptype'; type: AppTypeCode }
  | { kind: 'confirm-create' }
  | { kind: 'pick-gh'; index: number }
  | { kind: 'gh-page'; page: number }
  | { kind: 'cancel-wizard' }
  | { kind: 'unknown' };

export function parseCallbackData(data: string): ParsedCallback {
  if (data.startsWith('pick:')) {
    const [, slug, issueStr] = data.split(':');
    const issueNumber = Number(issueStr);
    if (slug && Number.isFinite(issueNumber)) return { kind: 'pick', slug, issueNumber };
    return { kind: 'unknown' };
  }
  if (data.startsWith('start:')) {
    const action = data.slice('start:'.length);
    if (action === 'new' || action === 'link' || action === 'cancel') {
      return { kind: 'start', action };
    }
    return { kind: 'unknown' };
  }
  if (data.startsWith('apptype:')) {
    const type = data.slice('apptype:'.length);
    if (['web', 'saas', 'dashboard', 'bot', 'api', 'otro'].includes(type)) {
      return { kind: 'apptype', type: type as AppTypeCode };
    }
    return { kind: 'unknown' };
  }
  if (data === 'confirm-create:1') return { kind: 'confirm-create' };
  if (data.startsWith('pick-gh:')) {
    const idx = Number(data.slice('pick-gh:'.length));
    if (Number.isFinite(idx) && idx >= 0) return { kind: 'pick-gh', index: idx };
    return { kind: 'unknown' };
  }
  if (data.startsWith('gh-page:')) {
    const p = Number(data.slice('gh-page:'.length));
    if (Number.isFinite(p) && p >= 0) return { kind: 'gh-page', page: p };
    return { kind: 'unknown' };
  }
  if (data === 'cancel-wizard') return { kind: 'cancel-wizard' };
  return { kind: 'unknown' };
}
