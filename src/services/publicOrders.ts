import type { PublicOrder } from '../domain/publicOrder';
export async function submitPublicOrder(order: PublicOrder, requestId: string, token: string) {
  const response = await fetch('/api/create-order', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...order, requestId, token }),
    signal: AbortSignal.timeout(30000),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok)
    throw new Error(
      result?.message ?? 'Não recebemos a confirmação. Tente novamente com o mesmo pedido.',
    );
  if (!Number.isSafeInteger(result?.reference) || !Number.isSafeInteger(result?.total_cents))
    throw new Error('Não recebemos a confirmação. Tente novamente com o mesmo pedido.');
  return result as { reference: number; total_cents: number };
}
