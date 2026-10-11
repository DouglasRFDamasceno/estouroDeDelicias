import type { IncomingMessage, ServerResponse } from 'node:http';
import { handlePublicOrderHttp } from '../server/publicOrderHttp.ts';

export default async function handler(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
) {
  return handlePublicOrderHttp(req, res, {
    origin: process.env.APP_ORIGIN ?? '',
    supabaseUrl: process.env.SUPABASE_URL ?? '',
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
    turnstileSecret: process.env.TURNSTILE_SECRET_KEY ?? '',
    requireTurnstile: process.env.ORDER_REQUIRE_TURNSTILE === 'true',
    ipSecret: process.env.ORDER_IP_HASH_SECRET ?? '',
    vercel: process.env.VERCEL === '1',
  });
}
