/**
 * Telegram webhook — Phase 0 stub.
 * Real implementation lands in Phase 2 with secret verification, registry check,
 * and GitHub Issue creation via Octokit.
 */

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const secretHeader = req.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expected || secretHeader !== expected) {
    return new Response('forbidden', { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return new Response('bad request', { status: 400 });
  }

  // Phase 2 will: validate chat_id, create GitHub Issue, return 200 fast.
  return Response.json({ ok: true, received: true });
}
