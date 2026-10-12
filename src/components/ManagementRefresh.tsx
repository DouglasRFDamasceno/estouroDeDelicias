import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { IonContent, IonRefresher, IonRefresherContent } from '@ionic/react';
import type { RefresherCustomEvent } from '@ionic/react';

const RefreshContext = createContext({
  refreshVersion: 0,
  trackRefresh: (request: Promise<unknown>) => {
    void request;
  },
});

export function useManagementRefresh() {
  return useContext(RefreshContext);
}

export function ManagementRefresh({ children }: { children: ReactNode }) {
  const [refreshVersion, setRefreshVersion] = useState(0);
  const requests = useRef(new Set<Promise<void>>());
  const refreshing = useRef<RefresherCustomEvent | null>(null);
  const trackRefresh = useCallback((request: Promise<unknown>) => {
    const settled = request
      .then(
        () => {},
        () => {},
      )
      .finally(() => requests.current.delete(settled));
    requests.current.add(settled);
  }, []);

  useEffect(() => {
    const event = refreshing.current;
    if (!event) return;
    let active = true;
    // Child loading effects register their requests before this effect runs.
    void (async () => {
      while (active && requests.current.size) {
        await Promise.all([...requests.current]);
        // Let dependent queries (charts or a corrected page) register after rendering.
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
      }
      if (active && refreshing.current === event) {
        refreshing.current = null;
        event.detail.complete();
      }
    })();
    return () => {
      active = false;
    };
  }, [refreshVersion]);

  useEffect(
    () => () => {
      refreshing.current?.detail.complete();
      refreshing.current = null;
    },
    [],
  );

  function refresh(event: RefresherCustomEvent) {
    if (refreshing.current) return;
    // An inline product draft must survive an accidental pull while editing.
    if (event.target.closest('ion-content')?.querySelector('form.product-form, dialog[open]')) {
      event.detail.complete();
      return;
    }
    refreshing.current = event;
    setRefreshVersion((version) => version + 1);
  }

  return (
    <RefreshContext.Provider value={{ refreshVersion, trackRefresh }}>
      <IonContent forceOverscroll>
        <IonRefresher slot="fixed" onIonRefresh={refresh}>
          <IonRefresherContent pullingText="Puxe para atualizar" refreshingText="Atualizando…" />
        </IonRefresher>
        {children}
      </IonContent>
    </RefreshContext.Provider>
  );
}
