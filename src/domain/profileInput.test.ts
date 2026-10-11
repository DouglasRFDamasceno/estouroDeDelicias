import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatProfileInput, parsePostalAddress } from './profileInput.ts';
import { emptyProfile, normalizeProfile } from './profile.ts';

test('máscaras parciais, colagem e normalização para persistência', () => {
  assert.equal(formatProfileInput('phone', '31984669269'), '(31) 98466-9269');
  assert.equal(formatProfileInput('phone', '3133334444'), '(31) 3333-4444');
  assert.equal(formatProfileInput('phone', ''), '');
  assert.equal(formatProfileInput('phone', '3'), '(3');
  assert.equal(formatProfileInput('document', '52998224725'), '529.982.247-25');
  assert.equal(formatProfileInput('document', '529.982.247-25'), '529.982.247-25');
  assert.equal(formatProfileInput('postal_code', '30260270'), '30260-270');
  assert.equal(formatProfileInput('postal_code', '30260-270123'), '30260-270');
  assert.equal(formatProfileInput('state', 'm1g'), 'MG');
  const normalized = normalizeProfile({
    ...emptyProfile,
    phone: '(31) 98466-9269',
    document: '529.982.247-25',
    postal_code: '30260-270',
  });
  assert.equal(normalized.phone, '31984669269');
  assert.equal(normalized.document, '52998224725');
  assert.equal(normalized.postal_code, '30260270');
});
const valid = {
  cep: '30260-270',
  logradouro: 'Rua de teste',
  bairro: 'Bairro',
  localidade: 'Belo Horizonte',
  uf: 'MG',
};
test('resposta do CEP aceita apenas campos esperados e CEP correspondente', () => {
  assert.deepEqual(
    parsePostalAddress({ ...valid, complement: 'ignorado', is_admin: true }, '30260270'),
    { street: 'Rua de teste', district: 'Bairro', city: 'Belo Horizonte', state: 'MG' },
  );
  assert.equal(parsePostalAddress({ ...valid, logradouro: '', bairro: '' }, '30260270').street, '');
  for (const bad of [
    null,
    [],
    { erro: true },
    { erro: 'true' },
    { ...valid, cep: '01001-000' },
    { ...valid, uf: 'XX' },
    { ...valid, localidade: 123 },
    { ...valid, logradouro: '<script>malicioso</script>' },
    { ...valid, bairro: 'x'.repeat(101) },
  ]) {
    assert.throws(() => parsePostalAddress(bad, '30260270'));
  }
});
