begin;

-- auth.sessions é gerenciada pelo Auth. Nunca conceder sua leitura ao navegador.
create function private.session_within_deadline() returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare session_id uuid;
begin
  begin
    session_id := (auth.jwt()->>'session_id')::uuid;
  exception when invalid_text_representation then
    return false;
  end;
  return exists (
    select 1 from auth.sessions s
    where s.id = session_id and s.user_id = (select auth.uid())
      and s.created_at <= statement_timestamp()
      and s.created_at > statement_timestamp() - interval '72 hours'
      and (s.not_after is null or s.not_after > statement_timestamp())
  );
end;
$$;
revoke all on function private.session_within_deadline() from public, anon, authenticated;

-- Todas as policies e RPCs existentes já passam por este controle central.
create or replace function private.confirmed_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select private.session_within_deadline() and exists (
    select 1 from auth.users where id = (select auth.uid())
      and email_confirmed_at is not null
  );
$$;
revoke all on function private.confirmed_user() from public, anon;
grant execute on function private.confirmed_user() to authenticated;

-- Sem argumentos: o cliente só pode validar a própria sessão autenticada.
create function public.current_session_valid() returns boolean
language sql stable security invoker set search_path = '' as $$
  select private.confirmed_user();
$$;
revoke all on function public.current_session_valid() from public, anon;
grant execute on function public.current_session_valid() to authenticated;

comment on function public.current_session_valid() is
  'Confirma usuário e sessão existente com idade inferior a 72 horas no relógio do servidor. Não exige plano Pro.';
commit;
