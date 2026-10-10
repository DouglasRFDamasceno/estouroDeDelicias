import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateSupabaseConfig } from './supabaseConfig.ts';
test('configuração opcional e bloqueio de chaves privadas antes do bundle', () => {
  assert.equal(validateSupabaseConfig('', ''), false);
  assert.equal(validateSupabaseConfig('https://example.supabase.co','sb_publishable_example'), true);
  for (const key of ['sb_secret_example','eyJhbGciOiJIUzI1NiJ9.example.signature','']) {
    assert.throws(() => validateSupabaseConfig('https://example.supabase.co',key));
  }
  assert.throws(() => validateSupabaseConfig('http://example.supabase.co','sb_publishable_example'));
  assert.throws(() => validateSupabaseConfig('https://example.supabase.co.attacker.test','sb_publishable_example'));
});
