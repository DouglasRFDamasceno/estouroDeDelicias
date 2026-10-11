import { useState } from 'react';
import type { FormEvent } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { authConfigured, authRedirect, requireSupabase } from '../services/supabase';
import { useAuth } from '../auth/AuthProvider';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { returnDestination } from '../domain/navigation';

export function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const { session, loading } = useAuth();
  const location = useLocation();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const form = event.currentTarget;
    const fields = new FormData(form);
    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().auth.signInWithPassword({
        email: String(fields.get('email')).trim(),
        password: String(fields.get('password')),
      });
      if (error)
        setMessage('Não foi possível entrar. Confira e-mail, senha e confirmação do cadastro.');
      else form.reset();
    } catch {
      setMessage('Não foi possível conectar. Verifique sua conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function recover() {
    if (busy) return;
    const input = document.getElementById('login-email') as HTMLInputElement | null;
    if (!input?.value || !input.reportValidity()) {
      setMessage('Informe um e-mail válido no campo acima.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const { error } = await requireSupabase().auth.resetPasswordForEmail(input.value.trim(), {
        redirectTo: authRedirect('/auth/recovery'),
      });
      setMessage(
        error
          ? 'Não foi possível solicitar a recuperação. Tente novamente mais tarde.'
          : 'Se houver uma conta elegível, você receberá as instruções por e-mail. Abra o e-mail mais recente no mesmo navegador e dispositivo em que fez este pedido.',
      );
    } catch {
      setMessage('Não foi possível conectar. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  if (!loading && session && location.pathname === '/entrar')
    return (
      <Navigate
        to={returnDestination(new URLSearchParams(location.search).get('returnTo'))}
        replace
      />
    );

  return (
    <IonPage>
      <IonContent>
        <div className="gourmet login-screen">
          <header className="login-header">
            <Link to="/" aria-label="Estouro de Delícias, início">
              <Brand />
            </Link>
            <Link className="login-back" to="/">
              ← Voltar ao site
            </Link>
          </header>
          <main className="login-layout">
            <aside className="login-story" aria-label="Boas-vindas">
              <span className="login-star" aria-hidden="true">
                ✳
              </span>
              <p className="g-kicker">UM CARINHO EM CADA DETALHE</p>
              <h1>
                Boas ideias.
                <br />
                Novos sabores.
                <br />
                <em>Um doce começo.</em>
              </h1>
              <p>
                O mesmo cuidado que vai em cada pacotinho, agora em um espaço para acompanhar seu
                negócio.
              </p>
              <div className="login-illustration" aria-hidden="true">
                <span>♡</span>
                <strong>
                  Estouro
                  <br />
                  <i>de delícias</i>
                </strong>
                <small>FEITO COM AMOR</small>
              </div>
              <span className="login-story-footer">Pequenos gestos, grandes sorrisos.</span>
            </aside>
            <section className="login-form-panel" aria-labelledby="login-title">
              {new URLSearchParams(location.search).get('session') === 'expired' && (
                <p className="login-feedback" role="status">
                  Sua sessão expirou. Entre novamente para continuar.
                </p>
              )}
              <span className="login-welcome" aria-hidden="true">
                ♡
              </span>
              <p className="g-kicker">QUE BOM TER VOCÊ POR AQUI</p>
              <h2 id="login-title">Entre no seu espaço.</h2>
              <p className="login-intro">Informe seu e-mail e sua senha para continuar.</p>
              {new URLSearchParams(location.search).get('logout') === 'unconfirmed' && (
                <p role="alert" className="login-stage-note">
                  Você saiu deste navegador, mas não foi possível confirmar o encerramento da sessão
                  no servidor. Entre novamente quando a conexão estiver disponível.
                </p>
              )}
              {!authConfigured && (
                <div className="login-stage-note">
                  <strong>Conexão ainda não configurada</strong>
                  <span>Configure o Supabase conforme docs/supabase.md para entrar.</span>
                </div>
              )}
              <form onSubmit={submit} className="login-form">
                <fieldset disabled={busy || loading || !authConfigured}>
                  <label htmlFor="login-email">E-mail</label>
                  <input
                    id="login-email"
                    name="email"
                    type="email"
                    placeholder="voce@exemplo.com"
                    autoComplete="username"
                    inputMode="email"
                    autoCapitalize="none"
                    spellCheck={false}
                    required
                    maxLength={254}
                  />
                  <div className="login-password-heading">
                    <label htmlFor="login-password">Senha</label>
                    <button type="button" className="login-recovery" onClick={recover}>
                      Esqueci minha senha
                    </button>
                  </div>
                  <div className="login-password-field">
                    <input
                      id="login-password"
                      name="password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Sua senha"
                      autoComplete="current-password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? 'Ocultar' : 'Mostrar'}
                    </button>
                  </div>
                  <p className="login-feedback" role="status" aria-live="polite">
                    {message}
                  </p>
                  <button className="g-button login-submit" type="submit">
                    {busy ? 'Aguarde…' : 'Entrar'} <span aria-hidden="true">↗</span>
                  </button>
                </fieldset>
              </form>
              <p className="login-signup">
                O acesso é por convite. <Link to="/criar-conta">Como obter acesso</Link>
              </p>
              <div className="login-demo-link">
                <span>A gestão está disponível para contas autorizadas.</span>
                <Link to="/">Conhecer nossos sabores ↗</Link>
              </div>
            </section>
          </main>
          <footer className="login-footer">
            Estouro de Delícias · Um cuidado que vai além do sabor.
          </footer>
        </div>
      </IonContent>
    </IonPage>
  );
}
