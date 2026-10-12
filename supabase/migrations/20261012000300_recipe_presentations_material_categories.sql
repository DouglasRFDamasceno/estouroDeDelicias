begin;

alter table public.materials add column category text not null default ''
  check (category=btrim(category) and (category='' or length(category) between 2 and 80));
grant insert(category),update(category) on public.materials to authenticated;
create function public.category_search(public.materials)
returns text language sql immutable strict parallel safe security invoker set search_path='' as $$
  select public.normalize_search(($1).category);
$$;
revoke all on function public.category_search(public.materials) from public,anon;
grant execute on function public.category_search(public.materials) to authenticated,service_role;

alter table public.products add column weight_grams numeric(14,3)
  check (weight_grams>0 and weight_grams<=10000000);
grant insert(weight_grams),update(weight_grams) on public.products to authenticated;
-- Só rótulos exclusivamente numéricos com unidade explícita são convertidos.
-- Outros formatos permanecem sem peso para preenchimento manual.
update public.products set weight_grams=
  replace((regexp_match(btrim(presentation),'^([0-9]{1,7}([.,][0-9]{1,3})?)\s*(g|kg)$','i'))[1],',','.')::numeric
  * case when btrim(presentation) ~* 'kg$' then 1000 else 1 end
where btrim(presentation) ~* '^[0-9]{1,7}([.,][0-9]{1,3})?\s*(g|kg)$'
  and replace((regexp_match(btrim(presentation),'^([0-9]{1,7}([.,][0-9]{1,3})?)\s*(g|kg)$','i'))[1],',','.')::numeric
    * case when btrim(presentation) ~* 'kg$' then 1000 else 1 end > 0
  and replace((regexp_match(btrim(presentation),'^([0-9]{1,7}([.,][0-9]{1,3})?)\s*(g|kg)$','i'))[1],',','.')::numeric
    * case when btrim(presentation) ~* 'kg$' then 1000 else 1 end <= 10000000;

alter table public.recipes add column cost_mode text not null default 'units' check(cost_mode in ('units','weight'));
create table public.recipe_presentations (
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position smallint not null check(position between 0 and 49),
  unique(recipe_id,position),
  primary key(recipe_id,product_id)
);
create index recipe_presentations_product_idx on public.recipe_presentations(product_id);
create table public.recipe_packaging (
  recipe_id uuid not null,
  product_id uuid not null,
  material_id uuid not null references public.materials(id) on delete restrict,
  quantity numeric(14,3) not null check(quantity>0 and quantity<=10000000),
  unit text not null check(unit in ('g','kg','ml','l','un')),
  primary key(recipe_id,product_id,material_id),
  foreign key(recipe_id,product_id) references public.recipe_presentations(recipe_id,product_id) on delete cascade
);
create index recipe_packaging_material_idx on public.recipe_packaging(material_id);
alter table public.recipe_presentations enable row level security;
alter table public.recipe_presentations force row level security;
alter table public.recipe_packaging enable row level security;
alter table public.recipe_packaging force row level security;
revoke all on public.recipe_presentations,public.recipe_packaging from public,anon,authenticated;
grant select on public.recipe_presentations,public.recipe_packaging to authenticated;
grant all on public.recipe_presentations,public.recipe_packaging to service_role;
create policy recipe_presentations_admin_read on public.recipe_presentations for select to authenticated
using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
create policy recipe_packaging_admin_read on public.recipe_packaging for select to authenticated
using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));

create function private.validate_product_weight() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.weight_grams is null and exists(select 1 from public.recipe_presentations where product_id=old.id) then
    raise exception 'Este produto usa uma receita por peso. Remova o vínculo da receita antes de limpar o peso.';
  end if;
  return new;
end $$;
revoke all on function private.validate_product_weight() from public,anon,authenticated;
create trigger products_weight before update on public.products for each row execute function private.validate_product_weight();

