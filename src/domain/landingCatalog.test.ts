import { test } from 'node:test';
import assert from 'node:assert/strict';
import { landingFlavors, orderSubtotal, orderMessage } from './landingCatalog.ts';

test('seleção combina quantidades e tamanhos em centavos', () => {
  assert.equal(landingFlavors.length, 13);
  assert.equal(orderSubtotal([]), 0);
  assert.equal(
    orderSubtotal([
      { flavor: 'Ninho', size: 50, quantity: 2 },
      { flavor: 'Morango', size: 100, quantity: 1 },
      { flavor: 'Ninho', size: 150, quantity: 1 },
    ]),
    5300,
  );
});
test('mensagem informa itens, subtotal sem frete e pede confirmação', () => {
  const message = orderMessage([{ flavor: 'Paçoca', size: 100, quantity: 3 }]);
  assert.ok(message.includes('3 × Paçoca — 100 g'));
  assert.match(message, /48,00/);
  assert.ok(message.includes('sem frete'));
  assert.ok(message.includes('confirmar a disponibilidade'));
  assert.throws(() => orderMessage([]));
});
test('itens desconhecidos ou quantidades inválidas não geram totais', () => {
  for (const item of [
    { flavor: 'Inexistente', size: 50, quantity: 1 },
    { flavor: 'Ninho', size: 200, quantity: 1 },
    ...[0, -1, 1.5, 100, NaN].map((quantity) => ({ flavor: 'Ninho', size: 50, quantity })),
  ])
    assert.throws(() => orderSubtotal([item]));
});
