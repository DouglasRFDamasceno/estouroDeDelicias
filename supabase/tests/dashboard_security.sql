begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000081','dashboard-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000082','dashboard-member@example.invalid',now(),'{"is_admin":true}'),
('00000000-0000-0000-0000-000000000083','dashboard-unconfirmed@example.invalid',null,'{}');
-- Sessões fictícias reais no banco; um JWT sem sessão não autoriza acesso.
insert into auth.sessions(id,user_id,created_at)
select id,id,statement_timestamp() from auth.users
where id in ('00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000082','00000000-0000-0000-0000-000000000083');

update public.profiles set is_admin=true where id in ('00000000-0000-0000-0000-000000000081','00000000-0000-0000-0000-000000000083');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000081',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000081','role','authenticated','session_id','00000000-0000-0000-0000-000000000081')::text,true);
do $$ declare p1 uuid; p2 uuid; mid uuid; r1 uuid:=gen_random_uuid(); r2 uuid:=gen_random_uuid(); sid uuid; data jsonb; request uuid; lines jsonb:='[]'; pid uuid; idx integer; begin
 data:=public.dashboard_summary('2020-02-01','2020-02-29');
 if (data->>'sale_count')::int<>0 or (data->>'revenue_cents')::bigint<>0 or data->'estimated_gross_margin_cents'<>'null'::jsonb then raise exception 'Período vazio inventou dados'; end if;
 insert into public.products(name,category,presentation,price_cents) values('Produto dashboard 1','Doces','Unidade',1000) returning id into p1;
 insert into public.products(name,category,presentation,price_cents) values('Produto dashboard 2','Doces','Unidade',2000) returning id into p2;
 insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Chocolate dashboard',1,'kg',3000) returning id into mid;
 perform public.save_recipe(r1,0,gen_random_uuid(),'Receita dashboard 1',p1,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',200,'unit','g')));
 perform public.create_sale(gen_random_uuid(),'Cliente A','2020-02-10',500,'pix','',jsonb_build_array(jsonb_build_object('product_id',p1,'quantity',2,'unit_price_cents',1000)));
 perform public.create_sale(gen_random_uuid(),'Cliente B','2020-02-10',0,'pending','',jsonb_build_array(jsonb_build_object('product_id',p2,'quantity',1,'unit_price_cents',2000)));
 perform public.create_sale(gen_random_uuid(),'Cliente antigo','2020-01-10',200,'pix','',jsonb_build_array(jsonb_build_object('product_id',p1,'quantity',1,'unit_price_cents',1000)));
 data:=public.dashboard_summary('2020-02-01','2020-02-29');
 if (data->>'sale_count')::int<>2 or (data->>'revenue_cents')::bigint<>4000 or (data->>'received_cents')::bigint<>500 or (data->>'receivable_cents')::bigint<>3500 or (data->>'average_ticket_cents')::bigint<>2000 then raise exception 'Vendas, período ou ticket incorretos: %',data; end if;
 if (data->>'units')::int<>3 or (data->>'costed_units')::int<>2 or (data->>'missing_units')::int<>1 or (data->>'estimated_cost_cents')::int<>120 or data->'estimated_gross_margin_cents'<>'null'::jsonb then raise exception 'Cobertura parcial incorreta'; end if;
 if (data->>'partial_count')::int<>1 or (data->>'unpaid_count')::int<>1 or (data->>'all_receivable_cents')::bigint<>4300 or (data->>'all_pending_count')::int<>3 then raise exception 'Pendências incorretas'; end if;
 perform public.save_recipe(r2,0,gen_random_uuid(),'Receita dashboard 2',p2,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',200,'unit','g')));
 data:=public.dashboard_summary('2020-02-01','2020-02-29');
 if (data->>'estimated_cost_cents')::int<>180 or (data->>'estimated_gross_margin_cents')::int<>3820 then raise exception 'Margem completa incorreta'; end if;
 update public.materials set price_cents=6000 where id=mid;
 data:=public.dashboard_summary('2020-02-01','2020-02-29');
 if (data->>'estimated_cost_cents')::int<>360 then raise exception 'Não atualizou custo atual'; end if;
 perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Receita alternativa',p1,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',100,'unit','g')));
 data:=public.dashboard_summary('2020-02-01','2020-02-29');
 if (data->>'ambiguous_units')::int<>2 or data->'estimated_gross_margin_cents'<>'null'::jsonb then raise exception 'Escolheu receita arbitrária'; end if;
 update public.products set name='Nome atual diferente',price_cents=9999 where id=p1;
 data:=public.dashboard_products('2020-02-01','2020-02-29',1,10,'revenue_cents',false);
 if (data->>'total')::int<>2 or jsonb_array_length(data->'rows')<>2 or (data->'rows'->0->>'revenue_cents')::int<>2000 then raise exception 'Ranking incorreto'; end if;
 if not exists(select 1 from jsonb_array_elements(data->'rows') value where value->>'name'='Produto dashboard 1') then raise exception 'Perdeu nome histórico'; end if;
 for idx in 1..12 loop
  insert into public.products(name,category,presentation,price_cents) values('Ranking '||lpad(idx::text,2,'0'),'Doces','Unidade',100) returning id into pid;
  lines:=lines||jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1,'unit_price_cents',100));
 end loop;
 perform public.create_sale(gen_random_uuid(),'Ranking','2020-03-10',0,'pending','',lines);
 data:=public.dashboard_products('2020-03-01','2020-03-31',2,10,'name',true);
 if (data->>'total')::int<>12 or jsonb_array_length(data->'rows')<>2 or data->'rows'->0->>'name'<>'Ranking 11' then raise exception 'Paginação/ordenação incorretas'; end if;
 begin perform public.dashboard_summary('2020-02-10','2020-02-01'); raise exception 'Período invertido aceito' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin perform public.dashboard_products('2020-02-01','2020-02-29',1,999,'name',true); raise exception 'Página sem limite aceita' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000082',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000082','role','authenticated','session_id','00000000-0000-0000-0000-000000000082')::text,true);
do $$ begin
 begin perform public.dashboard_summary('2020-02-01','2020-02-29'); raise exception 'Membro acessou indicadores' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.dashboard_products('2020-02-01','2020-02-29',1,10,'name',true); raise exception 'Membro acessou ranking' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000083',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000083','role','authenticated','session_id','00000000-0000-0000-0000-000000000083')::text,true);
do $$ begin
 begin perform public.dashboard_summary('2020-02-01','2020-02-29'); raise exception 'Não confirmado acessou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.dashboard_summary('2020-02-01','2020-02-29'); raise exception 'Anônimo acessou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
