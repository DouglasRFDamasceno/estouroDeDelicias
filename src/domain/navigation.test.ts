import { test } from 'node:test';
import assert from 'node:assert/strict';
import { returnDestination } from './navigation.ts';

test('retorno mantém rotas internas conhecidas e contexto de gestão', () => {
  assert.equal(
    returnDestination('/conta?returnTo=%2Fdemo%2Fprodutos'),
    '/conta?returnTo=%2Fdemo%2Fprodutos',
  );
  assert.equal(
    returnDestination('/demo/produtos?name=Ninho&page=2', true),
    '/demo/produtos?name=Ninho&page=2',
  );
});
test('retorno rejeita destinos externos, autenticação recursiva e rotas desconhecidas', () => {
  for (const raw of [
    null,
    '',
    '//evil.test',
    '/\\evil.test',
    'https://evil.test',
    '/entrar',
    '/auth/recovery',
    '/demo/inexistente',
    '/conta\n',
  ]) {
    assert.equal(returnDestination(raw), '/demo/dashboard');
  }
  assert.equal(returnDestination('/conta', true), '/demo/dashboard');
});
