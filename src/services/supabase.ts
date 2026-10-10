import { createClient } from '@supabase/supabase-js';
import { validateSupabaseConfig } from '../domain/supabaseConfig';
const url = import.meta.env.VITE_SUPABASE_URL?.trim();
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
// Aceitar somente a chave pública moderna: uma secret/service_role nunca deve ir ao bundle.
export const authConfigured = validateSupabaseConfig(url, key);
export const supabase = authConfigured ? createClient(url!, key!, {
  auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
}) : null;
export function requireSupabase() {
  if (!supabase) throw new Error('SUPABASE_NOT_CONFIGURED');
  return supabase;
}
export const authRedirect = (path: '/auth/callback' | '/auth/recovery') => `${window.location.origin}${path}`;
