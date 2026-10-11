import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handlePublicOrder, hashIp, canonicalIp } from './publicOrders.ts';
const env = {
  origin: 'https://example.com',
  supabaseUrl: 'https://example.supabase.co',
  serviceKey: 'server-secret',
  turnstileSecret: 'captcha-secret',
  ipSecret: 'x'.repeat(32),
  vercel: true,
};
const body = {
  customer: 'Maria',
  items: [{ flavor: 'Ninho', size: 50, quantity: 2 }],
  requestId: '00000000-0000-4000-8000-000000000001',
  token: 'token',
};
function request(value: unknown = body, headers: Record<string, string> = {}) {
  return new Request('https://example.com/api/create-order', {
    method: 'POST',
    headers: {
      origin: env.origin,
      'content-type': 'application/json',
      'x-vercel-forwarded-for': '192.0.2.1',
      ...headers,
    },
    body: JSON.stringify(value),
  });
}
function mock(options: { admission?: boolean; challenge?: object; error?: string } = {}) {
  const calls: { url: string; body: string }[] = [];
  const send: typeof fetch = async (input, init) => {
    const url = String(input);
    calls.push({ url, body: String(init?.body) });
    if (url.endsWith('admit_order_attempt')) return Response.json(options.admission ?? true);
    if (url.includes('siteverify'))
      return Response.json(
        options.challenge ?? { success: true, hostname: 'example.com', action: 'create_order' },
      );
    if (options.error) return Response.json({ message: options.error }, { status: 400 });
    return Response.json({ reference: 1042, total_cents: 1800 });
  };
  return { send, calls };
}
test('pedido válido grava somente após admissão e verificação; IP bruto não vai ao banco', async () => {
  const { send, calls } = mock();
  const response = await handlePublicOrder(request({ ...body, price_cents: 1 }), env, send);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reference: 1042, total_cents: 1800 });
  assert.equal(calls.length, 3);
  assert.ok(calls[0].url.endsWith('admit_order_attempt'));
  const payload = JSON.parse(calls[2].body);
  assert.deepEqual(payload.p_items, body.items);
  assert.equal(payload.p_request_id, body.requestId);
  assert.equal(payload.p_ip_hash, hashIp('192.0.2.1', env.ipSecret));
  assert.ok(!calls[0].body.includes('192.0.2.1'));
  assert.ok(!calls[2].body.includes('192.0.2.1'));
});
test('limite de tentativas não chama CAPTCHA nem grava pedido', async () => {
  const { send, calls } = mock({ admission: false });
  assert.equal((await handlePublicOrder(request(), env, send)).status, 429);
  assert.equal(calls.length, 1);
});
test('CAPTCHA inválido, outro domínio ou outra ação não gravam pedidos', async () => {
  for (const challenge of [
    { success: false },
    { success: true, hostname: 'outro.com', action: 'create_order' },
    { success: true, hostname: 'example.com', action: 'login' },
  ]) {
    const { send, calls } = mock({ challenge });
    assert.equal((await handlePublicOrder(request(), env, send)).status, 400);
    assert.equal(calls.length, 2);
  }
});
test('sem segredos, origem confiável ou IP da Vercel não chama serviços externos', async () => {
  const { send, calls } = mock();
  for (const settings of [
    { ...env, ipSecret: '' },
    { ...env, turnstileSecret: '' },
    { ...env, vercel: false },
  ])
    assert.equal((await handlePublicOrder(request(), settings, send)).status, 503);
  assert.equal(
    (await handlePublicOrder(request(body, { origin: 'https://outro.com' }), env, send)).status,
    403,
  );
  assert.equal(
    (
      await handlePublicOrder(
        request(body, { 'x-vercel-forwarded-for': '', 'x-forwarded-for': '192.0.2.1' }),
        env,
        send,
      )
    ).status,
    503,
  );
  assert.equal(
    (
      await handlePublicOrder(
        request(body, { 'x-vercel-forwarded-for': '192.0.2.1, 192.0.2.2' }),
        env,
        send,
      )
    ).status,
    503,
  );
  assert.equal(calls.length, 0);
});
test('corpo excessivo, itens adulterados e identificadores inválidos não chamam o banco', async () => {
  const { send, calls } = mock();
  assert.equal(
    (await handlePublicOrder(request({ ...body, padding: 'x'.repeat(8192) }), env, send)).status,
    413,
  );
  for (const value of [
    null,
    { ...body, requestId: 'bad' },
    { ...body, token: '' },
    { ...body, items: [{ flavor: 'Ninho', size: 50, quantity: 100 }] },
  ])
    assert.equal((await handlePublicOrder(request(value), env, send)).status, 400);
  assert.equal(calls.length, 0);
});
test('cotas do banco são apresentadas como limite e falhas não vazam dados internos', async () => {
  for (const error of ['MONTHLY_IP_LIMIT', 'GLOBAL_LIMIT'])
    assert.equal((await handlePublicOrder(request(), env, mock({ error }).send)).status, 429);
  const response = await handlePublicOrder(request(), env, mock({ error: 'segredo interno' }).send);
  assert.equal(response.status, 503);
  assert.ok(!(await response.text()).includes('segredo interno'));
});
test('IP normalizado evita cotas diferentes para representações equivalentes', () => {
  assert.equal(hashIp('2001:db8::1', env.ipSecret), hashIp('2001:0db8:0:0:0:0:0:1', env.ipSecret));
  assert.equal(canonicalIp('::ffff:192.0.2.1'), '192.0.2.1');
  assert.equal(hashIp('192.0.2.1', env.ipSecret), hashIp('::ffff:c000:201', env.ipSecret));
  assert.throws(() => canonicalIp('fake'));
});

test('modo temporário sem Turnstile mantém admissão e gravação sem chamar Cloudflare', async () => {
  const { send, calls } = mock();
  const withoutCaptcha = { ...env, turnstileSecret: '', requireTurnstile: false };
  const response = await handlePublicOrder(
    request({ ...body, token: undefined }),
    withoutCaptcha,
    send,
  );
  assert.equal(response.status, 200);
  assert.equal(calls.length, 2);
  assert.ok(calls[0].url.endsWith('admit_order_attempt'));
  assert.ok(calls[1].url.endsWith('create_pending_order'));
  const blocked = mock({ admission: false });
  assert.equal((await handlePublicOrder(request(body), withoutCaptcha, blocked.send)).status, 429);
  assert.equal(blocked.calls.length, 1);
});
