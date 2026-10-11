import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';
import { validateOrder } from '../src/domain/publicOrder.ts';

export type OrderEnvironment = {
  origin: string;
  supabaseUrl: string;
  serviceKey: string;
  turnstileSecret: string;
  requireTurnstile?: boolean;
  ipSecret: string;
  vercel: boolean;
};
export function canonicalIp(value: string): string {
  if (!isIP(value)) throw new Error('INVALID_IP');
  if (isIP(value) === 4) return value;
  const normalized = new URL(`http://[${value}]/`).hostname.slice(1, -1);
  // IPv4 mapeado em IPv6 usa a mesma cota do IPv4 original.
  const mapped = normalized.match(/^::ffff:([0-9a-f]+):([0-9a-f]+)$/);
  if (mapped) {
    const upper = parseInt(mapped[1], 16),
      lower = parseInt(mapped[2], 16);
    return [upper >> 8, upper & 255, lower >> 8, lower & 255].join('.');
  }
  return normalized;
}
export function hashIp(value: string, secret: string): string {
  return createHmac('sha256', secret).update(canonicalIp(value)).digest('hex');
}
export async function handlePublicOrder(
  request: Request,
  env: OrderEnvironment,
  send: typeof fetch = fetch,
): Promise<Response> {
  const reply = (status: number, body: object) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  if (request.method !== 'POST') return reply(405, { message: 'Método não permitido.' });
  if (
    !env.origin ||
    !env.supabaseUrl ||
    !env.serviceKey ||
    (env.requireTurnstile !== false && !env.turnstileSecret) ||
    env.ipSecret.length < 32 ||
    !env.vercel
  )
    return reply(503, {
      message: 'Pedidos online indisponíveis no momento. Você pode combinar pelo WhatsApp.',
    });
  if (request.headers.get('origin') !== env.origin)
    return reply(403, { message: 'Origem não permitida.' });
  if (!request.headers.get('content-type')?.startsWith('application/json'))
    return reply(415, { message: 'Formato inválido.' });
  let ip: string;
  try {
    ip = canonicalIp(request.headers.get('x-vercel-forwarded-for') ?? '');
  } catch {
    return reply(503, { message: 'Não foi possível validar a conexão.' });
  }
  if (Number(request.headers.get('content-length') ?? 0) > 8192)
    return reply(413, { message: 'Pedido muito grande.' });
  const reader = request.body?.getReader();
  if (!reader) return reply(400, { message: 'Pedido inválido.' });
  let raw = '',
    bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 8192) {
        await reader.cancel();
        return reply(413, { message: 'Pedido muito grande.' });
      }
      raw += decoder.decode(value, { stream: true });
    }
    raw += decoder.decode();
  } catch {
    return reply(400, { message: 'Pedido inválido.' });
  }
  let body: Record<string, unknown>;
  let order: ReturnType<typeof validateOrder>;
  try {
    body = JSON.parse(raw);
    order = validateOrder(body);
    if (
      typeof body.requestId !== 'string' ||
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
        body.requestId,
      ) ||
      (env.requireTurnstile !== false &&
        (typeof body.token !== 'string' || !body.token || body.token.length > 2048))
    )
      throw new Error();
  } catch {
    return reply(400, { message: 'Confira seu nome, os sabores e as quantidades.' });
  }
  const ipHash = hashIp(ip, env.ipSecret);
  const rpc = (name: string, payload: object) =>
    send(`${env.supabaseUrl}/rest/v1/rpc/${name}`, {
      method: 'POST',
      headers: {
        apikey: env.serviceKey,
        Authorization: `Bearer ${env.serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(8000),
    });
  try {
    const admission = await rpc('admit_order_attempt', { p_ip_hash: ipHash });
    if (!admission.ok) throw new Error();
    if ((await admission.json()) !== true)
      return reply(429, {
        message: 'Limite de tentativas atingido. Tente mais tarde ou fale pelo WhatsApp.',
      });
    if (env.requireTurnstile !== false) {
      const challenge = await send('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: new URLSearchParams({
          secret: env.turnstileSecret,
          response: body.token as string,
          remoteip: ip,
        }),
        signal: AbortSignal.timeout(8000),
      });
      if (!challenge.ok) throw new Error();
      const verified = await challenge.json();
      if (
        verified.success !== true ||
        verified.hostname !== new URL(env.origin).hostname ||
        verified.action !== 'create_order'
      )
        return reply(400, { message: 'Refaça a verificação de segurança para enviar o pedido.' });
    }
    const saved = await rpc('create_pending_order', {
      p_request_id: body.requestId,
      p_ip_hash: ipHash,
      p_customer: order.customer,
      p_items: order.items,
    });
    const result = await saved.json();
    if (!saved.ok) {
      if (['RATE_LIMIT', 'MONTHLY_IP_LIMIT', 'GLOBAL_LIMIT'].includes(result.message))
        return reply(429, {
          message: 'Limite de pedidos online atingido. Fale conosco pelo WhatsApp para continuar.',
        });
      if (result.message === 'PRODUCT_UNAVAILABLE')
        return reply(409, {
          message: 'Um sabor não está disponível no catálogo. Confirme pelo WhatsApp.',
        });
      if (result.message === 'REQUEST_CONFLICT')
        return reply(409, {
          message:
            'Este envio já foi usado para outro pedido. Feche e abra o catálogo para tentar novamente.',
        });
      throw new Error();
    }
    if (!Number.isSafeInteger(result.reference) || !Number.isSafeInteger(result.total_cents))
      throw new Error();
    return reply(200, { reference: result.reference, total_cents: result.total_cents });
  } catch {
    return reply(503, {
      message:
        'Não recebemos a confirmação. Tente novamente com o mesmo pedido; o envio não será duplicado.',
    });
  }
}
