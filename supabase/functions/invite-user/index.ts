// Backend Deno/Supabase Edge Function. Nunca importar este arquivo no frontend.
import { createClient } from 'npm:@supabase/supabase-js@2.117.3';
const url = Deno.env.get('SUPABASE_URL')!;
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Origem única, definida no servidor; nunca aceitar redirect arbitrário do cliente.
const origin = Deno.env.get('APP_ORIGIN') ?? '';
const privileged = createClient(url, secret, {
  auth: { persistSession: false, autoRefreshToken: false },
});
Deno.serve(async (request) => {
  const headers = {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin',
    'Content-Type': 'application/json',
  };
  const reply = (status: number, message: string) =>
    new Response(JSON.stringify({ message }), { status, headers });
  if (!origin || (request.headers.get('origin') && request.headers.get('origin') !== origin))
    return reply(403, 'Origem não permitida.');
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers });
  if (request.method !== 'POST') return reply(405, 'Método não permitido.');
  const token = request.headers.get('authorization')?.match(/^Bearer (.+)$/i)?.[1];
  if (!token) return reply(401, 'Entre novamente.');
  try {
    // Validar o JWT no Auth, e consultar papel atual no banco: não confiar em claims/metadados do cliente.
    const {
      data: { user },
      error: authError,
    } = await privileged.auth.getUser(token);
    if (authError || !user?.email_confirmed_at) return reply(401, 'Entre novamente.');
    // A RPC precisa receber o JWT do usuário, não o Bearer service_role.
    const caller = createClient(url, secret, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: validSession, error: sessionError } = await caller.rpc('current_session_valid');
    if (sessionError || validSession !== true) return reply(401, 'Entre novamente.');
    const { data: profile, error: roleError } = await privileged
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (roleError || profile?.is_admin !== true)
      return reply(403, 'Somente administradores podem convidar usuários.');
    if (Number(request.headers.get('content-length') ?? 0) > 2048)
      return reply(413, 'Requisição muito grande.');
    const raw = await request.text();
    if (raw.length > 2048) return reply(413, 'Requisição muito grande.');
    let body: Record<string, unknown>;
    try {
      body = JSON.parse(raw);
    } catch {
      return reply(400, 'Dados inválidos.');
    }
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      email.length > 254 ||
      name.length < 2 ||
      name.length > 120
    )
      return reply(400, 'Confira nome e e-mail.');
    // Novos perfis sempre nascem is_admin=false, mesmo se houver campo extra no payload.
    const { error } = await privileged.auth.admin.inviteUserByEmail(email, {
      data: { full_name: name },
      redirectTo: `${origin}/auth/invite`,
    });
    if (error)
      return reply(
        400,
        'Não foi possível enviar o convite. Confira o endereço ou tente novamente mais tarde.',
      );
    return reply(
      200,
      'Convite enviado. A pessoa deve definir sua própria senha pelo link de e-mail.',
    );
  } catch {
    return reply(503, 'Serviço temporariamente indisponível.');
  }
});
