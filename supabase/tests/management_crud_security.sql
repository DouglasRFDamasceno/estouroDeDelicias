begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000061','crud-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000062','crud-member@example.invalid',now(),'{"is_admin":true}'),
('00000000-0000-0000-0000-000000000063','crud-unconfirmed@example.invalid',null,'{}');
-- Sessões fictícias reais no banco; um JWT sem sessão não autoriza acesso.
insert into auth.sessions(id,user_id,created_at)
select id,id,statement_timestamp() from auth.users
where id in ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000062','00000000-0000-0000-0000-000000000063');

update public.profiles set is_admin=true where id in ('00000000-0000-0000-0000-000000000061','00000000-0000-0000-0000-000000000063');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000061',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000061','role','authenticated','session_id','00000000-0000-0000-0000-000000000061')::text,true);
do $$
declare pid uuid; cid uuid; sid uuid; iid uuid; rev integer; request uuid:=gen_random_uuid(); n integer;
begin
 insert into public.products(name,category,presentation,price_cents) values('Teste CRUD','Doces','Unidade',1000) returning id into pid;
 insert into public.customers(name) values('Cliente CRUD') returning id into cid;
 sid:=public.create_sale(gen_random_uuid(),'Ignorado',current_date,500,'pix','',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1,'unit_price_cents',1000)),cid);
 select id into iid from public.sale_items where sale_id=sid;
 select revision into rev from public.sales where id=sid;
 update public.products set name='Nome novo',price_cents=2000 where id=pid and revision=1;
 get diagnostics n=row_count; if n<>1 then raise exception 'Edição produto falhou'; end if;
 update public.products set name='Perdido' where id=pid and revision=1;
 get diagnostics n=row_count; if n<>0 then raise exception 'Sobrescreveu edição concorrente'; end if;
 update public.customers set name='Cliente atualizado' where id=cid and revision=1;
 perform public.update_sale(sid,rev,request,cid,'Ignorado',current_date,500,'pix','Atualizada',jsonb_build_array(jsonb_build_object('sale_item_id',iid,'quantity',2,'unit_price_cents',99999)));
 if (select total_cents from public.sales where id=sid)<>2000 then raise exception 'Preço histórico adulterado'; end if;
 if (select unit_price_cents from public.sale_items where id=iid)<>1000 then raise exception 'Preço histórico alterado'; end if;
 perform public.update_sale(sid,rev,request,cid,'Ignorado',current_date,500,'pix','Atualizada',jsonb_build_array(jsonb_build_object('sale_item_id',iid,'quantity',2)));
 if (select revision from public.sales where id=sid)<>rev+1 then raise exception 'Repetição incrementou versão'; end if;
 begin perform public.update_sale(sid,rev,gen_random_uuid(),cid,'',current_date,0,'pending','','[]'); raise exception 'Aceitou versão antiga' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin perform public.update_sale(sid,rev+1,gen_random_uuid(),cid,'',current_date,99999,'pix','',jsonb_build_array(jsonb_build_object('sale_item_id',iid,'quantity',2))); raise exception 'Aceitou recebido inválido' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin perform public.update_sale(sid,rev+1,gen_random_uuid(),cid,'',current_date,0,'pending','',jsonb_build_array(jsonb_build_object('sale_item_id',gen_random_uuid(),'quantity',2))); raise exception 'Aceitou item externo' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 if (select total_cents from public.sales where id=sid)<>2000 or (select count(*) from public.sale_items where sale_id=sid)<>1 then raise exception 'Falha no rollback'; end if;
 begin update public.sales set total_cents=0 where id=sid; raise exception 'Escrita direta permitida' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin update public.products set revision=999 where id=pid; raise exception 'Versão adulterável' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 delete from public.products where id=pid;
 delete from public.customers where id=cid;
 if not exists(select 1 from public.sales where id=sid and customer_id is null and customer='Cliente atualizado') then raise exception 'Histórico cliente perdido'; end if;
 select revision into rev from public.sales where id=sid;
 perform public.update_sale(sid,rev,gen_random_uuid(),null,'Cliente atualizado',current_date,500,'pix','',jsonb_build_array(jsonb_build_object('sale_item_id',iid,'quantity',3)));
 if (select total_cents from public.sales where id=sid)<>3000 then raise exception 'Não editou item removido do catálogo'; end if;
 delete from public.sales where id=sid and revision=rev;
 get diagnostics n=row_count; if n<>0 then raise exception 'Excluiu versão antiga'; end if;
 delete from public.sales where id=sid and revision=rev+1;
 if exists(select 1 from public.sale_items where sale_id=sid) then raise exception 'Itens órfãos'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000062',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000062','role','authenticated','session_id','00000000-0000-0000-0000-000000000062')::text,true);
do $$ declare n integer; begin
 update public.products set name='Inválido'; get diagnostics n=row_count; if n<>0 then raise exception 'Membro editou produtos'; end if;
 update public.customers set name='Inválido'; get diagnostics n=row_count; if n<>0 then raise exception 'Membro editou clientes'; end if;
 delete from public.customers; get diagnostics n=row_count; if n<>0 then raise exception 'Membro removeu clientes'; end if;
 delete from public.sales; get diagnostics n=row_count; if n<>0 then raise exception 'Membro removeu vendas'; end if;
 begin perform public.update_sale(gen_random_uuid(),1,gen_random_uuid(),null,'',current_date,0,'pending','','[]'); raise exception 'Membro editou venda' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000063',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000063','role','authenticated','session_id','00000000-0000-0000-0000-000000000063')::text,true);
do $$ declare n integer; begin
 update public.products set name='Inválido'; get diagnostics n=row_count; if n<>0 then raise exception 'Não confirmado editou'; end if;
 begin perform public.update_sale(gen_random_uuid(),1,gen_random_uuid(),null,'',current_date,0,'pending','','[]'); raise exception 'Não confirmado editou venda' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.update_sale(gen_random_uuid(),1,gen_random_uuid(),null,'',current_date,0,'pending','','[]'); raise exception 'Anônimo editou venda' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
