import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pageRange, totalPages } from './pagination.ts';
test('intervalos inclusivos não repetem itens entre páginas', () => {
  assert.deepEqual(pageRange(1, 10), { from: 0, to: 9 });
  assert.deepEqual(pageRange(2, 10), { from: 10, to: 19 });
  assert.deepEqual(pageRange(3, 25), { from: 50, to: 74 });
  assert.equal(totalPages(39, 10), 4);
  assert.equal(totalPages(0, 10), 1);
  for (const [page, size] of [[0, 10], [-1, 10], [1.5, 25], [1, 1000], [Infinity, 10], [Number.MAX_SAFE_INTEGER, 50]]) assert.throws(() => pageRange(page, size));
});
