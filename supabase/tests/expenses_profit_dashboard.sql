-- Executar somente em PostgreSQL local/de testes, após todas as migrações.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000101','recipe-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000102','recipe-member@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000103','recipe-unconfirmed@example.invalid',null,'{}');
insert into auth.sessions(id,user_id,created_at)
select id,id,statement_timestamp() from auth.users
where id in ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000102','00000000-0000-0000-0000-000000000103');
update public.profiles set is_admin=true where id in ('00000000-0000-0000-0000-000000000101','00000000-0000-0000-0000-000000000103');
-- Receita vazia legada: a gravação atual exige ingredientes.
insert into public.products(id,name,category,presentation,price_cents)
values('00000000-0000-0000-0000-000000000801','Produto legado vazio','Doces','50 g',100);
insert into public.recipes(name,product_id,product_label,yield_quantity,last_request,output_quantity,output_unit)
values('Receita legada vazia','00000000-0000-0000-0000-000000000801','Produto legado vazio',1,gen_random_uuid(),1,'un');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000101','role','authenticated','session_id','00000000-0000-0000-0000-000000000101')::text,true);
do $$
declare mid uuid; bag uuid; pid uuid; rid uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); data jsonb; idx integer; missing_ids jsonb:='[]'; other_pid uuid;
begin
 insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Milho resultado teste',1,'kg',2000) returning id into mid;
 insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Saco resultado teste',100,'un',5000) returning id into bag;
 insert into public.products(name,category,presentation,price_cents,weight_grams) values('Produto resultado teste','Doces','50 g',1000,50) returning id into pid;
 perform public.save_recipe(rid,0,gen_random_uuid(),'Receita resultado teste',null,1,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','kg')),1,'kg',null,'weight',
  jsonb_build_array(jsonb_build_object('product_id',pid,'packaging',jsonb_build_array(jsonb_build_object('material_id',bag,'quantity',1,'unit','un')))));
 perform public.create_sale(gen_random_uuid(),'Resultado teste','2022-05-15',100,'pix','',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2,'unit_price_cents',1000)));
 perform public.save_expense(eid,0,req,' Energia teste ',' Operacionais ','2022-05-01',500,' Competência ');
 perform public.save_expense(eid,0,req,'Repetição ignorada','','2022-06-01',900,'');
 if not exists(select 1 from public.expenses where id=eid and description='Energia teste' and category='Operacionais' and amount_cents=500 and revision=1 and notes='Competência') then raise exception 'Despesa não normalizada ou duplicada'; end if;
 perform public.save_expense(gen_random_uuid(),0,gen_random_uuid(),'Fora do período','','2022-06-01',900,'');
 data:=public.dashboard_summary('2022-05-01','2022-05-31');
 if (data->>'revenue_cents')::numeric<>2000 or (data->>'received_cents')::numeric<>100
  or (data->>'estimated_cost_cents')::numeric<>300 or (data->>'estimated_gross_profit_cents')::numeric<>1700
  or (data->>'estimated_gross_margin_cents')::numeric<>1700 or (data->>'estimated_gross_margin_percent')::numeric<>85
  or (data->>'expense_cents')::numeric<>500 or (data->>'expense_count')::integer<>1
  or (data->>'estimated_net_profit_cents')::numeric<>1200 or (data->>'estimated_net_margin_percent')::numeric<>60
  or (data->>'costed_revenue_cents')::numeric<>2000 or (data->>'uncovered_revenue_cents')::numeric<>0 then raise exception 'Lucro, margem, embalagem, competência ou recebimento incorreto: %',data; end if;
 perform public.save_expense(eid,1,gen_random_uuid(),'Energia teste','Operacionais','2022-05-01',700,'');
 begin perform public.save_expense(eid,1,gen_random_uuid(),'Sobrescrita indevida','','2022-05-01',800,''); raise exception 'Ignorou versão da despesa' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 if not exists(select 1 from public.expenses where id=eid and revision=2 and amount_cents=700) then raise exception 'Revisão incorreta'; end if;
 data:=public.dashboard_summary('2022-05-01','2022-05-31');
 if (data->>'estimated_net_profit_cents')::numeric<>1000 then raise exception 'Não recalculou despesa'; end if;
 update public.materials set price_cents=20000 where id=mid;
 data:=public.dashboard_summary('2022-05-01','2022-05-31');
 if (data->>'estimated_gross_profit_cents')::numeric<>-100 or (data->>'estimated_net_profit_cents')::numeric<>-800
  or (data->>'estimated_gross_margin_percent')::numeric<>-5 or (data->>'estimated_net_margin_percent')::numeric<>-40 then raise exception 'Prejuízo incorreto: %',data; end if;
 update public.products set price_cents=0 where id=pid;
 perform public.create_sale(gen_random_uuid(),'Venda gratuita teste','2022-08-15',0,'pending','',jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',1,'unit_price_cents',0)));
 update public.products set price_cents=1000 where id=pid;
 data:=public.dashboard_summary('2022-08-01','2022-08-31');
 if data->'estimated_gross_margin_percent'<>'null'::jsonb or data->'estimated_net_margin_percent'<>'null'::jsonb or (data->>'estimated_net_profit_cents')::numeric<>-1050 then raise exception 'Divisão por zero ou venda gratuita incorreta'; end if;
 data:=public.dashboard_summary('2022-06-01','2022-06-30');
 if (data->>'estimated_net_profit_cents')::numeric<>-900 or (data->>'estimated_gross_profit_cents')::numeric<>0 or data->'estimated_net_margin_percent'<>'null'::jsonb then raise exception 'Despesa sem venda desapareceu'; end if;
 data:=public.dashboard_summary('2022-04-01','2022-04-30');
 if data->'estimated_net_profit_cents'<>'null'::jsonb or (data->>'expense_cents')::numeric<>0 then raise exception 'Período vazio inventou resultado'; end if;
 perform public.create_sale(gen_random_uuid(),'Legado vazio teste','2022-03-01',0,'pending','',jsonb_build_array(jsonb_build_object('product_id','00000000-0000-0000-0000-000000000801','quantity',1,'unit_price_cents',100)));
 data:=public.dashboard_cost_issues('2022-03-01','2022-03-31',1,10,'name',true,'empty_recipe');
 if (data->>'total')::integer<>1 then raise exception 'Receita vazia sem diagnóstico'; end if;
 perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Alternativa ao legado vazio','00000000-0000-0000-0000-000000000801',1,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','g')));
 data:=public.dashboard_summary('2022-03-01','2022-03-31');
 if (data->>'ambiguous_units')::integer<>1 or (data->>'missing_units')::integer<>0 or (data->>'costed_units')::integer<>0 then raise exception 'Receita vazia e ambiguidade contadas duas vezes'; end if;
 -- Produtos sem receita não entram como custo zero, nem permitem lucro global.
 for idx in 1..12 loop
  insert into public.products(name,category,presentation,price_cents) values('Pendência '||lpad(idx::text,2,'0'),'Doces','100 g',100) returning id into other_pid;
  missing_ids:=missing_ids||jsonb_build_array(jsonb_build_object('product_id',other_pid,'quantity',1,'unit_price_cents',100));
 end loop;
 perform public.create_sale(gen_random_uuid(),'Pendências teste','2022-05-20',0,'pending','',missing_ids);
 data:=public.dashboard_summary('2022-05-01','2022-05-31');
 if (data->>'missing_units')::integer<>12 or (data->>'costed_units')::integer<>2 or (data->>'uncovered_revenue_cents')::integer<>1200
  or data->'estimated_gross_profit_cents'<>'null'::jsonb or data->'estimated_net_profit_cents'<>'null'::jsonb then raise exception 'Lucro com custo parcial indevido'; end if;
 data:=public.dashboard_cost_issues('2022-05-01','2022-05-31',2,10,'name',true,'all');
 if (data->>'total')::integer<>12 or jsonb_array_length(data->'rows')<>2 or data->'rows'->0->>'name'<>'Pendência 11' then raise exception 'Pendências não paginadas/ordenadas'; end if;
 delete from public.products where id=other_pid;
 data:=public.dashboard_cost_issues('2022-05-01','2022-05-31',1,10,'quantity',false,'removed_product');
 if (data->>'total')::integer<>1 or data->'rows'->0->>'name'<>'Pendência 12' then raise exception 'Produto removido sem diagnóstico'; end if;
 -- Dois vínculos devem ter um único motivo: ambiguidade.
 perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Alternativa teste',pid,1,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','g')));
 data:=public.dashboard_summary('2022-05-01','2022-05-31');
 if (data->>'ambiguous_units')::integer<>2 or (data->>'units')::integer<>(data->>'costed_units')::integer+(data->>'missing_units')::integer+(data->>'ambiguous_units')::integer then raise exception 'Cobertura sobreposta'; end if;
 data:=public.dashboard_cost_issues('2022-05-01','2022-05-31',1,10,'name',true,'multiple_recipes');
 if (data->>'total')::integer<>1 or (data->'rows'->0->>'quantity')::integer<>2 then raise exception 'Ambiguidade sem diagnóstico'; end if;
 for idx in 1..12 loop
  perform public.save_expense(gen_random_uuid(),0,gen_random_uuid(),'Energia '||lpad(idx::text,2,'0'),'Operação','2022-07-01',100,'');
 end loop;
 data:=public.expenses_page('2022-07-01','2022-07-31',2,10,'description',true,'ENERGIA','operacao');
 if (data->>'total')::integer<>12 or (data->>'amount_cents')::integer<>1200 or jsonb_array_length(data->'rows')<>2 or data->'rows'->0->>'description'<>'Energia 11' then raise exception 'Filtros, total e paginação das despesas incorretos'; end if;
 begin perform public.expenses_page('2022-07-01','2022-07-31',1,999,'description',true,'',''); raise exception 'Página sem limite' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin perform public.dashboard_cost_issues('2022-05-01','2022-05-31',1,10,'id;drop table',true,'all'); raise exception 'Ordenação arbitrária' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin perform public.save_expense(gen_random_uuid(),0,gen_random_uuid(),'Inválida','','2022-05-01',0,''); raise exception 'Aceitou valor zero' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin update public.expenses set amount_cents=1 where id=eid; raise exception 'Escrita direta de despesas' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 delete from public.expenses where id=eid and revision=2;
 if exists(select 1 from public.expenses where id=eid) then raise exception 'Não removeu despesa'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated','session_id','00000000-0000-0000-0000-000000000102')::text,true);
do $$ begin
 if exists(select 1 from public.expenses) or exists(select 1 from public.dashboard_cost_items) then raise exception 'Dados expostos a membro'; end if;
 begin perform public.save_expense(gen_random_uuid(),0,gen_random_uuid(),'Indevida','','2022-05-01',100,''); raise exception 'Membro gravou despesa' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.expenses_page('2022-05-01','2022-05-31',1,10,'description',true,'',''); raise exception 'Membro listou despesas' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.dashboard_cost_issues('2022-05-01','2022-05-31',1,10,'name',true,'all'); raise exception 'Membro acessou pendências' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000103','role','authenticated','session_id','00000000-0000-0000-0000-000000000103')::text,true);
do $$ begin
 begin perform public.save_expense(gen_random_uuid(),0,gen_random_uuid(),'Indevida','','2022-05-01',100,''); raise exception 'Não confirmado gravou despesa' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.expenses; raise exception 'Despesas expostas a anônimo' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform * from public.dashboard_cost_items; raise exception 'Pendências expostas a anônimo' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