create or replace function private.validate_material_unit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.recipe_items where material_id=old.id and
 (case unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
 (case new.purchase_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end))
 or exists(select 1 from public.recipe_packaging where material_id=old.id and
 (case unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
 (case new.purchase_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end))
 then raise exception 'A unidade deve ser compatível com as receitas e embalagens que usam este insumo.'; end if;
 return new;
end $$;

create or replace view public.recipe_costs with (security_invoker=true) as
with recursive portions(root_id, recipe_id, factor, path) as (
  select id, id, 1::numeric, array[id] from public.recipes
  union all
  select p.root_id, base.id,
    p.factor * i.quantity * (case when i.unit in ('kg','l') then 1000 else 1 end)
      / (base.output_quantity * (case when base.output_unit in ('kg','l') then 1000 else 1 end)),
    p.path || base.id
  from portions p
  join public.recipe_items i on i.recipe_id=p.recipe_id
  join public.recipes base on base.id=i.component_recipe_id
  where not base.id=any(p.path)
), totals as (
  select p.root_id,
    coalesce(sum(p.factor * m.price_cents::numeric * i.quantity
      * (case when i.unit in ('kg','l') then 1000 else 1 end)
      / (m.purchase_quantity * (case when m.purchase_unit in ('kg','l') then 1000 else 1 end))),0) as raw_total_cents
  from portions p
  left join public.recipe_items i on i.recipe_id=p.recipe_id and i.material_id is not null
  left join public.materials m on m.id=i.material_id
  group by p.root_id
)
select r.id,r.name,r.product_id,r.product_label,r.yield_quantity,r.notes,r.revision,r.created_at,
  round(t.raw_total_cents,0) as total_cents,
  case when r.cost_mode='units' then round(t.raw_total_cents/r.yield_quantity,0) else null::numeric end as unit_cost_cents,
  r.output_quantity,r.output_unit,t.raw_total_cents,
  case when r.cost_mode='weight' then coalesce(p.category,(select prod.category from public.recipe_presentations rp join public.products prod on prod.id=rp.product_id where rp.recipe_id=r.id order by rp.position,rp.product_id limit 1),r.base_category)
    when r.product_id is not null then p.category else r.base_category end as category,
  r.base_category,r.cost_mode,
  (select count(*) from public.recipe_presentations rp where rp.recipe_id=r.id) as presentation_count
from public.recipes r join totals t on t.root_id=r.id
left join public.products p on p.id=r.product_id;

-- Custos de venda por apresentação; embalagens não entram no custo da preparação/base.
create view public.recipe_product_costs with (security_invoker=true) as
with packaging as (
  select rp.recipe_id,rp.product_id,
    sum(m.price_cents::numeric*rp.quantity*(case when rp.unit in ('kg','l') then 1000 else 1 end)
      /(m.purchase_quantity*(case when m.purchase_unit in ('kg','l') then 1000 else 1 end))) as cost
  from public.recipe_packaging rp join public.materials m on m.id=rp.material_id group by rp.recipe_id,rp.product_id
)
select c.id as recipe_id,p.id as product_id,
  c.raw_total_cents*p.weight_grams/(c.output_quantity*(case when c.output_unit='kg' then 1000 else 1 end)) as ingredient_cents,
  coalesce(pk.cost,0) as packaging_cents,
  c.raw_total_cents*p.weight_grams/(c.output_quantity*(case when c.output_unit='kg' then 1000 else 1 end))+coalesce(pk.cost,0) as raw_unit_cost_cents
from public.recipe_costs c join public.recipe_presentations rp on rp.recipe_id=c.id
join public.products p on p.id=rp.product_id left join packaging pk on pk.recipe_id=c.id and pk.product_id=p.id
where c.cost_mode='weight'
union all
select c.id,c.product_id,c.raw_total_cents/c.yield_quantity,0::numeric,c.raw_total_cents/c.yield_quantity
from public.recipe_costs c where c.cost_mode='units' and c.product_id is not null;
revoke all on public.recipe_product_costs from public,anon;
grant select on public.recipe_product_costs to authenticated,service_role;

create function public.save_recipe(
  p_id uuid,p_revision integer,p_request_id uuid,p_name text,p_product_id uuid,
  p_yield_quantity integer,p_notes text,p_items jsonb,p_output_quantity numeric,p_output_unit text,p_category text,p_cost_mode text,p_presentations jsonb
) returns uuid language plpgsql security definer set search_path='' as $$
declare
  current_recipe public.recipes%rowtype;
  material public.materials%rowtype;
  base public.recipes%rowtype;
  item jsonb;
  source_id uuid;
  source_unit text;
  source_key text;
  v_product_label text;
  v_category text;
  v_presentation jsonb;
  pack jsonb;
  pack_seen uuid[];
  product_seen uuid[] := '{}';
  selected_product public.products%rowtype;
  seen text[] := '{}';
begin
  if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then
    raise exception 'Acesso negado' using errcode='42501';
  end if;
  if p_id is null or p_request_id is null then raise exception 'Identificador obrigatório'; end if;
  -- Serializa alterações do grafo: duas sessões não podem criar A→B e B→A.
  perform pg_advisory_xact_lock(hashtextextended('public.recipes.components',0));
  select * into current_recipe from public.recipes where id=p_id for update;
  if found then
    if current_recipe.last_request=p_request_id then return p_id; end if;
    if p_revision is null or p_revision<>current_recipe.revision then
      raise exception 'Receita alterada. Feche e abra novamente.';
    end if;
  elsif p_revision is distinct from 0 then raise exception 'Receita não encontrada'; end if;

  if p_cost_mode is null or p_cost_mode not in ('units','weight')
    or p_presentations is null or jsonb_typeof(p_presentations)<>'array' then
    raise exception 'Cálculo ou apresentações inválidos';
  end if;
  if jsonb_array_length(p_presentations)>50 or (p_cost_mode='units' and jsonb_array_length(p_presentations)>0) then
    raise exception 'Selecione até 50 apresentações no cálculo por peso';
  end if;
  if p_cost_mode='weight' then
    p_product_id:=(p_presentations->0->>'product_id')::uuid;
    if jsonb_array_length(p_presentations)>0 and (p_output_unit is null or p_output_unit not in ('g','kg')) then
      raise exception 'Para calcular por peso, informe o rendimento da preparação em g ou kg.';
    end if;
  end if;
  perform id from public.products where id in (
    select (value->>'product_id')::uuid from jsonb_array_elements(p_presentations)
  ) order by id for share;
  perform id from public.materials where id in (
    select (packed.value->>'material_id')::uuid from jsonb_array_elements(p_presentations) p,
      lateral jsonb_array_elements(p->'packaging') packed(value)
  ) order by id for share;
  for v_presentation in select value from jsonb_array_elements(p_presentations) loop
    if jsonb_typeof(v_presentation)<>'object' then raise exception 'Apresentação inválida'; end if;
    select * into selected_product from public.products where id=(v_presentation->>'product_id')::uuid;
    if not found or selected_product.id=any(product_seen) then raise exception 'Produto inválido ou repetido'; end if;
    if selected_product.weight_grams is null then
      raise exception 'Informe o peso líquido em gramas no cadastro do produto: % · %.',selected_product.name,selected_product.presentation;
    end if;
    product_seen:=array_append(product_seen,selected_product.id);
    if v_presentation->'packaging' is null or jsonb_typeof(v_presentation->'packaging')<>'array' then
      raise exception 'Embalagens inválidas';
    end if;
    if jsonb_array_length(v_presentation->'packaging')>10 then raise exception 'Selecione até 10 insumos de embalagem por apresentação'; end if;
    pack_seen:='{}';
    for pack in select value from jsonb_array_elements(v_presentation->'packaging') loop
      if jsonb_typeof(pack)<>'object' then raise exception 'Embalagem inválida'; end if;
      select * into material from public.materials where id=(pack->>'material_id')::uuid;
      if not found or material.id=any(pack_seen) then raise exception 'Embalagem inválida ou repetida'; end if;
      pack_seen:=array_append(pack_seen,material.id);
      if pack->>'quantity' is null or pack->>'quantity' !~ '^[0-9]{1,8}([.][0-9]{1,3})?$'
        or (pack->>'quantity')::numeric<=0 or (pack->>'quantity')::numeric>10000000
        or pack->>'unit' is null or pack->>'unit' not in ('g','kg','ml','l','un') then
        raise exception 'Quantidade ou unidade de embalagem inválida';
      end if;
      if (case pack->>'unit' when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
        (case material.purchase_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end) then
        raise exception 'Unidades de embalagem incompatíveis';
      end if;
    end loop;
  end loop;

  if p_name is null or length(btrim(p_name)) not between 2 and 120
    or p_yield_quantity is null or p_yield_quantity not between 1 and 1000000
    or p_notes is null or length(p_notes)>1000
    or p_output_quantity is null or p_output_quantity<=0 or p_output_quantity>10000000
    or p_output_quantity<>round(p_output_quantity,3)
    or p_output_unit is null or p_output_unit not in ('g','kg','ml','l','un')
    or p_items is null or jsonb_typeof(p_items)<>'array' then
    raise exception 'Dados da receita inválidos';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Selecione de 1 a 50 insumos ou receitas base';
  end if;
  if p_product_id is not null then
    select prod.name||' · '||prod.presentation into v_product_label from public.products prod where prod.id=p_product_id for share;
    if not found then raise exception 'Produto não encontrado'; end if;
  elsif current_recipe.id is not null and current_recipe.product_id is null then
    v_product_label:=current_recipe.product_label;
  else v_product_label:='Receita base'; end if;

  -- Produto vinculado é a fonte da categoria; bases usam as mesmas opções do catálogo.
  if p_product_id is null then
    v_category:=nullif(btrim(p_category),'');
    if v_category is not null and (length(v_category) not between 2 and 80
      or not exists(select 1 from public.recipe_categories where category=v_category)) then
      raise exception 'Selecione uma categoria cadastrada ou deixe em branco.';
    end if;
  end if;

  if exists(select 1 from public.recipe_items where component_recipe_id=p_id and
    (case unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
    (case p_output_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)) then
    raise exception 'O rendimento deve usar unidades compatíveis com as receitas que usam esta base.';
  end if;

  perform id from public.materials where id in (
    select (value->>'material_id')::uuid from jsonb_array_elements(p_items)
  ) order by id for share;
  perform id from public.recipes where id in (
    select (value->>'component_recipe_id')::uuid from jsonb_array_elements(p_items)
  ) order by id for share;
  for item in select value from jsonb_array_elements(p_items) loop
    if jsonb_typeof(item)<>'object' or
      ((item->>'material_id' is not null)::integer + (item->>'component_recipe_id' is not null)::integer)<>1 then
      raise exception 'Selecione um insumo ou uma receita base por item';
    end if;
    if item->>'material_id' is not null then
      select * into material from public.materials where id=(item->>'material_id')::uuid;
      if not found then raise exception 'Insumo não encontrado'; end if;
      source_id:=material.id; source_unit:=material.purchase_unit; source_key:='material:'||source_id;
    else
      select * into base from public.recipes where id=(item->>'component_recipe_id')::uuid;
      if not found then raise exception 'Receita base não encontrada'; end if;
      if base.id=p_id then raise exception 'Uma receita não pode usar ela mesma como base'; end if;
      source_id:=base.id; source_unit:=base.output_unit; source_key:='recipe:'||source_id;
    end if;
    if source_key=any(seen) then raise exception 'Insumo ou receita base repetido'; end if;
    seen:=array_append(seen,source_key);
    if item->>'quantity' is null or item->>'quantity' !~ '^[0-9]{1,8}([.][0-9]{1,3})?$'
      or (item->>'quantity')::numeric<=0 or (item->>'quantity')::numeric>10000000
      or item->>'unit' is null or item->>'unit' not in ('g','kg','ml','l','un') then
      raise exception 'Quantidade ou unidade inválida';
    end if;
    if (case item->>'unit' when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
      (case source_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end) then
      raise exception 'Unidades incompatíveis';
    end if;
  end loop;
  if current_recipe.id is null then
    insert into public.recipes(id,name,product_id,product_label,yield_quantity,notes,last_request,output_quantity,output_unit,base_category,cost_mode)
    values(p_id,btrim(p_name),p_product_id,v_product_label,p_yield_quantity,btrim(p_notes),p_request_id,p_output_quantity,p_output_unit,v_category,p_cost_mode);
  else
    update public.recipes set name=btrim(p_name),product_id=p_product_id,product_label=v_product_label,
      yield_quantity=p_yield_quantity,notes=btrim(p_notes),last_request=p_request_id,
      output_quantity=p_output_quantity,output_unit=p_output_unit,base_category=v_category,cost_mode=p_cost_mode where id=p_id;
    delete from public.recipe_items where recipe_id=p_id;
  end if;
  insert into public.recipe_items(recipe_id,material_id,component_recipe_id,quantity,unit)
    select p_id,(value->>'material_id')::uuid,(value->>'component_recipe_id')::uuid,
      (value->>'quantity')::numeric,value->>'unit' from jsonb_array_elements(p_items);

  if exists(
    with recursive dependencies(id) as (
      select component_recipe_id from public.recipe_items where recipe_id=p_id and component_recipe_id is not null
      union
      select i.component_recipe_id from dependencies d join public.recipe_items i on i.recipe_id=d.id
      where i.component_recipe_id is not null
    ) select 1 from dependencies where id=p_id
  ) then raise exception 'Vínculo circular: esta receita base já depende da receita que você está salvando.'; end if;
  delete from public.recipe_presentations where recipe_id=p_id;
  for v_presentation in select value from jsonb_array_elements(p_presentations) loop
    insert into public.recipe_presentations(recipe_id,product_id,position)
      values(p_id,(v_presentation->>'product_id')::uuid,array_position(product_seen,(v_presentation->>'product_id')::uuid)-1);
    insert into public.recipe_packaging(recipe_id,product_id,material_id,quantity,unit)
      select p_id,(v_presentation->>'product_id')::uuid,(value->>'material_id')::uuid,
        (value->>'quantity')::numeric,value->>'unit' from jsonb_array_elements(v_presentation->'packaging');
  end loop;
  return p_id;
end $$;
revoke all on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb,numeric,text,text,text,jsonb) from public,anon;
grant execute on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb,numeric,text,text,text,jsonb) to authenticated;

-- Não permite que um cliente antigo converta silenciosamente uma receita por peso.
create or replace function public.save_recipe(
  p_id uuid,p_revision integer,p_request_id uuid,p_name text,p_product_id uuid,
  p_yield_quantity integer,p_notes text,p_items jsonb,p_output_quantity numeric,p_output_unit text,p_category text
) returns uuid language plpgsql security invoker set search_path='' as $$
begin
  if exists(select 1 from public.recipes where id=p_id and cost_mode='weight') then
    raise exception 'Esta receita usa cálculo por peso. Atualize a aplicação para editá-la.';
  end if;
  return public.save_recipe(p_id,p_revision,p_request_id,p_name,p_product_id,p_yield_quantity,p_notes,p_items,
    p_output_quantity,p_output_unit,p_category,'units','[]'::jsonb);
end $$;

create or replace function public.dashboard_summary(p_from date,p_until date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365 then raise exception 'Selecione um período de até 366 dias'; end if;
 with period_sales as (
  select * from public.sales where sale_date between p_from and p_until
 ), product_costs as (
  select c.product_id,count(*) as recipe_count,max(c.raw_unit_cost_cents) as unit_cost,
    min((select count(*) from public.recipe_items i where i.recipe_id=c.recipe_id)) as ingredient_count
  from public.recipe_product_costs c group by c.product_id
 ), items as (
  select i.*,c.recipe_count,c.unit_cost,c.ingredient_count from public.sale_items i join period_sales s on s.id=i.sale_id left join product_costs c on c.product_id=i.product_id
 ), item_summary as (
  select coalesce(sum(quantity),0) as units,
   coalesce(sum(quantity) filter(where recipe_count=1 and ingredient_count>0),0) as costed_units,
   coalesce(sum(quantity) filter(where recipe_count>1),0) as ambiguous_units,
   coalesce(sum(quantity) filter(where recipe_count is null or ingredient_count=0),0) as missing_units,
   round(coalesce(sum(quantity*unit_cost) filter(where recipe_count=1 and ingredient_count>0),0),0) as estimated_cost_cents
  from items
 ), sale_summary as (
  select count(*) as sale_count,coalesce(sum(total_cents),0) as revenue_cents,coalesce(sum(received_cents),0) as received_cents,
   coalesce(sum(total_cents-received_cents),0) as receivable_cents,
   coalesce(round(avg(total_cents),0),0) as average_ticket_cents,
   count(*) filter(where received_cents=total_cents) as settled_count,
   count(*) filter(where received_cents>0 and received_cents<total_cents) as partial_count,
   count(*) filter(where received_cents=0 and total_cents>0) as unpaid_count
  from period_sales
 )
 select jsonb_build_object(
  'sale_count',s.sale_count,'revenue_cents',s.revenue_cents,'received_cents',s.received_cents,'receivable_cents',s.receivable_cents,'average_ticket_cents',s.average_ticket_cents,
  'settled_count',s.settled_count,'partial_count',s.partial_count,'unpaid_count',s.unpaid_count,
  'units',i.units,'costed_units',i.costed_units,'missing_units',i.missing_units,'ambiguous_units',i.ambiguous_units,'estimated_cost_cents',i.estimated_cost_cents,
  'estimated_gross_margin_cents',case when s.sale_count>0 and i.units>0 and i.units=i.costed_units then s.revenue_cents-i.estimated_cost_cents else null end,
  'all_receivable_cents',(select coalesce(sum(total_cents-received_cents),0) from public.sales),
  'all_pending_count',(select count(*) from public.sales where total_cents>received_cents),
  'product_count',(select count(*) from public.products),'customer_count',(select count(*) from public.customers),
  'material_count',(select count(*) from public.materials),'recipe_count',(select count(*) from public.recipes),
  'calculated_at',statement_timestamp()
 ) into result from sale_summary s cross join item_summary i;
 return result;
end $$;

notify pgrst, 'reload schema';
commit;
