import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { runInNewContext } from 'node:vm';
import { URL } from 'node:url';
import ts from 'typescript';

// Executa o handler real com Auth/RPC simulados, sem Deno, rede ou credenciais.
const source = await readFile(
  new URL('../functions/invite-user/index.ts', import.meta.url),
  'utf8',
);
const code = ts.transpileModule(source.replace(/^import .*createClient.*;$/m, ''), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;

for (const scenario of [
  { name: 'sessão recente', valid: true, status: 200, invites: 1 },
  { name: 'sessão vencida ou revogada', valid: false, status: 401, invites: 0 },
  { name: 'RPC indisponível', valid: true, rpcError: {}, status: 401, invites: 0 },
  { name: 'RPC sem resultado', valid: null, status: 401, invites: 0 },
  { name: 'usuário comum', valid: true, admin: false, status: 403, invites: 0 },
  { name: 'JWT inválido', valid: true, authError: {}, status: 401, invites: 0 },
]) {
  test(`convite: ${scenario.name}`, async () => {
    let handler;
    let invites = 0;
    let sessionChecks = 0;
    const privileged = {
      auth: {
        getUser: async () => ({
          data: { user: { id: 'test-user', email_confirmed_at: '2026-10-11' } },
          error: scenario.authError ?? null,
        }),
        admin: {
          inviteUserByEmail: async () => {
            invites++;
            return { error: null };
          },
        },
      },
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { is_admin: scenario.admin ?? true },
              error: null,
            }),
          }),
        }),
      }),
    };
    runInNewContext(code, {
      Response: globalThis.Response,
      createClient: (_url, _key, options) => {
        if (!options.global) return privileged;
        assert.equal(options.global.headers.Authorization, 'Bearer fictitious-user-token');
        return {
          rpc: async (name) => {
            assert.equal(name, 'current_session_valid');
            sessionChecks++;
            return { data: scenario.valid, error: scenario.rpcError ?? null };
          },
        };
      },
      Deno: {
        env: {
          get: (key) =>
            ({
              SUPABASE_URL: 'https://example.invalid',
              SUPABASE_SERVICE_ROLE_KEY: 'fictitious-server-key',
              APP_ORIGIN: 'https://app.example.invalid',
            })[key],
        },
        serve: (callback) => {
          handler = callback;
        },
      },
    });
    const response = await handler(
      new globalThis.Request('https://example.invalid/invite-user', {
        method: 'POST',
        headers: {
          Authorization: 'Bearer fictitious-user-token',
          Origin: 'https://app.example.invalid',
        },
        body: JSON.stringify({ name: 'Pessoa teste', email: 'test@example.invalid' }),
      }),
    );
    assert.equal(response.status, scenario.status);
    assert.equal(invites, scenario.invites);
    assert.equal(sessionChecks, scenario.authError ? 0 : 1);
  });
}
