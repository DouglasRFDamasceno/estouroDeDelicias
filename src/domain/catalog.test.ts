import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductDraft } from './catalog.ts';
const draft = { name: ' Brownie ', category: ' Doces ', presentation: ' Unidade ', price: '16,05' };
test('cadastro genérico e preço em centavos sem arredondamento', () => {
  assert.deepEqual(parseProductDraft(draft), {
    name: 'Brownie',
    category: 'Doces',
    presentation: 'Unidade',
    price_cents: 1605,
  });
  assert.equal(parseProductDraft({ ...draft, price: '0,29' }).price_cents, 29);
  assert.equal(parseProductDraft({ ...draft, price: '1000000.00' }).price_cents, 100000000);
  assert.equal(parseProductDraft({ ...draft, price: '7.5' }).price_cents, 750);
});
test('rejeita preço ambíguo, negativo, fracionário e campos inválidos', () => {
  for (const price of ['-1', 'NaN', 'Infinity', '1e3', '12,345', '1.000,00', '', '1000000,01'])
    assert.throws(() => parseProductDraft({ ...draft, price }));
  for (const fields of [
    { name: ' ' },
    { category: 'A' },
    { presentation: '' },
    { name: 'x'.repeat(121) },
  ])
    assert.throws(() => parseProductDraft({ ...draft, ...fields }));
});
