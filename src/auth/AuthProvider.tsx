import { Fragment, createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { createSessionPolicy } from '../services/sessionPolicy';
import { logoutCurrentSession } from '../services/logout';
type Identity = { owner: string; firstName: string; isAdmin: boolean };
const Context = createContext<{
  session: Session | null;
  loading: boolean;
  identity: Identity | null;
  identityLoading: boolean;
  refreshIdentity: () => void;
}>({
  session: null,
  loading: true,
  identity: null,
  identityLoading: false,
  refreshIdentity: () => {},
});
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [identityLoading, setIdentityLoading] = useState(false);
  const [identityResolvedFor, setIdentityResolvedFor] = useState<string | null>(null);
  const [identityVersion, setIdentityVersion] = useState(0);
  const userId = session?.user.id;
  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }
    let active = true;
    let receivedAuthEvent = false;
    const policy = createSessionPolicy(() => {
      if (!active) return;
      setSession(null);
      setIdentity(null);
      setIdentityResolvedFor(null);
      void logoutCurrentSession('expired').catch(() => {
        // Keep protected pages unmounted even if remote revocation fails.
        if (active) window.location.replace('/entrar?session=expired');
      });
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, value) => {
      receivedAuthEvent = true;
      if (active) {
        setSession(policy.accept(value, _event) ? value : null);
        setLoading(false);
        if (!value) {
          setIdentity(null);
          setIdentityResolvedFor(null);
        }
      }
    });
    void supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (active && !receivedAuthEvent) {
          setSession(
            !error && policy.accept(data.session, 'INITIAL_SESSION') ? data.session : null,
          );
          setLoading(false);
        }
      })
      .catch(() => {
        if (active && !receivedAuthEvent) {
          setSession(null);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      subscription.unsubscribe();
      policy.dispose();
    };
  }, []);
  useEffect(() => {
    if (!supabase || !userId) {
      setIdentity(null);
      setIdentityLoading(false);
      return;
    }
    let active = true;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10000);
    setIdentityLoading(true);
    void Promise.resolve(
      supabase
        .from('profiles')
        .select('full_name,is_admin')
        .eq('id', userId)
        .abortSignal(controller.signal)
        .single(),
    )
      .then(({ data, error }) => {
        if (active)
          setIdentity(
            !error && data
              ? {
                  owner: userId,
                  firstName: data.full_name.trim().split(/\s+/)[0],
                  isAdmin: data.is_admin === true,
                }
              : null,
          );
      })
      .catch(() => {
        if (active) setIdentity(null);
      })
      .finally(() => {
        window.clearTimeout(timeout);
        if (active) {
          setIdentityLoading(false);
          setIdentityResolvedFor(userId);
        }
      });
    return () => {
      active = false;
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [userId, identityVersion]);
  const visibleIdentity = identity?.owner === userId ? identity : null;
  return (
    <Context.Provider
      value={{
        session,
        loading,
        identity: visibleIdentity,
        identityLoading: identityLoading || Boolean(userId && identityResolvedFor !== userId),
        refreshIdentity: () => setIdentityVersion((value) => value + 1),
      }}
    >
      <Fragment key={userId ?? 'signed-out'}>{children}</Fragment>
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
