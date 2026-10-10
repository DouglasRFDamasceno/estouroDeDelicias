-- Executar como postgres no banco LOCAL/de teste, após a migração. Tudo é revertido.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000001','test-a@example.invalid',now(),'{"full_name":"Pessoa A","role":"admin","is_admin":true}'),
('00000000-0000-0000-0000-000000000002','test-b@example.invalid',now(),'{"full_name":"Pessoa B"}'),
('00000000-0000-0000-0000-000000000003','test-c@example.invalid',null,'{}');
do $$ begin
 if (select count(*) from public.profiles where id in ('00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003')) <> 3 then raise exception 'Trigger não criou os perfis'; end if;
 if has_table_privilege('anon','public.profiles','SELECT') then raise exception 'Anon pode consultar'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000001',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}',true);
do $$ declare affected integer; begin
 if (select is_admin from public.profiles where id='00000000-0000-0000-0000-000000000001') then raise exception 'Metadados promoveram usuário'; end if;
 begin
  update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000001';
  raise exception 'Autopromoção permitida';
 exception when insufficient_privilege then null; end;
 if (select count(*) from public.profiles) <> 1 then raise exception 'RLS vazou perfis'; end if;
 update public.profiles set city='Cidade de teste' where id='00000000-0000-0000-0000-000000000002';
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Atualização cruzada permitida'; end if;
 update public.profiles set city='Minha cidade', document='52998224725' where id='00000000-0000-0000-0000-000000000001';
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Titular não conseguiu atualizar'; end if;
 begin
  update public.profiles set document='11111111111' where id='00000000-0000-0000-0000-000000000001';
  raise exception 'CPF inválido aceito';
 exception when check_violation then null; end;
 begin
  update public.profiles set id='00000000-0000-0000-0000-000000000002';
  raise exception 'Alteração de ID permitida';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.profiles;
  raise exception 'DELETE permitido';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.profiles(id,full_name) values ('00000000-0000-0000-0000-000000000004','Invasor');
  raise exception 'INSERT permitido';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000003',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000003","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.profiles) then raise exception 'Conta não confirmada pode ler'; end if;
end $$;
reset role;
rollback;
