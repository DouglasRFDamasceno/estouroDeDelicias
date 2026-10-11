import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { acceptInvite } from '../services/invite';
import { acceptRecovery } from '../services/recovery';
import { RecoveryRequest } from '../components/RecoveryRequest';
import { requireSupabase } from '../services/supabase';
export function AuthCallback({
  recovery = false,
  invitation = false,
}: {
  recovery?: boolean;
  invitation?: boolean;
}) {
  const { session, loading } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [validatingInvite, setValidatingInvite] = useState(invitation);
  const [inviteError, setInviteError] = useState(false);
  const [validatingRecovery, setValidatingRecovery] = useState(
    recovery && new URLSearchParams(location.search).has('token_hash'),
  );
  const [recoveryError, setRecoveryError] = useState(false);
  useEffect(() => {
    if (!recovery || location.pathname !== '/auth/recovery') return;
    const hash = new URLSearchParams(location.search).get('token_hash');
    if (!hash) return;
    let active = true;
    setValidatingRecovery(true);
    setRecoveryError(false);
    void acceptRecovery(hash)
      .then(({ error }) => {
        if (active) {
          setRecoveryError(Boolean(error));
          setValidatingRecovery(false);
          window.history.replaceState(window.history.state, '', '/auth/recovery');
        }
      })
      .catch(() => {
        if (active) {
          setRecoveryError(true);
          setValidatingRecovery(false);
        }
      });
    return () => {
      active = false;
    };
  }, [recovery, location.pathname, location.search]);
  useEffect(() => {
    if (!invitation || location.pathname !== '/auth/invite') return;
    let active = true;
    const hash = new URLSearchParams(location.search).get('token_hash');
    if (!hash) {
      setInviteError(true);
      setValidatingInvite(false);
      return;
    }
    void acceptInvite(hash)
      .then(({ error }) => {
        if (active) {
          setInviteError(Boolean(error));
          setValidatingInvite(false);
          window.history.replaceState(window.history.state, '', '/auth/invite');
        }
      })
      .catch(() => {
        if (active) {
          setInviteError(true);
          setValidatingInvite(false);
        }
      });
    return () => {
      active = false;
    };
  }, [invitation, location.pathname, location.search]);
  const failed =
    new URLSearchParams(window.location.search).has('error') ||
    window.location.hash.includes('error=');
  async function update(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    if (fields.get('password') !== fields.get('confirmation')) {
      setMessage('As senhas precisam ser iguais.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().auth.updateUser({
        password: String(fields.get('password')),
      });
      if (error) {
        setMessage(
          'Não foi possível alterar a senha. Use uma senha nova com pelo menos 12 caracteres ou solicite outro link.',
        );
        return;
      }
      form.reset();
      const { error: logoutError } = await requireSupabase().auth.signOut();
      if (logoutError) {
        setMessage(
          'Senha alterada. Não foi possível encerrar a sessão; tente sair pela sua conta.',
        );
        return;
      }
      setDone(true);
    } catch {
      setMessage('Falha de conexão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  // O SDK processa PKCE uma única vez na inicialização; não trocar o mesmo código manualmente.
  return (
    <IonPage>
      <IonContent>
        <main className="auth-single">
          <section className="login-form-panel">
            <h2>
              {invitation
                ? 'Defina sua senha'
                : recovery
                  ? 'Uma nova senha'
                  : 'Confirmação de cadastro'}
            </h2>
            {loading || validatingInvite || validatingRecovery ? (
              <p role="status">Validando o link…</p>
            ) : done ? (
              <>
                <p role="status">Senha atualizada. Entre novamente.</p>
                <Link to="/entrar">Ir para o login</Link>
              </>
            ) : failed || inviteError || recoveryError || !session ? (
              <>
                <p>
                  Não foi possível validar este link. Ele pode ter expirado ou ter sido aberto em
                  outro navegador. Solicite um novo link e abra o e-mail mais recente.
                </p>
                {recovery && <RecoveryRequest />}
                <Link to="/entrar">Voltar ao login</Link>
              </>
            ) : !recovery && !invitation ? (
              location.pathname === '/auth/callback' ? (
                <Navigate to="/conta" replace />
              ) : null
            ) : (
              <form className="login-form" onSubmit={update}>
                <fieldset disabled={busy}>
                  <label htmlFor="new-password">Nova senha</label>
                  <input
                    id="new-password"
                    name="password"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                  <label htmlFor="confirm-new-password">Confirme a nova senha</label>
                  <input
                    id="confirm-new-password"
                    name="confirmation"
                    type="password"
                    minLength={12}
                    maxLength={128}
                    required
                    autoComplete="new-password"
                  />
                  <button className="g-button login-submit" type="submit">
                    {busy ? 'Atualizando…' : 'Salvar nova senha'}
                  </button>
                  <p role="status">{message}</p>
                </fieldset>
              </form>
            )}
          </section>
        </main>
      </IonContent>
    </IonPage>
  );
}
