begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000041','customer-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000042','customer-member@example.invalid',now(),'{"is_admin":true}');
-- Sessões fictícias reais no banco; um JWT sem sessão não autoriza acesso.
insert into auth.sessions(id,user_id,created_at)
select id,id,statement_timestamp() from auth.users
where id in ('00000000-0000-0000-0000-000000000041','00000000-0000-0000-0000-000000000042');

update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000041';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000041',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000041','role','authenticated','session_id','00000000-0000-0000-0000-000000000041')::text,true);
do $$ declare cid uuid; sid uuid; product public.products%rowtype; begin
 insert into public.customers(name) values('Cliente real') returning id into cid;
 select * into product from public.products limit 1;
 sid:=public.create_sale(gen_random_uuid(),'Nome adulterado',current_date,0,'pending','',jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',1,'unit_price_cents',product.price_cents)),cid);
 if not exists(select 1 from public.sales where id=sid and customer_id=cid and customer='Cliente real') then raise exception 'Identidade do cliente incorreta'; end if;
 begin
  perform public.create_sale(gen_random_uuid(),'Inválido',current_date,0,'pending','','[]',gen_random_uuid());
  raise exception 'Cliente inexistente aceito' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 begin
  perform private.create_sale_base(gen_random_uuid(),'Cliente',current_date,0,'pending','','[]');
  raise exception 'Função interna acessível' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000042',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000042','role','authenticated','session_id','00000000-0000-0000-0000-000000000042')::text,true);
do $$ begin
 if exists(select 1 from public.customers) then raise exception 'Cliente exposto'; end if;
 begin insert into public.customers(name) values('Cliente indevido'); raise exception 'Membro inseriu cliente' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.customers; raise exception 'Cliente exposto ao anônimo' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
