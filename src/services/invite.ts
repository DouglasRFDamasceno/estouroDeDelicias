import { requireSupabase } from './supabase';
// Evita consumo duplicado do link durante remontagens do React StrictMode.
let lastHash = '';
let pending: ReturnType<ReturnType<typeof requireSupabase>['auth']['verifyOtp']> | undefined;
export function acceptInvite(tokenHash: string) {
  if (tokenHash !== lastHash || !pending) {
    lastHash = tokenHash;
    pending = requireSupabase().auth.verifyOtp({ token_hash: tokenHash, type: 'invite' });
  }
  return pending;
}
