begin;

-- Só receitas sem produto armazenam uma categoria própria. Cadastros antigos são opcionais.
alter table public.recipes add column base_category text
  check (base_category is null or (length(base_category) between 2 and 80 and base_category=btrim(base_category)));
alter table public.recipes add constraint recipes_base_category_product_check
  check (product_id is null or base_category is null);

-- Categorias compartilhadas, deduplicadas no banco e sujeitas ao RLS das fontes.
-- Mantém opções ainda usadas por bases quando um produto muda de categoria.
create view public.recipe_categories with (security_invoker=true) as
  select category from public.products
  union
  select base_category as category from public.recipes where base_category is not null;
revoke all on public.recipe_categories from public,anon;
grant select on public.recipe_categories to authenticated,service_role;

create function public.category_search(public.recipe_categories)
returns text language sql immutable strict parallel safe security invoker set search_path='' as $$
  select public.normalize_search(($1).category);
$$;
revoke all on function public.category_search(public.recipe_categories) from public,anon;
grant execute on function public.category_search(public.recipe_categories) to authenticated,service_role;

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
  round(t.raw_total_cents/r.yield_quantity,0) as unit_cost_cents,
  r.output_quantity,r.output_unit,t.raw_total_cents,
  case when r.product_id is not null then p.category else r.base_category end as category,
  r.base_category
from public.recipes r join totals t on t.root_id=r.id
left join public.products p on p.id=r.product_id;

create function public.save_recipe(
  p_id uuid,p_revision integer,p_request_id uuid,p_name text,p_product_id uuid,
  p_yield_quantity integer,p_notes text,p_items jsonb,p_output_quantity numeric,p_output_unit text,p_category text
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
    select name||' · '||presentation into v_product_label from public.products where id=p_product_id for share;
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
    insert into public.recipes(id,name,product_id,product_label,yield_quantity,notes,last_request,output_quantity,output_unit,base_category)
    values(p_id,btrim(p_name),p_product_id,v_product_label,p_yield_quantity,btrim(p_notes),p_request_id,p_output_quantity,p_output_unit,v_category);
  else
    update public.recipes set name=btrim(p_name),product_id=p_product_id,product_label=v_product_label,
      yield_quantity=p_yield_quantity,notes=btrim(p_notes),last_request=p_request_id,
      output_quantity=p_output_quantity,output_unit=p_output_unit,base_category=v_category where id=p_id;
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
  return p_id;
end $$;
revoke all on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb,numeric,text,text) from public,anon;
grant execute on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb,numeric,text,text) to authenticated;

-- Clientes anteriores preservam a categoria ao alterar os outros campos.
create or replace function public.save_recipe(
  p_id uuid,p_revision integer,p_request_id uuid,p_name text,p_product_id uuid,
  p_yield_quantity integer,p_notes text,p_items jsonb,p_output_quantity numeric,p_output_unit text
) returns uuid language sql security invoker set search_path='' as $$
  select public.save_recipe(p_id,p_revision,p_request_id,p_name,p_product_id,p_yield_quantity,p_notes,p_items,
    p_output_quantity,p_output_unit,(select base_category from public.recipes where id=p_id));
$$;

notify pgrst, 'reload schema';
commit;
