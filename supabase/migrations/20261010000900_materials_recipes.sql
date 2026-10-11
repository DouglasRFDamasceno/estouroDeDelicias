create table public.materials (
 id uuid primary key default gen_random_uuid(),
 name text not null check(name=btrim(name) and length(name) between 2 and 120),
 purchase_quantity numeric(14,3) not null check(purchase_quantity>0 and purchase_quantity<=10000000),
 purchase_unit text not null check(purchase_unit in ('g','kg','ml','l','un')),
 price_cents integer not null check(price_cents between 0 and 100000000),
 revision integer not null default 1,
 created_at timestamptz not null default now()
);
create table public.recipes (
 id uuid primary key default gen_random_uuid(),
 name text not null check(name=btrim(name) and length(name) between 2 and 120),
 product_id uuid references public.products(id) on delete set null,
 product_label text not null,
 yield_quantity integer not null check(yield_quantity between 1 and 1000000),
 notes text not null default '' check(length(notes)<=1000),
 revision integer not null default 1,
 last_request uuid not null,
 created_at timestamptz not null default now()
);
create table public.recipe_items (
 id uuid primary key default gen_random_uuid(),
 recipe_id uuid not null references public.recipes(id) on delete cascade,
 material_id uuid not null references public.materials(id) on delete restrict,
 quantity numeric(14,3) not null check(quantity>0 and quantity<=10000000),
 unit text not null check(unit in ('g','kg','ml','l','un')),
 unique(recipe_id,material_id)
);
create index materials_name_id_idx on public.materials(name,id);
create index recipes_name_id_idx on public.recipes(name,id);
create index recipes_product_idx on public.recipes(product_id);
create index recipe_items_material_idx on public.recipe_items(material_id);
create trigger materials_revision before update on public.materials for each row execute function private.bump_revision();
create trigger recipes_revision before update on public.recipes for each row execute function private.bump_revision();
alter table public.materials enable row level security;
alter table public.materials force row level security;
alter table public.recipes enable row level security;
alter table public.recipes force row level security;
alter table public.recipe_items enable row level security;
alter table public.recipe_items force row level security;
revoke all on public.materials,public.recipes,public.recipe_items from public,anon,authenticated;
grant select on public.materials,public.recipes,public.recipe_items to authenticated;
grant insert(name,purchase_quantity,purchase_unit,price_cents),update(name,purchase_quantity,purchase_unit,price_cents),delete on public.materials to authenticated;
grant delete on public.recipes to authenticated;
grant all on public.materials,public.recipes,public.recipe_items to service_role;
create policy materials_admin on public.materials for all to authenticated using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)) with check(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
create policy recipes_admin on public.recipes for all to authenticated using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)) with check(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
create policy recipe_items_admin_read on public.recipe_items for select to authenticated using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
-- Evita trocar massa por volume em insumos já usados em receitas.
create function private.validate_material_unit() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.recipe_items where material_id=old.id and
 (case unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
 (case new.purchase_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)) then raise exception 'A unidade deve ser compatível com as receitas que usam este insumo.'; end if;
 return new;
end $$;
revoke all on function private.validate_material_unit() from public,anon,authenticated;
create trigger materials_unit before update on public.materials for each row execute function private.validate_material_unit();
create view public.recipe_costs with (security_invoker=true) as
select r.id,r.name,r.product_id,r.product_label,r.yield_quantity,r.notes,r.revision,r.created_at,
 round(coalesce(sum(m.price_cents::numeric*i.quantity*(case when i.unit in ('kg','l') then 1000 else 1 end)/(m.purchase_quantity*(case when m.purchase_unit in ('kg','l') then 1000 else 1 end))),0),0) as total_cents,
 round(coalesce(sum(m.price_cents::numeric*i.quantity*(case when i.unit in ('kg','l') then 1000 else 1 end)/(m.purchase_quantity*(case when m.purchase_unit in ('kg','l') then 1000 else 1 end))),0)/r.yield_quantity,0) as unit_cost_cents
from public.recipes r left join public.recipe_items i on i.recipe_id=r.id left join public.materials m on m.id=i.material_id group by r.id;
revoke all on public.recipe_costs from public,anon;
grant select on public.recipe_costs to authenticated,service_role;
create function public.save_recipe(p_id uuid,p_revision integer,p_request_id uuid,p_name text,p_product_id uuid,p_yield_quantity integer,p_notes text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare current_recipe public.recipes%rowtype; material public.materials%rowtype; item jsonb; v_product_label text; seen uuid[]:='{}';
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_id is null or p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_id::text,0));
 select * into current_recipe from public.recipes where id=p_id for update;
 if found then
  if current_recipe.last_request=p_request_id then return p_id; end if;
  if p_revision is null or p_revision<>current_recipe.revision then raise exception 'Receita alterada. Feche e abra novamente.'; end if;
 elsif p_revision is distinct from 0 then raise exception 'Receita não encontrada'; end if;
 if p_name is null or length(btrim(p_name)) not between 2 and 120 or p_yield_quantity is null or p_yield_quantity not between 1 and 1000000 or p_notes is null or length(p_notes)>1000
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Dados da receita inválidos'; end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Selecione de 1 a 50 insumos'; end if;
 if p_product_id is not null then
  select name||' · '||presentation into v_product_label from public.products where id=p_product_id for share;
  if not found then raise exception 'Produto não encontrado'; end if;
 elsif current_recipe.id is not null and current_recipe.product_id is null then v_product_label:=current_recipe.product_label;
 else raise exception 'Selecione o produto desta receita'; end if;
 perform id from public.materials where id in(select (value->>'material_id')::uuid from jsonb_array_elements(p_items)) order by id for share;
 for item in select value from jsonb_array_elements(p_items) loop
  select * into material from public.materials where id=(item->>'material_id')::uuid;
  if not found or material.id=any(seen) then raise exception 'Insumo inválido ou repetido'; end if;
  seen:=array_append(seen,material.id);
  if item->>'quantity' is null or item->>'quantity' !~ '^[0-9]{1,8}([.][0-9]{1,3})?$' or (item->>'quantity')::numeric<=0 or (item->>'quantity')::numeric>10000000
  or item->>'unit' is null or item->>'unit' not in ('g','kg','ml','l','un') then raise exception 'Quantidade ou unidade inválida'; end if;
  if (case item->>'unit' when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end)<>
  (case material.purchase_unit when 'kg' then 'mass' when 'g' then 'mass' when 'l' then 'volume' when 'ml' then 'volume' else 'count' end) then raise exception 'Unidades incompatíveis'; end if;
 end loop;
 if current_recipe.id is null then
  insert into public.recipes(id,name,product_id,product_label,yield_quantity,notes,last_request) values(p_id,btrim(p_name),p_product_id,v_product_label,p_yield_quantity,btrim(p_notes),p_request_id);
 else
  update public.recipes set name=btrim(p_name),product_id=p_product_id,product_label=v_product_label,yield_quantity=p_yield_quantity,notes=btrim(p_notes),last_request=p_request_id where id=p_id;
  delete from public.recipe_items where recipe_id=p_id;
 end if;
 insert into public.recipe_items(recipe_id,material_id,quantity,unit) select p_id,(value->>'material_id')::uuid,(value->>'quantity')::numeric,value->>'unit' from jsonb_array_elements(p_items);
 return p_id;
end $$;
revoke all on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb) from public,anon;
grant execute on function public.save_recipe(uuid,integer,uuid,text,uuid,integer,text,jsonb) to authenticated;
