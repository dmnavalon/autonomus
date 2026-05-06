/**
 * Telegram inline-keyboard builders + callback_data parser.
 *
 * Telegram limits callback_data to 64 bytes. Our shapes:
 *   pick:<slug>:<issue>     — user picks app for a pending Issue
 *   onboard:<action>        — onboarding choice (link | new | help)
 */
import type { RegistryApp } from './registry';

export interface InlineKeyboardButton {
  text: string;
  callback_data: string;
}
export interface InlineKeyboardMarkup {
  inline_keyboard: InlineKeyboardButton[][];
}

export function buildAppSelectionKeyboard(
  apps: RegistryApp[],
  issueNumber: number,
): InlineKeyboardMarkup {
  const rows: InlineKeyboardButton[][] = [];
  for (let i = 0; i < apps.length; i += 2) {
    const row: InlineKeyboardButton[] = [];
    for (const app of apps.slice(i, i + 2)) {
      row.push({ text: app.slug, callback_data: `pick:${app.slug}:${issueNumber}` });
    }
    rows.push(row);
  }
  return { inline_keyboard: rows };
}

export function buildOnboardingKeyboard(): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      [
        { text: 'Linkear app existente', callback_data: 'onboard:link' },
        { text: 'Crear app nueva', callback_data: 'onboard:new' },
      ],
      [{ text: 'Ver instrucciones', callback_data: 'onboard:help' }],
    ],
  };
}

export type ParsedCallback =
  | { kind: 'pick'; slug: string; issueNumber: number }
  | { kind: 'onboard'; action: 'link' | 'new' | 'help' }
  | { kind: 'unknown' };

export function parseCallbackData(data: string): ParsedCallback {
  if (data.startsWith('pick:')) {
    const [, slug, issueStr] = data.split(':');
    const issueNumber = Number(issueStr);
    if (slug && Number.isFinite(issueNumber)) return { kind: 'pick', slug, issueNumber };
    return { kind: 'unknown' };
  }
  if (data.startsWith('onboard:')) {
    const action = data.slice('onboard:'.length);
    if (action === 'link' || action === 'new' || action === 'help') {
      return { kind: 'onboard', action };
    }
    return { kind: 'unknown' };
  }
  return { kind: 'unknown' };
}
