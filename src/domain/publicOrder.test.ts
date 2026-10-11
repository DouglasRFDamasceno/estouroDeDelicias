import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateOrder } from './publicOrder.ts';
import { landingFlavors, packageSizes } from './landingCatalog.ts';
const order = { customer: 'Maria José', items: [{ flavor: 'Paçoca', size: 100, quantity: 3 }] };
test('preserva nomes e sabores com acentos e descarta valores fornecidos pelo cliente', () => {
  assert.deepEqual(
    validateOrder({
      ...order,
      total: 1,
      admin: true,
      items: [{ ...order.items[0], price_cents: 1, product_id: 'forjado' }],
    }),
    order,
  );
});
test('rejeita nomes, sabores, tamanhos, quantidades e listas inválidos', () => {
  for (const value of [
    null,
    {},
    { ...order, customer: ' ' },
    { ...order, customer: 'a'.repeat(121) },
    { ...order, customer: 'Maria\nOutro nome' },
    { ...order, items: [] },
    { ...order, items: Array(40).fill(order.items[0]) },
    { ...order, items: [null] },
    { ...order, items: [order.items[0], order.items[0]] },
    ...[0, -1, 100, 1.5, '2', null].map((quantity) => ({
      ...order,
      items: [{ ...order.items[0], quantity }],
    })),
    { ...order, items: [{ flavor: 'Inexistente', size: 100, quantity: 1 }] },
    { ...order, items: [{ flavor: 'Ninho', size: 200, quantity: 1 }] },
  ])
    assert.throws(() => validateOrder(value));
});
test('aceita o limite de sabores e tamanhos', () => {
  const full = {
    customer: 'Maria',
    items: landingFlavors.flatMap((flavor) =>
      packageSizes.map((size) => ({ flavor: flavor.name, size, quantity: 99 })),
    ),
  };
  assert.deepEqual(validateOrder(full), full);
});
