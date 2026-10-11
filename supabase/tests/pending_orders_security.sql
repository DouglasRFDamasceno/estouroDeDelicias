-- Somente banco isolado de testes, como postgres, após todas as migrações. Nada persiste.
begin;
delete from public.pending_orders;
delete from private.order_limits;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000201','order-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000202','order-admin2@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000203','order-member@example.invalid',now(),'{}');
insert into auth.sessions(id,user_id,created_at) select id,id,now() from auth.users
where id in ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202','00000000-0000-0000-0000-000000000203');
update public.profiles set is_admin=true where id in ('00000000-0000-0000-0000-000000000201','00000000-0000-0000-0000-000000000202');

do $$ declare r text; begin
 foreach r in array array['anon','authenticated'] loop
  if has_table_privilege(r,'public.pending_orders','INSERT') or has_table_privilege(r,'public.pending_orders','UPDATE')
   or has_function_privilege(r,'public.create_pending_order(uuid,text,text,jsonb)','EXECUTE')
   or has_function_privilege(r,'public.admit_order_attempt(text)','EXECUTE')
   or has_function_privilege(r,'public.cleanup_pending_orders()','EXECUTE')
   or has_table_privilege(r,'private.order_limits','SELECT')
   or has_table_privilege(r,'private.order_requests','SELECT') then raise exception 'Permissão indevida: %',r; end if;
 end loop;
end $$;

set local role service_role;
do $$ declare i integer; oid uuid:=gen_random_uuid(); first_result jsonb; repeated jsonb;
 payload jsonb:='[{"flavor":"Ninho","size":50,"quantity":2,"unit_price_cents":1}]';
begin
 if not public.admit_order_attempt(repeat('a',64)) then raise exception 'Negou primeira tentativa'; end if;
 first_result:=public.create_pending_order(oid,repeat('a',64),'Maria',payload);
 perform set_config('test.order_id',oid::text,true);
 if (first_result->>'total_cents')::bigint<>(select price_cents*2 from public.products where name='Ninho' and presentation='50 g' and category='Pipocas gourmet')
 then raise exception 'Confiou no preço do cliente'; end if;
 for i in 2..30 loop perform public.create_pending_order(gen_random_uuid(),repeat('a',64),'Maria',payload); end loop;
 begin
  perform public.create_pending_order(gen_random_uuid(),repeat('a',64),'Maria',payload);
  raise exception 'Aceitou 31 pedidos/IP/mês' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'MONTHLY_IP_LIMIT' then raise; end if; end;
 repeated:=public.create_pending_order(oid,repeat('a',64),'Maria',payload);
 if repeated<>first_result then raise exception 'Idempotência falhou ao atingir cota'; end if;
 begin
  perform public.create_pending_order(oid,repeat('a',64),'Outro nome',payload);
  raise exception 'Reutilizou identificador com outro conteúdo' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'REQUEST_CONFLICT' then raise; end if; end;
 for i in 2..5 loop if not public.admit_order_attempt(repeat('a',64)) then raise exception 'Negou antes de 5/min'; end if; end loop;
 if public.admit_order_attempt(repeat('a',64)) then raise exception 'Aceitou 6 tentativas/min'; end if;
end $$;
reset role;

do $$ declare m date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date; before_rows bigint; begin
 if (select count(*) from public.pending_orders)<>30 then raise exception 'Tentativas inválidas persistiram'; end if;
 if (select accepted from private.order_limits where month=m and key=repeat('a',64))<>30 then raise exception 'Retry consumiu cota'; end if;
 update private.order_limits set minute=now()-interval '2 minutes' where key=repeat('a',64);
 if not public.admit_order_attempt(repeat('a',64)) then raise exception 'Janela não reiniciou'; end if;
 update private.order_limits set minute=date_trunc('minute',now()),minute_attempts=100 where key='global';
 if public.admit_order_attempt(repeat('b',64)) then raise exception 'Aceitou rajada global'; end if;
 update private.order_limits set minute_attempts=0,attempts=10000 where key='global';
 select count(*) into before_rows from private.order_limits;
 if public.admit_order_attempt(repeat('b',64)) then raise exception 'Aceitou após teto de tentativas'; end if;
 if (select count(*) from private.order_limits)<>before_rows then raise exception 'Criou contador após teto'; end if;
 update private.order_limits set attempts=30,minute_attempts=0 where key='global';
 if not public.admit_order_attempt(repeat('b',64)) then raise exception 'Negou IP novo'; end if;
 update private.order_limits set accepted=1000 where key='global';
 begin
  perform public.create_pending_order(gen_random_uuid(),repeat('b',64),'Maria','[{"flavor":"Ninho","size":50,"quantity":1}]');
  raise exception 'Aceitou após cota mensal global' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'GLOBAL_LIMIT' then raise; end if; end;
 update private.order_limits set accepted=30 where key='global';
 insert into public.pending_orders(id,customer,items,total_cents)
 select gen_random_uuid(),'Limite teste',p.items,p.total_cents from public.pending_orders p cross join generate_series(1,270) where p.id=current_setting('test.order_id')::uuid;
 begin
  perform public.create_pending_order(gen_random_uuid(),repeat('b',64),'Maria','[{"flavor":"Ninho","size":50,"quantity":1}]');
  raise exception 'Aceitou mais de 300 pendentes' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'GLOBAL_LIMIT' then raise; end if; end;
 delete from public.pending_orders where customer='Limite teste';
 begin
  perform public.create_pending_order(gen_random_uuid(),repeat('b',64),'Maria','[{"flavor":"Ninho","size":50,"quantity":0}]');
  raise exception 'Aceitou quantidade inválida' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'INVALID_ORDER' then raise; end if; end;
 begin
  perform public.create_pending_order(gen_random_uuid(),repeat('b',64),'Maria','[{"flavor":"Ninho","size":50,"quantity":1},{"flavor":"Ninho","size":50,"quantity":1}]');
  raise exception 'Aceitou produto duplicado' using errcode='ZX001';
 exception when sqlstate 'P0001' then if sqlerrm<>'PRODUCT_UNAVAILABLE' then raise; end if; end;
