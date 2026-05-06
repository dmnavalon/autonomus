/**
 * Decides which app a Telegram message targets, given the user's chat_id.
 *
 * Resolution order:
 *   1. Sticky: if last_active_slug is set AND still in linked apps → use it.
 *   2. Unique: exactly one linked app → use it.
 *   3. Multiple: more than one linked app, no sticky → ask via inline keyboard.
 *   4. None: zero linked apps → onboarding flow.
 *
 * For software_nuevo we bypass this entirely (the webhook calls
 * resolveApp() only for messages that need an existing app).
 */
import type { RegistryApp } from './registry';
import { getLastActiveSlug, getLinkedApps } from './registry';

export type Resolution =
  | { status: 'sticky'; app: RegistryApp }
  | { status: 'unique'; app: RegistryApp }
  | { status: 'multiple'; apps: RegistryApp[] }
  | { status: 'none' };

export async function resolveApp(chatId: number): Promise<Resolution> {
  const apps = await getLinkedApps(chatId);
  if (apps.length === 0) return { status: 'none' };

  const sticky = await getLastActiveSlug(chatId);
  if (sticky) {
    const stickyApp = apps.find((a) => a.slug === sticky);
    if (stickyApp) return { status: 'sticky', app: stickyApp };
  }

  if (apps.length === 1) return { status: 'unique', app: apps[0]! };
  return { status: 'multiple', apps };
}
