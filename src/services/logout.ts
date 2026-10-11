import { requireSupabase } from './supabase';

// Compartilha a operação entre botões para evitar pedidos duplicados.
let pending: Promise<void> | null = null;
export function logoutCurrentSession(reason?: 'expired'): Promise<void> {
  if (!pending) {
    pending = (async () => {
      const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
      if (error) {
        // O SDK pode limpar a sessão local mesmo quando a revogação remota falha.
        const { data } = await requireSupabase().auth.getSession();
        if (data.session) throw error;
        window.location.replace('/entrar?logout=unconfirmed');
        return;
      }
      // Novo documento descarta os formulários e o histórico de páginas do Ionic em memória.
      window.location.replace(reason === 'expired' ? '/entrar?session=expired' : '/entrar');
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}
