import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Link } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { requireSupabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';
export function Register() {
  const { session, loading } = useAuth();
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  useEffect(() => {
    let active = true;
    setAllowed(false);
    setChecking(true);
    if (!session) {
      setChecking(false);
      return;
    }
    void (async () => {
      try {
        const { data, error } = await requireSupabase()
          .from('profiles')
          .select('is_admin')
          .eq('id', session.user.id)
          .single();
        if (active) setAllowed(!error && data?.is_admin === true);
      } catch {
        if (active) setAllowed(false);
      } finally {
        if (active) setChecking(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !allowed) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().functions.invoke('invite-user', {
        body: {
          name: String(fields.get('name')).trim(),
          email: String(fields.get('email')).trim(),
        },
      });
      if (error) {
        setMessage('Não foi possível enviar o convite. Verifique sua permissão e tente novamente.');
        return;
      }
      form.reset();
      setMessage('Convite enviado. A pessoa receberá um link para definir a própria senha.');
    } catch {
      setMessage('Falha de conexão. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <IonPage>
      <IonContent>
        <div className="gourmet login-screen">
          <header className="login-header">
            <Link to="/">
              <Brand />
            </Link>
            <Link to="/entrar">Entrar ↗</Link>
          </header>
          <main className="auth-single">
            <section className="login-form-panel">
              <p className="g-kicker">ACESSO POR CONVITE</p>
              <h2>{allowed ? 'Convidar uma pessoa' : 'Vamos cuidar do seu acesso.'}</h2>
              {loading || checking ? (
                <p role="status">Verificando permissão…</p>
              ) : !allowed ? (
                <>
                  <p className="login-intro">
                    As contas são criadas somente por convite de um administrador. Se você já
                    recebeu um convite, abra o link no seu e-mail para definir sua senha.
                  </p>
                  <Link className="g-button" to="/entrar">
                    Já tenho conta · Entrar
                  </Link>
                </>
              ) : (
                <>
                  <p className="login-intro">
                    Informe nome e e-mail. A pessoa define a própria senha pelo convite; não
                    compartilhe senhas.
                  </p>
                  <form className="login-form" onSubmit={submit}>
                    <fieldset disabled={busy}>
                      <label htmlFor="invite-name">Nome completo</label>
                      <input
                        id="invite-name"
                        name="name"
                        autoComplete="name"
                        required
                        minLength={2}
                        maxLength={120}
                      />
                      <label htmlFor="invite-email">E-mail</label>
                      <input
                        id="invite-email"
                        name="email"
                        type="email"
                        autoComplete="email"
                        autoCapitalize="none"
                        required
                        maxLength={254}
                      />
                      <button className="g-button login-submit" type="submit">
                        {busy ? 'Enviando…' : 'Enviar convite'} ↗
                      </button>
                    </fieldset>
                  </form>
                  <p role="status" className="login-feedback">
                    {message}
                  </p>
                </>
              )}
              <p className="login-signup">
                <Link to="/conta">Minha conta</Link>
              </p>
            </section>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
}
