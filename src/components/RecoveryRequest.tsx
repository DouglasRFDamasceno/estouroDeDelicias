import { useState } from 'react';
import type { FormEvent } from 'react';
import { authConfigured, authRedirect, requireSupabase } from '../services/supabase';

export function RecoveryRequest() {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const email = String(new FormData(event.currentTarget).get('email')).trim();
    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(email, { redirectTo: authRedirect('/auth/recovery') });
      setMessage(error ? 'Não foi possível enviar. Aguarde alguns minutos e tente novamente.' : 'Se houver uma conta elegível, enviaremos um novo link. Abra somente o e-mail mais recente. Se o link usar o fluxo antigo, abra no mesmo navegador e dispositivo em que fez este pedido.');
    } catch { setMessage('Não foi possível conectar. Verifique sua conexão e tente novamente.'); }
    finally { setBusy(false); }
  }
  return <form className="login-form" onSubmit={submit}><fieldset disabled={busy || !authConfigured}><label htmlFor="recovery-email">E-mail da sua conta</label><input id="recovery-email" name="email" type="email" autoComplete="email" autoCapitalize="none" required maxLength={254} /><button className="g-button login-submit" type="submit">{busy ? 'Enviando…' : 'Enviar novo link'}</button></fieldset><p role="status" aria-live="polite">{message}</p></form>;
}
