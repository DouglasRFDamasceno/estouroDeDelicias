import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SESSION_MAX_AGE_MS,
  SESSION_IDLE_TIMEOUT_MS,
  parseSessionActivity,
  sessionExpired,
} from './sessionPolicy.ts';

const start = 1_800_000_000_000;
test('sessão expira exatamente em 72 horas mesmo com atividade recente', () => {
  const activity = { startedAt: start, lastActiveAt: start + SESSION_MAX_AGE_MS - 1 };
  assert.equal(sessionExpired(activity, start + SESSION_MAX_AGE_MS - 1), false);
  assert.equal(sessionExpired(activity, start + SESSION_MAX_AGE_MS), true);
});
test('inatividade expira no limite e retomar a página não renova o prazo', () => {
  const activity = { startedAt: start, lastActiveAt: start };
  assert.equal(sessionExpired(activity, start + SESSION_IDLE_TIMEOUT_MS - 1), false);
  assert.equal(sessionExpired(activity, start + SESSION_IDLE_TIMEOUT_MS), true);
  assert.equal(sessionExpired(activity, start + SESSION_IDLE_TIMEOUT_MS + 1000), true);
});
test('metadados persistidos preservam os prazos após recarga', () => {
  const activity = { startedAt: start, lastActiveAt: start + 5000 };
  assert.deepEqual(parseSessionActivity(JSON.stringify(activity)), activity);
  for (const raw of [
    null,
    '{',
    'null',
    '{}',
    '[]',
    '{"startedAt":-1,"lastActiveAt":1}',
    JSON.stringify({ startedAt: start, lastActiveAt: start - 1 }),
  ]) {
    assert.equal(parseSessionActivity(raw), null);
  }
});
test('relógio anterior aos registros invalida a sessão', () => {
  assert.equal(sessionExpired({ startedAt: start, lastActiveAt: start + 100 }, start), true);
});
