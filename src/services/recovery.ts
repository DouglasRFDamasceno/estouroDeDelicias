import { requireSupabase } from './supabase';

// O link é de uso único; reutilizar a mesma verificação nas remontagens do StrictMode.
let lastHash = '';
let pending: ReturnType<ReturnType<typeof requireSupabase>['auth']['verifyOtp']> | undefined;
export function acceptRecovery(tokenHash: string) {
  if (tokenHash !== lastHash || !pending) {
    lastHash = tokenHash;
    pending = requireSupabase().auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
  }
  return pending;
}
