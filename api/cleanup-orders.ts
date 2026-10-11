import { timingSafeEqual, createHash } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
export default async function handler(req: IncomingMessage, res: ServerResponse) {
  res.setHeader('Cache-Control', 'no-store');
  const secret = process.env.CRON_SECRET;
  const supplied = req.headers.authorization ?? '';
  const digest = (value: string) => createHash('sha256').update(value).digest();
  if (
    req.method !== 'GET' ||
    !secret ||
    !timingSafeEqual(digest(supplied), digest(`Bearer ${secret}`))
  ) {
    res.statusCode = 403;
    res.end();
    return;
  }
  const url = process.env.SUPABASE_URL,
    key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    res.statusCode = 503;
    res.end();
    return;
  }
  try {
    const response = await fetch(`${url}/rest/v1/rpc/cleanup_pending_orders`, {
      method: 'POST',
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(15000),
    });
    res.statusCode = response.ok ? 204 : 503;
    res.end();
  } catch {
    res.statusCode = 503;
    res.end();
  }
}
