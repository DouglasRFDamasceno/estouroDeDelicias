-- Campos calculados para filtrar sem acentos, sem modificar os nomes originais.
create function public.normalize_search(text)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select pg_catalog.lower(pg_catalog.regexp_replace(
    pg_catalog.normalize($1, 'NFD'), U&'[\0300-\036f]', '', 'g'
  ));
$$;
revoke all on function public.normalize_search(text) from public, anon;
grant execute on function public.normalize_search(text) to authenticated, service_role;

create function public.name_search(public.products)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).name);
$$;
revoke all on function public.name_search(public.products) from public, anon;
grant execute on function public.name_search(public.products) to authenticated, service_role;

create function public.category_search(public.products)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).category);
$$;
revoke all on function public.category_search(public.products) from public, anon;
grant execute on function public.category_search(public.products) to authenticated, service_role;

create function public.presentation_search(public.products)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).presentation);
$$;
revoke all on function public.presentation_search(public.products) from public, anon;
grant execute on function public.presentation_search(public.products) to authenticated, service_role;

create function public.name_search(public.customers)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).name);
$$;
revoke all on function public.name_search(public.customers) from public, anon;
grant execute on function public.name_search(public.customers) to authenticated, service_role;

create function public.name_search(public.materials)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).name);
$$;
revoke all on function public.name_search(public.materials) from public, anon;
grant execute on function public.name_search(public.materials) to authenticated, service_role;

create function public.name_search(public.recipe_costs)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).name);
$$;
revoke all on function public.name_search(public.recipe_costs) from public, anon;
grant execute on function public.name_search(public.recipe_costs) to authenticated, service_role;

create function public.customer_search(public.sales)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).customer);
$$;
revoke all on function public.customer_search(public.sales) from public, anon;
grant execute on function public.customer_search(public.sales) to authenticated, service_role;

create function public.customer_search(public.pending_orders)
returns text language sql immutable strict parallel safe security invoker
set search_path = '' as $$
  select public.normalize_search(($1).customer);
$$;
revoke all on function public.customer_search(public.pending_orders) from public, anon;
grant execute on function public.customer_search(public.pending_orders) to authenticated, service_role;

notify pgrst, 'reload schema';
