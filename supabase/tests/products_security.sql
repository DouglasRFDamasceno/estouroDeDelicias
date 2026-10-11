-- Executar como postgres no banco de teste após as três migrações. Tudo é revertido.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000011','catalog-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000012','catalog-member@example.invalid',now(),'{"is_admin":true}'),
('00000000-0000-0000-0000-000000000013','catalog-unconfirmed@example.invalid',null,'{}');
-- Sessões fictícias reais no banco; um JWT sem sessão não autoriza acesso.
insert into auth.sessions(id,user_id,created_at)
select id,id,statement_timestamp() from auth.users
where id in ('00000000-0000-0000-0000-000000000011','00000000-0000-0000-0000-000000000012','00000000-0000-0000-0000-000000000013');

update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000011';
do $$ begin
 if has_table_privilege('anon','public.products','SELECT') then raise exception 'Anon tem leitura'; end if;
 if has_table_privilege('anon','public.products','DELETE') then raise exception 'DELETE anônimo liberado'; end if;
 if has_column_privilege('authenticated','public.products','id','INSERT') then raise exception 'ID manipulável'; end if;
 if has_column_privilege('authenticated','public.products','created_at','INSERT') then raise exception 'Data manipulável'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000012','role','authenticated','session_id','00000000-0000-0000-0000-000000000012')::text,true);
do $$ declare affected integer; begin
 delete from public.products;
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Usuário comum conseguiu excluir'; end if;
 if (select count(*) from public.products) < 39 then raise exception 'Catálogo não carregou'; end if;
 begin
  insert into public.products(name,category,presentation,price_cents) values ('Produto de teste','Doces','Unidade',100);
  raise exception 'Usuário comum conseguiu cadastrar';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000013','role','authenticated','session_id','00000000-0000-0000-0000-000000000013')::text,true);
do $$ begin
 if exists(select 1 from public.products) then raise exception 'Não confirmado conseguiu consultar'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000011','role','authenticated','session_id','00000000-0000-0000-0000-000000000011')::text,true);
do $$ declare target uuid; affected integer; begin
 insert into public.products(name,category,presentation,price_cents) values ('Brownie de teste','Doces','Caixa com 6',1605);
 begin
  insert into public.products(name,category,presentation,price_cents) values (' brownie de teste ','DOCES','caixa com 6',1605);
  raise exception 'Duplicidade aceita';
 exception when unique_violation then null; end;
 begin
  insert into public.products(name,category,presentation,price_cents) values ('Teste negativo','Doces','Unidade',-1);
  raise exception 'Preço negativo aceito';
 exception when check_violation then null; end;
 begin
  update public.products set created_at=now();
  raise exception 'Alteração de campo protegido liberada';
 exception when insufficient_privilege then null; end;
 select id into target from public.products where name='Brownie de teste';
 delete from public.products where id=target;
 get diagnostics affected = row_count;
 if affected <> 1 then raise exception 'Administrador não conseguiu remover o produto'; end if;
end $$;
reset role;
update public.profiles set is_admin=false where id='00000000-0000-0000-0000-000000000011';
set local role authenticated;
do $$ declare affected integer; begin
 delete from public.products;
 get diagnostics affected = row_count;
 if affected <> 0 then raise exception 'Administrador revogado conseguiu remover'; end if;
 begin
  insert into public.products(name,category,presentation,price_cents) values ('Revogado','Doces','Unidade',100);
  raise exception 'Administrador revogado conseguiu cadastrar';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
