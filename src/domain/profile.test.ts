import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyProfile, normalizeProfile, validCPF, validateProfile } from './profile.ts';
test('CPF: dígitos verificadores e sequências repetidas', () => {
  assert.equal(validCPF('529.982.247-25'), true);
  assert.equal(validCPF('529.982.247-24'), false);
  assert.equal(validCPF('111.111.111-11'), false);
  assert.equal(validCPF('123'), false);
});
test('perfil opcional sem PII adicional e normalização', () => {
  assert.equal(validateProfile({ ...emptyProfile, full_name: 'Maria' }), null);
  assert.equal(
    normalizeProfile({
      ...emptyProfile,
      full_name: ' Maria ',
      postal_code: '30100-000',
      state: 'mg',
    }).postal_code,
    '30100000',
  );
  assert.notEqual(validateProfile({ ...emptyProfile, full_name: 'Maria', state: 'XX' }), null);
  assert.notEqual(
    validateProfile({ ...emptyProfile, full_name: 'Maria', document: '11111111111' }),
    null,
  );
});
