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
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000101',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000101','role','authenticated','session_id','00000000-0000-0000-0000-000000000101')::text,true);
do $$
declare
  mid uuid; bag uuid; pid uuid; p50 uuid; p100 uuid; p150 uuid;
  rid uuid:=gen_random_uuid(); base uuid:=gen_random_uuid(); dependent uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid(); rev integer; items jsonb; presentations jsonb; data jsonb;
begin
  if not exists(select 1 from public.products where presentation='50 g' and weight_grams=50) then
    raise exception 'Não converteu peso explícito do catálogo existente';
  end if;
  insert into public.materials(name,category,purchase_quantity,purchase_unit,price_cents)
    values('Milho apresentações teste','Ingredientes',1,'kg',2000) returning id into mid;
  insert into public.materials(name,category,purchase_quantity,purchase_unit,price_cents)
    values('Saco apresentações teste','Embalagens',100,'un',5000) returning id into bag;
  if not exists(select 1 from public.materials m where id=bag and public.category_search(m)='embalagens') then
    raise exception 'Busca por categoria de insumo indisponível'; end if;
  insert into public.products(name,category,presentation,price_cents,weight_grams)
    values('Pipoca apresentações teste','Doces','50 g',500,50) returning id into p50;
  insert into public.products(name,category,presentation,price_cents,weight_grams)
    values('Pipoca apresentações teste','Doces','100 g',1000,100) returning id into p100;
  insert into public.products(name,category,presentation,price_cents,weight_grams)
    values('Pipoca apresentações teste','Doces','150 g',1500,150) returning id into p150;
  items:=jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','kg'));
  presentations:=jsonb_build_array(
    jsonb_build_object('product_id',p50,'packaging',jsonb_build_array(jsonb_build_object('material_id',bag,'quantity',1,'unit','un'))),
    jsonb_build_object('product_id',p100,'packaging',jsonb_build_array(jsonb_build_object('material_id',bag,'quantity',1.6,'unit','un'))),
    jsonb_build_object('product_id',p150,'packaging',jsonb_build_array(jsonb_build_object('material_id',bag,'quantity',2,'unit','un'))));
  perform public.save_recipe(rid,0,req,'Morango apresentações teste',null,1,'',items,1,'kg',null,'weight',presentations);
  perform public.save_recipe(rid,0,req,'Repetição ignorada',null,1,'',items,1,'kg',null,'weight','[]');
  if not exists(select 1 from public.recipe_costs where id=rid and total_cents=2000 and unit_cost_cents is null and cost_mode='weight' and revision=1 and presentation_count=3 and product_id=p50 and category='Doces')
    or not exists(select 1 from public.recipe_presentations where recipe_id=rid and product_id=p100 and position=1)
    or not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p50 and ingredient_cents=100 and packaging_cents=50 and raw_unit_cost_cents=150)
    or not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p100 and raw_unit_cost_cents=280)
    or not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p150 and raw_unit_cost_cents=400) then
    raise exception 'Custo proporcional, embalagem inteira, ordem ou idempotência incorretos';
  end if;
  -- Frações de centavo permanecem no banco; perder o produto principal não perde as demais apresentações.
  insert into public.products(name,category,presentation,price_cents,weight_grams)
    values('Apresentação principal removida teste','Lembranças','25 g',100,25) returning id into pid;
  perform public.save_recipe(base,0,gen_random_uuid(),'Precisão apresentações teste',null,1,'',items,3,'kg',null,'weight',
    jsonb_build_array(jsonb_build_object('product_id',pid,'packaging','[]'::jsonb),
      jsonb_build_object('product_id',p100,'packaging',jsonb_build_array(jsonb_build_object('material_id',bag,'quantity',0.001,'unit','un')))));
  if not exists(select 1 from public.recipe_product_costs where recipe_id=base and product_id=p100
    and abs(raw_unit_cost_cents-(2000::numeric*100/3000+0.05))<0.000000000001
    and packaging_cents=0.05 and raw_unit_cost_cents<>round(raw_unit_cost_cents,0)) then
    raise exception 'Arredondamento intermediário nas apresentações'; end if;
  delete from public.products where id=pid;
  if not exists(select 1 from public.recipe_costs where id=base and product_id is null and category='Doces' and presentation_count=1)
    or not exists(select 1 from public.recipe_packaging where recipe_id=base and product_id=p100) then
    raise exception 'Exclusão do produto principal perdeu outra apresentação, categoria ou embalagem'; end if;
  delete from public.recipes where id=base;
  -- Uma receita usada como base transmite apenas o custo da preparação, sem os pacotes.
  perform public.save_recipe(dependent,0,gen_random_uuid(),'Outra preparação teste',null,1,'',
    jsonb_build_array(jsonb_build_object('component_recipe_id',rid,'quantity',300,'unit','g')),300,'g',null,'weight','[]');
  if not exists(select 1 from public.recipe_costs where id=dependent and total_cents=600) then
    raise exception 'Embalagem contaminou custo da base'; end if;
  perform public.create_sale(gen_random_uuid(),'Cliente apresentações','2021-05-15',0,'pending','',
    jsonb_build_array(jsonb_build_object('product_id',p50,'quantity',1,'unit_price_cents',500),
      jsonb_build_object('product_id',p100,'quantity',2,'unit_price_cents',1000),
      jsonb_build_object('product_id',p150,'quantity',3,'unit_price_cents',1500)));
  data:=public.dashboard_summary('2021-05-15','2021-05-15');
  if (data->>'estimated_cost_cents')::numeric<>1910 or (data->>'costed_units')::integer<>6 then
    raise exception 'Indicadores não usam apresentações e embalagens: %',data; end if;
  update public.materials set price_cents=4000 where id=mid;
  if not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p50 and ingredient_cents=200 and packaging_cents=50 and raw_unit_cost_cents=250) then
    raise exception 'Recalcular insumo alterou proporcionalidade da embalagem'; end if;
  update public.products set weight_grams=60 where id=p50;
  if not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p50 and raw_unit_cost_cents=290) then
    raise exception 'Alteração do peso não recalculou custo'; end if;
  begin update public.products set weight_grams=null where id=p50;
    raise exception 'Limpou peso em uso' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin update public.materials set purchase_unit='kg' where id=bag;
    raise exception 'Alterou família de unidade da embalagem em uso' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin delete from public.materials where id=bag;
    raise exception 'Excluiu embalagem em uso' using errcode='ZX001';
  exception when foreign_key_violation or restrict_violation then null; end;
  begin insert into public.recipe_presentations(recipe_id,product_id,position) values(base,p50,0);
    raise exception 'Escrita direta de apresentações' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
  begin insert into public.recipe_packaging(recipe_id,product_id,material_id,quantity,unit) values(rid,p50,mid,1,'kg');
    raise exception 'Escrita direta de embalagens' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
  select revision into rev from public.recipes where id=rid;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Excesso apresentações',null,1,'',items,1,'kg',null,'weight',
    (select jsonb_agg(presentations->0) from generate_series(1,51)));
    raise exception 'Aceitou mais de 50 apresentações' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Excesso embalagens',null,1,'',items,1,'kg',null,'weight',
    jsonb_build_array(jsonb_build_object('product_id',p50,'packaging',
      (select jsonb_agg(jsonb_build_object('material_id',bag,'quantity',1,'unit','un')) from generate_series(1,11)))));
    raise exception 'Aceitou mais de 10 embalagens' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Cliente antigo indevido',p50,10,'',items,1,'kg',null);
    raise exception 'Cliente antigo apagou apresentações' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Unidade incompatível',null,1,'',items,1,'l',null,'weight',presentations);
    raise exception 'Aceitou peso com volume' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Duplicado indevido',null,1,'',items,1,'kg',null,'weight',jsonb_build_array(presentations->0,presentations->0));
    raise exception 'Aceitou apresentação duplicada' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  insert into public.products(name,category,presentation,price_cents) values('Produto sem peso teste','Doces','Cone',100) returning id into pid;
  begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Sem peso indevido',null,1,'',items,1,'kg',null,'weight',jsonb_build_array(jsonb_build_object('product_id',pid,'packaging','[]'::jsonb)));
    raise exception 'Aceitou produto sem peso' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  if not exists(select 1 from public.recipe_costs where id=rid and revision=rev and presentation_count=3) then
    raise exception 'Falha não reverteu composição'; end if;
  -- Atualização única de versão; exclusões de apresentação removem também as embalagens.
  perform public.save_recipe(rid,rev,gen_random_uuid(),'Rendimento editado',null,1,'',items,2,'kg',null,'weight',jsonb_build_array(presentations->0));
  if not exists(select 1 from public.recipe_costs where id=rid and revision=rev+1 and presentation_count=1)
    or not exists(select 1 from public.recipe_product_costs where recipe_id=rid and product_id=p50 and ingredient_cents=120 and packaging_cents=50 and raw_unit_cost_cents=170)
    or exists(select 1 from public.recipe_packaging where recipe_id=rid and product_id=p100) then
    raise exception 'Rendimento, versão ou limpeza de embalagens incorretos'; end if;
  delete from public.products where id=p50;
  if exists(select 1 from public.recipe_presentations where recipe_id=rid)
    or exists(select 1 from public.recipe_packaging where recipe_id=rid)
    or not exists(select 1 from public.recipe_costs where id=rid and total_cents=4000) then
    raise exception 'Remover produto não preservou preparação'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated','session_id','00000000-0000-0000-0000-000000000102')::text,true);
do $$ begin
  if exists(select 1 from public.recipe_presentations) or exists(select 1 from public.recipe_packaging) or exists(select 1 from public.recipe_product_costs) or exists(select 1 from public.recipe_costs) then raise exception 'Composição exposta ao membro'; end if;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg',null,'weight','[]');
    raise exception 'Membro criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000103','role','authenticated','session_id','00000000-0000-0000-0000-000000000103')::text,true);
do $$ begin
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg',null,'weight','[]');
    raise exception 'Não confirmado criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.recipe_product_costs;
    raise exception 'Composição exposta ao anônimo' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
