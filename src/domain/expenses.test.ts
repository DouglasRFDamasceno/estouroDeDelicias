import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseExpenseDraft } from './expenses.ts';
const draft = {
  description: ' Energia ',
  category: ' Operacionais ',
  date: '2026-10-12',
  amount: '125,50',
  notes: ' Outubro ',
};
test('despesas normalizam texto e mantêm centavos e data de competência', () => {
  assert.deepEqual(parseExpenseDraft(draft), {
    description: 'Energia',
    category: 'Operacionais',
    expense_date: '2026-10-12',
    amount_cents: 12550,
    notes: 'Outubro',
  });
  assert.equal(parseExpenseDraft({ ...draft, category: '' }).category, '');
});
test('despesas rejeitam datas inexistentes, valores inválidos e texto fora dos limites', () => {
  for (const invalid of [
    { amount: '0' },
    { amount: '-1' },
    { amount: '1.000,00' },
    { amount: '1,001' },
    { date: '2026-02-30' },
    { date: '1899-12-31' },
    { description: 'A' },
    { category: 'A' },
    { notes: 'A'.repeat(1001) },
  ])
    assert.throws(() => parseExpenseDraft({ ...draft, ...invalid }));
});
