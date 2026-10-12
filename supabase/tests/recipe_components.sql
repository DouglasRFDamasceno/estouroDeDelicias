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
  mid uuid; pid uuid;
  base uuid:=gen_random_uuid(); strawberry uuid:=gen_random_uuid(); topping uuid:=gen_random_uuid();
  fraction uuid:=gen_random_uuid(); multiple uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid(); rev integer; data jsonb; material_items jsonb; base_items jsonb;
begin
  insert into public.materials(name,purchase_quantity,purchase_unit,price_cents)
    values('Milho teste composição',1,'kg',2000) returning id into mid;
  insert into public.products(name,category,presentation,price_cents)
    values('Morango teste composição','Doces','100 g',1000) returning id into pid;
  material_items:=jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','kg'));
  perform public.save_recipe(base,0,gen_random_uuid(),'Caramelizada teste composição',null,1,'',material_items,1,'kg');
  if not exists(select 1 from public.recipe_costs where id=base and product_id is null and total_cents=2000 and output_quantity=1 and output_unit='kg') then
    raise exception 'Base sem produto ou rendimento incorreto';
  end if;
  base_items:=jsonb_build_array(
    jsonb_build_object('component_recipe_id',base,'quantity',300,'unit','g'),
    jsonb_build_object('material_id',mid,'quantity',100,'unit','g'));
  perform public.save_recipe(strawberry,0,req,'Morango teste composição',pid,8,'',base_items,800,'g');
  perform public.save_recipe(strawberry,0,req,'Morango teste composição',pid,8,'',base_items,800,'g');
  if not exists(select 1 from public.recipe_costs where id=strawberry and total_cents=800 and unit_cost_cents=100)
    or (select count(*) from public.recipe_items where recipe_id=strawberry)<>2 then
    raise exception 'Custo proporcional, mistura de insumo/base ou idempotência incorretos';
  end if;
  perform public.save_recipe(topping,0,gen_random_uuid(),'Cobertura teste composição',null,1,'',jsonb_build_array(
    jsonb_build_object('component_recipe_id',strawberry,'quantity',0.4,'unit','kg'),
    jsonb_build_object('component_recipe_id',base,'quantity',100,'unit','g')),1,'kg');
  if not exists(select 1 from public.recipe_costs where id=topping and total_cents=600) then
    raise exception 'Custo em vários níveis ou base compartilhada incorreto';
  end if;
  perform public.create_sale(gen_random_uuid(),'Cliente composição','2021-04-15',0,'pending','',
    jsonb_build_array(jsonb_build_object('product_id',pid,'quantity',2,'unit_price_cents',1000)));
  data:=public.dashboard_summary('2021-04-15','2021-04-15');
  if (data->>'estimated_cost_cents')::numeric<>200 or (data->>'costed_units')::int<>2 then
    raise exception 'Dashboard ignorou receita base: %',data;
  end if;
  update public.materials set price_cents=4000 where id=mid;
  if not exists(select 1 from public.recipe_costs where id=strawberry and total_cents=1600)
    or not exists(select 1 from public.recipe_costs where id=topping and total_cents=1200) then
    raise exception 'Não propagou preço em todos os níveis';
  end if;
  data:=public.dashboard_summary('2021-04-15','2021-04-15');
  if (data->>'estimated_cost_cents')::numeric<>400 then raise exception 'Dashboard não recalculou base'; end if;
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Caramelizada teste composição',null,1,'',material_items,2,'kg');
  if not exists(select 1 from public.recipe_costs where id=strawberry and total_cents=1000)
    or not exists(select 1 from public.recipe_costs where id=topping and total_cents=700) then
    raise exception 'Não propagou alteração do rendimento';
  end if;
  select revision into rev from public.recipes where id=base;
  begin
    perform public.save_recipe(base,rev,gen_random_uuid(),'Ciclo indevido',null,1,'',
      jsonb_build_array(jsonb_build_object('component_recipe_id',topping,'quantity',1,'unit','kg')),2,'kg');
    raise exception 'Aceitou ciclo indireto' using errcode='ZX001';
  exception when sqlstate 'P0001' then
    if sqlerrm not like 'Vínculo circular:%' then raise; end if;
  end;
  if not exists(select 1 from public.recipe_costs where id=base and revision=rev and total_cents=4000)
    or not exists(select 1 from public.recipe_costs where id=topping and total_cents=700) then
    raise exception 'Falha não reverteu receita e vínculos';
  end if;
  begin
    perform public.save_recipe(base,rev,gen_random_uuid(),'Ciclo direto',null,1,'',
      jsonb_build_array(jsonb_build_object('component_recipe_id',base,'quantity',1,'unit','kg')),2,'kg');
    raise exception 'Aceitou autorreferência' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.save_recipe(base,rev,gen_random_uuid(),'Mudança incompatível',null,1,'',material_items,2,'l');
    raise exception 'Alterou família de base usada' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin delete from public.recipes where id=base;
    raise exception 'Excluiu base usada' using errcode='ZX001';
  exception when foreign_key_violation or restrict_violation then null; end;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Unidade incompatível',null,1,'',
      jsonb_build_array(jsonb_build_object('component_recipe_id',base,'quantity',1,'unit','ml')),1,'kg');
    raise exception 'Aceitou consumo incompatível' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Base repetida',null,1,'',
      jsonb_build_array(jsonb_build_object('component_recipe_id',base,'quantity',1,'unit','kg'),
        jsonb_build_object('component_recipe_id',base,'quantity',2,'unit','kg')),1,'kg');
    raise exception 'Aceitou base repetida' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Fonte ambígua',null,1,'',
      jsonb_build_array(jsonb_build_object('component_recipe_id',base,'material_id',mid,'quantity',1,'unit','kg')),1,'kg');
    raise exception 'Aceitou duas fontes no item' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Limite indevido',null,1,'',
      (select jsonb_agg(jsonb_build_object('component_recipe_id',base,'quantity',1,'unit','kg')) from generate_series(1,51)),1,'kg');
    raise exception 'Aceitou mais de 50 componentes' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  begin
    update public.recipes set output_quantity=99 where id=base;
    raise exception 'Permitiu escrita direta do rendimento' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
  begin
    insert into public.recipe_items(recipe_id,component_recipe_id,quantity,unit) values(base,topping,1,'kg');
    raise exception 'Permitiu escrita direta de vínculos' using errcode='ZX001';
  exception when insufficient_privilege then null; end;

  -- 1/3 de centavo precisa chegar a 1 centavo ao consumir três preparações.
  insert into public.materials(name,purchase_quantity,purchase_unit,price_cents)
    values('Fração teste composição',3,'un',1) returning id into mid;
  perform public.save_recipe(fraction,0,gen_random_uuid(),'Base fracionária',null,1,'',
    jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','un')),1,'un');
  perform public.save_recipe(multiple,0,gen_random_uuid(),'Múltiplo fracionário',null,1,'',
    jsonb_build_array(jsonb_build_object('component_recipe_id',fraction,'quantity',3,'unit','un')),1,'un');
  if not exists(select 1 from public.recipe_costs where id=fraction and total_cents=0 and raw_total_cents>0)
    or not exists(select 1 from public.recipe_costs where id=multiple and total_cents=1) then
    raise exception 'Arredondou custo intermediário';
  end if;
  delete from public.recipes where id=multiple;
  if exists(select 1 from public.recipe_items where recipe_id=multiple) then raise exception 'Itens órfãos'; end if;
  delete from public.recipes where id=fraction;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated','session_id','00000000-0000-0000-0000-000000000102')::text,true);
do $$ begin
  if exists(select 1 from public.recipe_items) or exists(select 1 from public.recipe_costs) then raise exception 'Composição exposta ao membro'; end if;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg');
    raise exception 'Membro criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000103','role','authenticated','session_id','00000000-0000-0000-0000-000000000103')::text,true);
do $$ begin
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg');
    raise exception 'Não confirmado criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.recipe_costs;
    raise exception 'Composição exposta ao anônimo' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
