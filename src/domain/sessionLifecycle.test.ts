import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { Session } from '@supabase/supabase-js';
import { createSessionPolicy } from '../services/sessionPolicy.ts';
import { SESSION_MAX_AGE_MS } from './sessionPolicy.ts';

test('renovação e recarga preservam prazo; sessão expirada não é aceita', async () => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const originalDocument = Object.getOwnPropertyDescriptor(globalThis, 'document');
  const originalStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const store = new Map<string, string>();
  const browser = Object.assign(new EventTarget(), {
    setInterval: () => 1,
    clearInterval: () => {},
  });
  Object.defineProperty(globalThis, 'window', { configurable: true, value: browser });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: Object.assign(new EventTarget(), { visibilityState: 'visible' }),
  });
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => store.set(key, value),
    },
  });
  let expirations = 0;
  const policy = createSessionPolicy(() => {
    expirations++;
  });
  const session = {
    access_token: `header.${btoa(JSON.stringify({ session_id: 'session-a' }))}.signature`,
  } as Session;
  try {
    assert.equal(policy.accept(session, 'SIGNED_IN'), true);
    const initial = store.get('auth-activity:session-a');
    assert.equal(policy.accept(session, 'TOKEN_REFRESHED'), true);
    assert.equal(store.get('auth-activity:session-a'), initial);
    policy.dispose();
    const restored = createSessionPolicy(() => {
      expirations++;
    });
    try {
      assert.equal(restored.accept(session, 'INITIAL_SESSION'), true);
      const startedAt = Date.now() - SESSION_MAX_AGE_MS;
      store.set('auth-activity:session-a', JSON.stringify({ startedAt, lastActiveAt: Date.now() }));
      assert.equal(restored.accept(session, 'TOKEN_REFRESHED'), false);
      await Promise.resolve();
      assert.equal(expirations, 1);
      assert.equal(restored.accept(session, 'SIGNED_IN'), false);
      assert.equal(expirations, 1);
      assert.equal(restored.accept(null, 'SIGNED_OUT'), true);
      const unknown = {
        access_token: `h.${btoa(JSON.stringify({ session_id: 'legacy' }))}.s`,
      } as Session;
      assert.equal(restored.accept(unknown, 'INITIAL_SESSION'), false);
      await Promise.resolve();
      assert.equal(expirations, 2);
    } finally {
      restored.dispose();
    }
  } finally {
    policy.dispose();
    for (const [key, descriptor] of [
      ['window', originalWindow],
      ['document', originalDocument],
      ['localStorage', originalStorage],
    ] as const) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else Reflect.deleteProperty(globalThis, key);
    }
  }
});
