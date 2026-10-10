-- Executar SOMENTE no SQL Editor ou conexão administrativa confiável.
-- Não contém senha. Aplicar após as duas migrações e o aceite do convite.
begin;
do $$
declare target_id uuid; affected integer;
begin
  select id into strict target_id from auth.users
  where lower(email) = lower('douglas.r.f.damasceno@gmail.com')
    and email_confirmed_at is not null;
  update public.profiles set is_admin = true where id = target_id;
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Perfil não encontrado; promoção cancelada'; end if;
exception
  when no_data_found then raise exception 'Crie/confirme primeiro a conta do administrador';
  when too_many_rows then raise exception 'E-mail ambíguo; promoção cancelada';
end $$;
commit;
