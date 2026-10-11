import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { validateSupabaseConfig } from './src/domain/supabaseConfig';
import { localOrdersApi } from './server/localOrdersApi';
export default defineConfig(({ mode }) => {
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
  validateSupabaseConfig(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_PUBLISHABLE_KEY);
  return { plugins: [react(), localOrdersApi(env)] };
});
