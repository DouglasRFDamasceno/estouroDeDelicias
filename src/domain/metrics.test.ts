import { test } from 'node:test';
import assert from 'node:assert/strict';
import { metrics } from './metrics.ts';
test('recebimento parcial não altera faturamento nem resultado por competência', () => {
  assert.deepEqual(
    metrics(
      [
        {
          id: '1',
          customer: 'Teste',
          date: '2026-10-01',
          totalCents: 1099,
          receivedCents: 300,
          costCents: 499,
        },
      ],
      100,
    ),
    { revenue: 1099, received: 300, receivable: 799, cost: 499, expenses: 100, result: 500 },
  );
});
test('período vazio e despesa sem venda', () => {
  assert.equal(metrics([], 0).result, 0);
  assert.equal(metrics([], 250).result, -250);
});
