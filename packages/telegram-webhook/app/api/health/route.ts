export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({
    ok: true,
    service: 'autonomus-telegram-webhook',
    timestamp: new Date().toISOString(),
  });
}
