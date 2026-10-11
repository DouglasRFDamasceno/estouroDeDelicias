/** Falha antes de servir/gerar bundle se uma credencial administrativa for colocada por engano. */
export function validateSupabaseConfig(url: string | undefined, key: string | undefined): boolean {
  if (!url?.trim() && !key?.trim()) return false;
  if (!url || !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(url.trim()))
    throw new Error('Configure uma URL HTTPS padrão do projeto Supabase.');
  if (!key || !/^sb_publishable_[A-Za-z0-9_-]+$/.test(key.trim()))
    throw new Error(
      'Use somente a publishable key moderna do Supabase. Chaves administrativas e JWTs legados não são aceitos.',
    );
  return true;
}
