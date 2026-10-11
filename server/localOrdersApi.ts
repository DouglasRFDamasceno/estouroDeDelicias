import type { Plugin } from 'vite';
import { handlePublicOrderHttp } from './publicOrderHttp.ts';

// Somente no Vite dev; nunca participa das funções publicadas na Vercel.
export function localOrdersApi(env: Record<string, string | undefined>): Plugin {
  return {
    name: 'local-orders-api',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.split('?')[0] !== '/api/create-order') return next();
        const ip = req.socket.remoteAddress ?? '';
        const host = req.headers.host ?? '';
        const port = req.socket.localPort;
        if (
          !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) ||
          ![`localhost:${port}`, `127.0.0.1:${port}`, `[::1]:${port}`].includes(host)
        ) {
          res.statusCode = 403;
          res.end();
          return;
        }
        if (!env.SUPABASE_SERVICE_ROLE_KEY || !env.ORDER_IP_HASH_SECRET) {
          res.statusCode = 503;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('Cache-Control', 'no-store');
          res.end(
            JSON.stringify({
              message:
                'Configure SUPABASE_SERVICE_ROLE_KEY e ORDER_IP_HASH_SECRET no .env.local para testar pedidos com npm run dev.',
            }),
          );
          return;
        }
        // Ignorar qualquer IP informado pelo cliente; usar a conexão local real.
        req.headers['x-vercel-forwarded-for'] = ip;
        void handlePublicOrderHttp(req, res, {
          origin: `http://${host}`,
          supabaseUrl: env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '',
          serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
          ipSecret: env.ORDER_IP_HASH_SECRET,
          turnstileSecret: env.TURNSTILE_SECRET_KEY ?? '',
          requireTurnstile: env.ORDER_REQUIRE_TURNSTILE === 'true',
          vercel: true,
        }).catch(() => {
          if (!res.headersSent) res.statusCode = 500;
          res.end();
        });
      });
    },
  };
}
