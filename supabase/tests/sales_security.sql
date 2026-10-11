begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000021','admin-sales@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000022','member-sales@example.invalid',now(),'{"is_admin":true}');
update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000021';
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000021',true);
do $$
declare product public.products%rowtype; sid uuid; again uuid; before_count bigint;
begin
 select * into product from public.products limit 1;
 sid:=public.create_sale('00000000-0000-0000-0000-000000000031','Teste',current_date,0,'pending','',jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',2,'unit_price_cents',product.price_cents)));
 again:=public.create_sale('00000000-0000-0000-0000-000000000031','Teste',current_date,0,'pending','',jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',2,'unit_price_cents',product.price_cents)));
 if sid<>again or (select count(*) from public.sales)<>1 then raise exception 'Idempotência falhou'; end if;
 if (select total_cents from public.sales where id=sid)<>product.price_cents*2 or (select count(*) from public.sale_items where sale_id=sid)<>1 then raise exception 'Total/itens incorretos'; end if;
 begin
  perform public.create_sale(gen_random_uuid(),'Teste',current_date,0,'pending','',jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',1,'unit_price_cents',product.price_cents+1)));
  raise exception 'Aceitou preço adulterado' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 begin
  perform public.create_sale(gen_random_uuid(),'Teste',current_date,product.price_cents+1,'pix','',jsonb_build_array(jsonb_build_object('product_id',product.id,'quantity',1,'unit_price_cents',product.price_cents)));
  raise exception 'Aceitou recebimento excessivo' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 if (select count(*) from public.sales)<>1 then raise exception 'Venda inválida persistiu'; end if;
 begin
  update public.sales set total_cents=0 where id=sid;
  raise exception 'Permitiu escrita direta' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
 -- Excluir catálogo preserva o histórico de itens vendidos.
 delete from public.products where id=product.id;
 if not exists(select 1 from public.sale_items where sale_id=sid and product_id is null and product_name=product.name and unit_price_cents=product.price_cents) then raise exception 'Histórico perdido'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000022',true);
do $$ begin
 if exists(select 1 from public.sales) or exists(select 1 from public.sale_items) then raise exception 'Vazamento para membro'; end if;
 begin
  perform public.create_sale(gen_random_uuid(),'Teste',current_date,0,'pending','','[]');
  raise exception 'Membro criou venda' using errcode='ZX001';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.sales; raise exception 'Anônimo leu vendas' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