end $$;

set local role anon;
do $$ begin
 begin perform * from public.pending_orders; raise exception 'Anônimo leu pedidos' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.create_pending_order(gen_random_uuid(),repeat('c',64),'Ataque','[]'); raise exception 'Anônimo gravou pedido' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000203',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000203","session_id":"00000000-0000-0000-0000-000000000203"}',true);
do $$ begin
 if exists(select 1 from public.pending_orders) then raise exception 'Membro leu pedidos'; end if;
 begin perform public.cancel_pending_order(current_setting('test.order_id')::uuid); raise exception 'Membro cancelou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.confirm_pending_order(current_setting('test.order_id')::uuid,gen_random_uuid(),'Maria',current_date,0,'pending','','[]'); raise exception 'Membro confirmou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000201',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000201","session_id":"00000000-0000-0000-0000-000000000201"}',true);
do $$ declare oid uuid:=current_setting('test.order_id')::uuid; p jsonb; sid uuid; cancelled uuid; begin
 if (select count(*) from public.pending_orders)<>30 then raise exception 'Admin não leu pedidos'; end if;
 select jsonb_agg(jsonb_build_object('product_id',i->>'product_id','quantity',i->'quantity','unit_price_cents',i->'unit_price_cents')) into p
 from public.pending_orders o cross join lateral jsonb_array_elements(o.items) i where o.id=oid;
 begin
  perform public.confirm_pending_order(oid,gen_random_uuid(),'Maria',current_date,0,'pending','',jsonb_build_array((p->0)||jsonb_build_object('unit_price_cents',1)));
  raise exception 'Confirmação aceitou preço adulterado' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 if (select status from public.pending_orders where id=oid)<>'pending' then raise exception 'Falha de venda consumiu pedido'; end if;
 select id into cancelled from public.pending_orders where id<>oid limit 1;
 perform public.cancel_pending_order(cancelled);
 if (select status from public.pending_orders where id=cancelled)<>'cancelled' then raise exception 'Admin não cancelou'; end if;
 begin
  perform public.confirm_pending_order(cancelled,gen_random_uuid(),'Maria',current_date,0,'pending','',p);
  raise exception 'Confirmou pedido cancelado' using errcode='ZX001';
 exception when sqlstate 'P0001' then null; end;
 sid:=public.confirm_pending_order(oid,gen_random_uuid(),'Maria',current_date,0,'pending','',p);
 perform set_config('test.sale_id',sid::text,true);
 if (select status from public.pending_orders where id=oid)<>'confirmed' then raise exception 'Pedido não confirmado'; end if;
 if public.confirm_pending_order(oid,gen_random_uuid(),'Maria',current_date,0,'pending','',p)<>sid then raise exception 'Confirmação repetida criou outra venda'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000202',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000202","session_id":"00000000-0000-0000-0000-000000000202"}',true);
do $$ begin
 if public.confirm_pending_order(current_setting('test.order_id')::uuid,gen_random_uuid(),'Maria',current_date,0,'pending','','[]')<>current_setting('test.sale_id')::uuid
 then raise exception 'Segundo admin duplicou venda'; end if;
end $$;
reset role;

do $$ declare oid uuid; m date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date; begin
 update public.pending_orders set expires_at=now()-interval '1 second' where status='pending';
 update public.pending_orders set created_at=now()-interval '31 days' where status<>'pending';
 insert into private.order_limits(month,key) values((m-interval '1 month')::date,repeat('f',64));
 perform public.cleanup_pending_orders();
 if exists(select 1 from public.pending_orders) then raise exception 'Limpeza não removeu expirados'; end if;
 if exists(select 1 from private.order_requests) then raise exception 'Impressões de IP ficaram órfãs'; end if;
 if exists(select 1 from private.order_limits where month<m) then raise exception 'Contadores antigos permaneceram'; end if;
 if not exists(select 1 from public.sales where id=current_setting('test.sale_id')::uuid) then raise exception 'Limpeza removeu venda'; end if;
end $$;
rollback;
