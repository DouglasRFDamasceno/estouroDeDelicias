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
test('peso líquido é opcional, explícito e admite até três casas decimais', () => {
  assert.equal(parseProductDraft({ ...draft, weight: '50' }).weight_grams, 50);
  assert.equal(parseProductDraft({ ...draft, weight: '100,125' }).weight_grams, 100.125);
  assert.equal(parseProductDraft({ ...draft, weight: '' }).weight_grams, null);
  for (const weight of ['0', '-50', '1.000,00', '50g', '1e3', '0,0001', '10000001'])
    assert.throws(() => parseProductDraft({ ...draft, weight }));
});
