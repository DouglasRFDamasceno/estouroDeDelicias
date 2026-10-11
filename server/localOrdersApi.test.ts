import assert from 'node:assert/strict';
import test from 'node:test';
import { createServer } from 'vite';
import { randomUUID } from 'node:crypto';
import { localOrdersApi } from './localOrdersApi.ts';
import { hashIp } from './publicOrders.ts';

test('Vite dev serves the order API and trusts only the local socket IP', async () => {
  const env: Record<string, string> = {};
  const server = await createServer({
    configFile: false,
    plugins: [localOrdersApi(env)],
    server: { host: '127.0.0.1', port: 0 },
  });
  const originalFetch = globalThis.fetch;
  const calls: { name: string; body: Record<string, unknown> }[] = [];
  globalThis.fetch = async (input, init) => {
    if (String(input).startsWith('https://database.invalid/')) {
      const name = String(input).split('/').at(-1)!;
      calls.push({ name, body: JSON.parse(init?.body as string) });
      return Response.json(
        name === 'admit_order_attempt' ? true : { reference: 1234, total_cents: 900 },
      );
    }
    return originalFetch(input, init);
  };
  try {
    await server.listen();
    const address = server.httpServer!.address();
    assert.ok(address && typeof address === 'object');
    const origin = `http://127.0.0.1:${address.port}`;
    const send = (extraHeaders: Record<string, string> = {}, body?: string) =>
      originalFetch(`${origin}/api/create-order`, {
        method: 'POST',
        headers: { Origin: origin, 'Content-Type': 'application/json', ...extraHeaders },
        body:
          body ??
          JSON.stringify({
            customer: 'Teste local',
            requestId: randomUUID(),
            items: [{ flavor: 'Ninho', size: 50, quantity: 1 }],
          }),
      });
    const missing = await send();
    assert.equal(missing.status, 503);
    assert.match((await missing.json()).message, /\.env.local/);
    Object.assign(env, {
      SUPABASE_URL: 'https://database.invalid',
      SUPABASE_SERVICE_ROLE_KEY: 'test-only',
      ORDER_IP_HASH_SECRET: 'test-only-secret-with-at-least-32-characters',
    });
    const saved = await send({
      'x-vercel-forwarded-for': '203.0.113.7',
      'x-forwarded-for': '203.0.113.8',
    });
    assert.equal(saved.status, 200);
    assert.deepEqual(await saved.json(), { reference: 1234, total_cents: 900 });
    assert.deepEqual(
      calls.map((call) => call.name),
      ['admit_order_attempt', 'create_pending_order'],
    );
    assert.equal(calls[0].body.p_ip_hash, hashIp('127.0.0.1', env.ORDER_IP_HASH_SECRET));
    assert.equal((await send({ Origin: 'https://external.invalid' })).status, 403);
    assert.equal((await send({}, 'x'.repeat(8193))).status, 413);
    assert.equal(calls.length, 2);
  } finally {
    globalThis.fetch = originalFetch;
    await server.close();
  }
});
