import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readProductQuery } from './productQuery.ts';

test('consulta na URL recupera filtros, página, tamanho e ordenação', () => {
  assert.deepEqual(
    readProductQuery(
      new URLSearchParams(
        'page=2&size=25&sort=price_cents&direction=desc&name=Ninho&category=Doces&presentation=50+g',
      ),
    ),
    {
      page: 2,
      pageSize: 25,
      sort: { column: 'price_cents', ascending: false },
      filters: { name: 'Ninho', category: 'Doces', presentation: '50 g' },
    },
  );
});
test('consulta inválida não permite páginas inseguras, tamanhos ilimitados ou colunas arbitrárias', () => {
  for (const page of ['-1', '0', '1.5', 'NaN', 'Infinity', '9007199254740991']) {
    const parsed = readProductQuery(new URLSearchParams(`page=${page}&size=999&sort=unknown`));
    assert.equal(parsed.page, 1);
    assert.equal(parsed.pageSize, 10);
    assert.equal(parsed.sort.column, 'name');
  }
  assert.equal(
    readProductQuery(new URLSearchParams({ name: 'x'.repeat(200) })).filters.name.length,
    120,
  );
});
