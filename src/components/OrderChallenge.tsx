import { useEffect, useRef, useState } from 'react';

type Turnstile = {
  render: (
    element: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      size: string;
      callback: (token: string) => void;
      'expired-callback': () => void;
      'error-callback': () => void;
    },
  ) => string;
  remove: (id: string) => void;
};
declare global {
  interface Window {
    turnstile?: Turnstile;
  }
}
let scriptPromise: Promise<void> | undefined;
function loadChallenge() {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise)
    scriptPromise = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = undefined;
        script.remove();
        reject(new Error());
      };
      document.head.append(script);
    });
  return scriptPromise;
}
export function OrderChallenge({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [failed, setFailed] = useState(false);
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY?.trim();
  useEffect(() => {
    if (!sitekey) return;
    let active = true,
      widget: string | undefined;
    loadChallenge()
      .then(() => {
        if (!active || !container.current || !window.turnstile) return;
        widget = window.turnstile.render(container.current, {
          sitekey,
          action: 'create_order',
          size: 'compact',
          callback: (token) => {
            if (active) {
              setFailed(false);
              onToken(token);
            }
          },
          'expired-callback': () => {
            if (active) onToken('');
          },
          'error-callback': () => {
            if (active) {
              onToken('');
              setFailed(true);
            }
          },
        });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
      if (widget !== undefined) window.turnstile?.remove(widget);
    };
  }, [sitekey, onToken]);
  if (!sitekey)
    return <p>O pedido online está indisponível. Combine seu pedido pelo WhatsApp abaixo.</p>;
  return (
    <div className="landing-order-challenge">
      <div ref={container} />
      {failed && (
        <p role="alert">
          Não foi possível concluir a verificação. Tente novamente ou continue pelo WhatsApp.
        </p>
      )}
    </div>
  );
}
