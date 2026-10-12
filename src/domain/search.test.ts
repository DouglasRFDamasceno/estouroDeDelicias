import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSearch, searchPattern } from './search.ts';

test('buscas equivalem com ou sem acentos e maiúsculas', () => {
  for (const [label, query] of [
    ['Paçoca', 'pacoca'],
    ['JOÃO', 'joao'],
    ['Açúcar', 'acucar'],
    ['Café', 'cafe'],
    ['Pac\u0327oca', 'PAÇOCA'],
  ]) {
    assert.equal(normalizeSearch(label), normalizeSearch(query));
  }
  assert.ok(normalizeSearch('Paçoca artesanal').includes(normalizeSearch('paco')));
});

test('padrões preservam busca parcial e escapam caracteres especiais', () => {
  assert.equal(searchPattern('  PAÇOCA  '), '%pacoca%');
  assert.equal(searchPattern('50%_*\\'), '%50\\%\\_\\*\\\\%');
});
