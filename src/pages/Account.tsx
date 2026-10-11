import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { IonContent, IonPage } from '@ionic/react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { requireSupabase } from '../services/supabase';
import { emptyProfile, normalizeProfile, profileFields, validateProfile } from '../domain/profile';
import { formatProfileInput } from '../domain/profileInput';
import { fetchPostalAddress } from '../services/postalAddress';
import { logoutCurrentSession } from '../services/logout';
import type { Profile } from '../domain/profile';
const labels: Record<keyof Profile, string> = {
  full_name: 'Nome completo',
  phone: 'Telefone com DDD',
  document: 'CPF (opcional)',
  postal_code: 'CEP',
  street: 'Rua / avenida',
  address_number: 'Número',
  complement: 'Complemento',
  district: 'Bairro',
  city: 'Cidade',
  state: 'UF',
};
const lengths: Record<keyof Profile, number> = {
  full_name: 120,
  phone: 16,
  document: 14,
  postal_code: 9,
  street: 160,
  address_number: 20,
  complement: 120,
  district: 100,
  city: 100,
  state: 2,
};
export function Account() {
  const { session, loading, refreshIdentity } = useAuth();
  const location = useLocation();
  const [profile, setProfile] = useState<Profile>(emptyProfile);
  const [fetching, setFetching] = useState(true);
  const [ready, setReady] = useState(false);
  const [profileOwner, setProfileOwner] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [retry, setRetry] = useState(0);
  const [postalMessage, setPostalMessage] = useState('');
  const [lookupCep, setLookupCep] = useState('');
  const postalRequest = useRef<AbortController | null>(null);
  const addressEdits = useRef(new Set<keyof Profile>());
  function changeField(key: keyof Profile, raw: string) {
    const value = formatProfileInput(key, raw);
    if (key === 'postal_code') {
      postalRequest.current?.abort();
      postalRequest.current = null;
      addressEdits.current.clear();
      setPostalMessage('');
      setLookupCep(value.replace(/\D/g, ''));
    } else {
      addressEdits.current.add(key);
    }
    setProfile((current) => ({ ...current, [key]: value }));
  }
  useEffect(() => {
    if (!session || !ready || profileOwner !== session.user.id || !/^\d{8}$/.test(lookupCep))
      return;
    const controller = new AbortController();
    postalRequest.current = controller;
    setPostalMessage('Buscando endereço…');
    const timer = window.setTimeout(() => {
      const timeout = window.setTimeout(() => controller.abort(), 8000);
      void fetchPostalAddress(lookupCep, controller.signal)
        .then((address) => {
          if (controller.signal.aborted) return;
          setProfile((current) => {
            if (current.postal_code.replace(/\D/g, '') !== lookupCep) return current;
            const next = { ...current };
            for (const key of ['street', 'district', 'city', 'state'] as const) {
              if (!addressEdits.current.has(key)) next[key] = address[key];
            }
            return next;
          });
          setPostalMessage('Endereço encontrado. Confira os dados e informe o número.');
        })
        .catch((error) => {
          if (postalRequest.current !== controller) return;
          setPostalMessage(
            error instanceof Error && error.message === 'NOT_FOUND'
              ? 'CEP não encontrado. Confira o CEP ou preencha o endereço manualmente.'
              : 'Não foi possível consultar o CEP. Você pode preencher o endereço manualmente.',
          );
        })
        .finally(() => window.clearTimeout(timeout));
    }, 400);
    return () => {
      postalRequest.current = null;
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [lookupCep, session, ready, profileOwner]);
  useEffect(() => {
    let active = true;
    setLookupCep('');
    setPostalMessage('');
    setProfile(emptyProfile);
    setReady(false);
    setProfileOwner(null);
    setMessage('');
    if (!session) {
      setFetching(false);
      return;
    }
    setFetching(true);
    void (async () => {
      try {
        const client = requireSupabase();
        const { data: verified, error: authError } = await client.auth.getUser();
        if (authError || verified.user?.id !== session.user.id) throw new Error('AUTH');
        const { data, error } = await client
          .from('profiles')
          .select(profileFields.join(','))
          .eq('id', verified.user.id)
          .single();
        if (error || !data) throw new Error('PROFILE');
        if (active) {
          setProfile(
            Object.fromEntries(
              profileFields.map((key) => [key, (data as unknown as Profile)[key] ?? '']),
            ) as Profile,
          );
          setProfileOwner(session.user.id);
          setReady(true);
        }
      } catch {
        if (active)
          setMessage(
            'Não foi possível carregar seu perfil. Confira a conexão e a migração do banco.',
          );
      } finally {
        if (active) setFetching(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [session, retry]);
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || !ready || profileOwner !== session?.user.id) return;
    postalRequest.current?.abort();
    setLookupCep('');
    setPostalMessage('');
    const normalized = normalizeProfile(profile);
    const issue = validateProfile(normalized);
    if (issue) {
      setMessage(issue);
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      const client = requireSupabase();
      const { data, error: authError } = await client.auth.getUser();
      if (authError || !data.user || data.user.id !== profileOwner) throw new Error('AUTH');
      const values = Object.fromEntries(profileFields.map((key) => [key, normalized[key] || null]));
      const { data: updated, error } = await client
        .from('profiles')
        .update(values)
        .eq('id', data.user.id)
        .select('id')
        .single();
      if (error || !updated) throw new Error('SAVE');
      setProfile(normalized);
      refreshIdentity();
      setMessage('Perfil atualizado com sucesso.');
    } catch {
      setMessage('Não foi possível salvar. Confira os campos e tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  async function logout() {
    setBusy(true);
    try {
      await logoutCurrentSession();
    } catch {
      setMessage('Não foi possível sair. Verifique a conexão e tente novamente.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <IonPage>
      <IonContent>
        <div className="gourmet login-screen">
          <main className="auth-single">
            <section className="login-form-panel account-panel">
              {loading ? (
                <p role="status">Verificando sessão…</p>
              ) : !session ? (
                location.pathname === '/conta' ? (
                  <Navigate to="/entrar" replace />
                ) : null
              ) : (
                <>
                  <div className="account-heading">
                    <Link to="/">← Voltar ao site</Link>
                    <button type="button" onClick={logout} disabled={busy}>
                      Sair
                    </button>
                  </div>
                  <Link className="text-link" to="/criar-conta">
                    Acesso e convites ↗
                  </Link>
                  <p className="g-kicker">SUA CONTA</p>
                  <h2>Seu perfil</h2>
                  <p className="login-intro">{session.user.email}</p>
                  <p className="login-stage-note">
                    Documento e endereço são opcionais. Preencha apenas quando necessário. Seu
                    perfil não é público e não concede acesso administrativo à gestão.
                  </p>
                  {fetching ? (
                    <p role="status">Carregando perfil…</p>
                  ) : !ready || profileOwner !== session.user.id ? (
                    <button
                      type="button"
                      className="g-button"
                      onClick={() => setRetry((value) => value + 1)}
                    >
                      Tentar novamente
                    </button>
                  ) : (
                    <form className="login-form" onSubmit={save}>
                      <fieldset disabled={busy}>
                        <div className="profile-grid">
                          {profileFields.map((key) => (
                            <div
                              key={key}
                              className={
                                ['full_name', 'street', 'complement'].includes(key)
                                  ? 'profile-wide'
                                  : ''
                              }
                            >
                              <label htmlFor={`profile-${key}`}>{labels[key]}</label>
                              <input
                                id={`profile-${key}`}
                                value={formatProfileInput(key, profile[key])}
                                maxLength={lengths[key]}
                                required={key === 'full_name'}
                                autoComplete="off"
                                inputMode={
                                  ['document', 'phone', 'postal_code'].includes(key)
                                    ? 'numeric'
                                    : 'text'
                                }
                                onChange={(event) => changeField(key, event.target.value)}
                                aria-describedby={
                                  key === 'postal_code' ? 'postal-help postal-status' : undefined
                                }
                              />
                            </div>
                          ))}
                        </div>
                        <p id="postal-help">
                          Ao completar o CEP, ele será consultado no ViaCEP para preencher o
                          endereço. Você pode editar os dados.
                        </p>
                        <p id="postal-status" role="status" aria-live="polite">
                          {postalMessage}
                        </p>
                        <button className="g-button login-submit" type="submit">
                          {busy ? 'Salvando…' : 'Salvar perfil'}
                        </button>
                      </fieldset>
                    </form>
                  )}
                  <p role="status" className="login-feedback">
                    {message}
                  </p>
                </>
              )}
            </section>
          </main>
        </div>
      </IonContent>
    </IonPage>
  );
}
