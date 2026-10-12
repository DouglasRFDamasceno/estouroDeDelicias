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
  mid uuid; pid uuid; base uuid:=gen_random_uuid(); linked uuid:=gen_random_uuid();
  req uuid:=gen_random_uuid(); rev integer; items jsonb;
begin
  insert into public.materials(name,purchase_quantity,purchase_unit,price_cents)
    values('Milho categoria teste',1,'kg',2000) returning id into mid;
  insert into public.products(name,category,presentation,price_cents)
    values('Produto categoria teste','Doces categoria teste','100 g',1000) returning id into pid;
  items:=jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',1,'unit','kg'));
  perform public.save_recipe(linked,0,gen_random_uuid(),'Receita vinculada teste',pid,10,'',items,1,'kg','Ignorar divergência');
  if not exists(select 1 from public.recipe_costs where id=linked and category='Doces categoria teste'
    and base_category is null and total_cents=2000 and unit_cost_cents=200) then
    raise exception 'Categoria vinculada divergente ou custo alterado';
  end if;
  perform public.save_recipe(base,0,req,'Base categoria teste',null,1,'',items,1,'kg','Doces categoria teste');
  perform public.save_recipe(base,0,req,'Repetição ignorada',null,1,'',items,1,'kg',null);
  if not exists(select 1 from public.recipe_costs where id=base and category='Doces categoria teste'
    and base_category=category and revision=1) then
    raise exception 'Categoria base ou idempotência incorreta';
  end if;
  if (select count(*) from public.recipe_categories where category='Doces categoria teste')<>1
    or (select count(*) from public.recipe_costs where category='Doces categoria teste')<>2 then
    raise exception 'Categorias duplicadas ou filtro incorreto';
  end if;
  update public.products set category='Clássicas categoria teste' where id=pid;
  if not exists(select 1 from public.recipe_costs where id=linked and category='Clássicas categoria teste')
    or not exists(select 1 from public.recipe_costs where id=base and category='Doces categoria teste')
    or not exists(select 1 from public.recipe_categories c where public.category_search(c)='classicas categoria teste') then
    raise exception 'Categoria não acompanhou produto, base perdeu categoria ou busca com acento falhou';
  end if;
  -- Base mantém sua categoria mesmo que nenhum produto a utilize mais.
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Base editada antiga',null,1,'',items,1,'kg');
  if not exists(select 1 from public.recipe_costs where id=base and category='Doces categoria teste' and revision=rev+1) then
    raise exception 'Cliente anterior perdeu categoria ou incrementou versão duas vezes';
  end if;
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Base editada mais antiga',null,1,'',items);
  if not exists(select 1 from public.recipe_costs where id=base and category='Doces categoria teste' and revision=rev+1) then
    raise exception 'Assinatura original perdeu categoria';
  end if;
  select revision into rev from public.recipes where id=base;
  begin
    perform public.save_recipe(base,rev,gen_random_uuid(),'Categoria inexistente',null,1,'',items,1,'kg','Categoria não cadastrada');
    raise exception 'Aceitou categoria inexistente' using errcode='ZX001';
  exception when sqlstate 'P0001' then null; end;
  if not exists(select 1 from public.recipe_costs where id=base and category='Doces categoria teste' and revision=rev) then
    raise exception 'Falha não reverteu alteração';
  end if;
  begin
    update public.recipes set base_category='Clássicas categoria teste' where id=base;
    raise exception 'Permitiu escrita direta de categoria' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
  -- Remover classificação, escolher outra, vincular e desvincular sem duplicar categoria.
  perform public.save_recipe(base,rev,gen_random_uuid(),'Base sem categoria',null,1,'',items,1,'kg',null);
  if not exists(select 1 from public.recipe_costs where id=base and category is null and base_category is null) then
    raise exception 'Não removeu categoria';
  end if;
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Base reclassificada',null,1,'',items,1,'kg','Clássicas categoria teste');
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Base virou produto',pid,10,'',items,1,'kg','Doces categoria teste');
  if not exists(select 1 from public.recipe_costs where id=base and category='Clássicas categoria teste' and base_category is null) then
    raise exception 'Vinculação deixou categoria independente';
  end if;
  select revision into rev from public.recipes where id=base;
  perform public.save_recipe(base,rev,gen_random_uuid(),'Produto virou base',null,1,'',items,1,'kg','Clássicas categoria teste');
  if not exists(select 1 from public.recipe_costs where id=base and product_id is null and category='Clássicas categoria teste') then
    raise exception 'Desvinculação perdeu categoria selecionada';
  end if;
  delete from public.products where id=pid;
  if not exists(select 1 from public.recipe_costs where id=linked and product_id is null and category is null and total_cents=2000) then
    raise exception 'Remover produto quebrou receita';
  end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000102',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000102','role','authenticated','session_id','00000000-0000-0000-0000-000000000102')::text,true);
do $$ begin
  if exists(select 1 from public.recipe_items) or exists(select 1 from public.recipe_costs) or exists(select 1 from public.recipe_categories where category='Clássicas categoria teste') then raise exception 'Composição exposta ao membro'; end if;
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg','Clássicas categoria teste');
    raise exception 'Membro criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000103',true);
select set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000103','role','authenticated','session_id','00000000-0000-0000-0000-000000000103')::text,true);
do $$ begin
  begin
    perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,1,'','[]',1,'kg','Clássicas categoria teste');
    raise exception 'Não confirmado criou composição' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
  begin perform * from public.recipe_categories;
    raise exception 'Composição exposta ao anônimo' using errcode='ZX001';
  exception when insufficient_privilege then null; end;
end $$;
rollback;
