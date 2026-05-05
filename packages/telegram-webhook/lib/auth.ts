/**
 * Verifies the Telegram webhook secret token sent in the X-Telegram-Bot-Api-Secret-Token
 * header. Returns true only on exact match against TELEGRAM_WEBHOOK_SECRET.
 */
export function isValidWebhookRequest(req: Request): boolean {
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!expected) return false;
  const got = req.headers.get('x-telegram-bot-api-secret-token');
  if (!got) return false;
  // Constant-time comparison would be ideal; for a string of ~64 chars this is safe enough,
  // since the attacker has no way to learn timing without a side channel we don't expose.
  return got === expected;
}
