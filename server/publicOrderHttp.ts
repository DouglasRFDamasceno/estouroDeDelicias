import type { IncomingMessage, ServerResponse } from 'node:http';
import { handlePublicOrder } from './publicOrders.ts';
import type { OrderEnvironment } from './publicOrders.ts';

export async function handlePublicOrderHttp(
  req: IncomingMessage & { body?: unknown },
  res: ServerResponse,
  environment: OrderEnvironment,
) {
  res.setHeader('Cache-Control', 'no-store');
  // A Vercel pode entregar JSON já processado. Nunca confiar no Content-Length sozinho.
  let raw: string;
  if (req.body !== undefined) {
    raw = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  } else {
    const chunks: Buffer[] = [];
    let length = 0;
    for await (const chunk of req) {
      const buffer = Buffer.from(chunk);
      length += buffer.length;
      if (length > 8192) {
        res.statusCode = 413;
        res.end();
        return;
      }
      chunks.push(buffer);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (Buffer.byteLength(raw) > 8192) {
    res.statusCode = 413;
    res.end();
    return;
  }
  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(',') : value);
  }
  const response = await handlePublicOrder(
    new Request('https://local/api/create-order', {
      method: req.method,
      headers,
      ...(req.method === 'POST' ? { body: raw } : {}),
    }),
    environment,
  );
  res.statusCode = response.status;
  response.headers.forEach((value, key) => res.setHeader(key, value));
  res.end(await response.text());
}
