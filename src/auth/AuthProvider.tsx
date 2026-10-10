import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
const Context = createContext<{ session: Session | null; loading: boolean }>({ session: null, loading: true });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let active = true;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, value) => {
      if (active) { setSession(value); setLoading(false); }
    });
    void supabase.auth.getSession().then(({ data, error }) => {
      if (active) { setSession(error ? null : data.session); setLoading(false); }
    }).catch(() => { if (active) { setSession(null); setLoading(false); } });
    return () => { active = false; subscription.unsubscribe(); };
  }, []);
  return <Context.Provider value={{ session, loading }}>{children}</Context.Provider>;
}
export const useAuth = () => useContext(Context);
