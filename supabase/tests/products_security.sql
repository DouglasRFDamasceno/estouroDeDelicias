-- Executar como postgres no banco de teste após as três migrações. Tudo é revertido.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000011','catalog-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000012','catalog-member@example.invalid',now(),'{"is_admin":true}'),
('00000000-0000-0000-0000-000000000013','catalog-unconfirmed@example.invalid',null,'{}');
update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000011';
do $$ begin
 if has_table_privilege('anon','public.products','SELECT') then raise exception 'Anon tem leitura'; end if;
 if has_table_privilege('authenticated','public.products','DELETE') then raise exception 'DELETE liberado'; end if;
 if has_column_privilege('authenticated','public.products','id','INSERT') then raise exception 'ID manipulável'; end if;
 if has_column_privilege('authenticated','public.products','created_at','INSERT') then raise exception 'Data manipulável'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000012',true);
do $$ begin
 if (select count(*) from public.products) < 39 then raise exception 'Catálogo não carregou'; end if;
 begin
  insert into public.products(name,category,presentation,price_cents) values ('Produto de teste','Doces','Unidade',100);
  raise exception 'Usuário comum conseguiu cadastrar';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000013',true);
do $$ begin
 if exists(select 1 from public.products) then raise exception 'Não confirmado conseguiu consultar'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000011',true);
do $$ begin
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
  update public.products set price_cents=0;
  raise exception 'UPDATE liberado';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
update public.profiles set is_admin=false where id='00000000-0000-0000-0000-000000000011';
set local role authenticated;
do $$ begin
 begin
  insert into public.products(name,category,presentation,price_cents) values ('Revogado','Doces','Unidade',100);
  raise exception 'Administrador revogado conseguiu cadastrar';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
rollback;
