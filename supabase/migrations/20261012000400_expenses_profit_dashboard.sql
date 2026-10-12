begin;

create table public.expenses (
 id uuid primary key,
 description text not null check(description=btrim(description) and length(description) between 2 and 120),
 category text not null default '' check(category=btrim(category) and (category='' or length(category) between 2 and 80)),
 expense_date date not null check(expense_date between date '1900-01-01' and date '9999-12-31'),
 amount_cents integer not null check(amount_cents between 1 and 100000000),
 notes text not null default '' check(length(notes)<=1000),
 revision integer not null default 1,
 last_request uuid not null,
 created_at timestamptz not null default now()
);
create index expenses_date_id_idx on public.expenses(expense_date,id);
create trigger expenses_revision before update on public.expenses for each row execute function private.bump_revision();
alter table public.expenses enable row level security;
alter table public.expenses force row level security;
revoke all on public.expenses from public,anon,authenticated;
grant select,delete on public.expenses to authenticated;
grant all on public.expenses to service_role;
create policy expenses_admin on public.expenses for all to authenticated
using(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin))
with check(private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));

create function public.save_expense(p_id uuid,p_revision integer,p_request_id uuid,p_description text,p_category text,p_date date,p_amount_cents integer,p_notes text)
returns uuid language plpgsql security definer set search_path='' as $$
declare current_expense public.expenses%rowtype;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_id is null or p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 perform pg_advisory_xact_lock(hashtextextended('public.expenses:'||p_id::text,0));
 select * into current_expense from public.expenses where id=p_id for update;
 if found then
  if current_expense.last_request=p_request_id then return p_id; end if;
  if p_revision is null or p_revision<>current_expense.revision then raise exception 'Despesa alterada. Feche e abra novamente.'; end if;
 elsif p_revision is distinct from 0 then raise exception 'Despesa não encontrada'; end if;
 if p_description is null or length(btrim(p_description)) not between 2 and 120
  or p_category is null or (btrim(p_category)<>'' and length(btrim(p_category)) not between 2 and 80)
  or p_date is null or p_date not between date '1900-01-01' and date '9999-12-31'
  or p_amount_cents is null or p_amount_cents not between 1 and 100000000
  or p_notes is null or length(p_notes)>1000 then raise exception 'Confira os dados da despesa.'; end if;
 if current_expense.id is null then
  insert into public.expenses(id,description,category,expense_date,amount_cents,notes,last_request)
   values(p_id,btrim(p_description),btrim(p_category),p_date,p_amount_cents,btrim(p_notes),p_request_id);
 else
  update public.expenses set description=btrim(p_description),category=btrim(p_category),expense_date=p_date,
   amount_cents=p_amount_cents,notes=btrim(p_notes),last_request=p_request_id where id=p_id;
 end if;
 return p_id;
end $$;
revoke all on function public.save_expense(uuid,integer,uuid,text,text,date,integer,text) from public,anon;
grant execute on function public.save_expense(uuid,integer,uuid,text,text,date,integer,text) to authenticated;

create function public.expenses_page(p_from date,p_until date,p_page integer,p_size integer,p_sort text,p_ascending boolean,p_search text,p_category text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365
  or p_page is null or p_page not between 1 and 1000000 or p_size is null or p_size not in(10,25,50)
  or p_sort is null or p_sort not in ('expense_date','description','category','amount_cents') or p_ascending is null
  or p_search is null or length(p_search)>120 or p_category is null or length(p_category)>80 then raise exception 'Consulta inválida'; end if;
 with filtered as (
  select id,description,category,expense_date,amount_cents,notes,revision from public.expenses
  where expense_date between p_from and p_until
   and position(public.normalize_search(btrim(p_search)) in public.normalize_search(description))>0
   and position(public.normalize_search(btrim(p_category)) in public.normalize_search(category))>0
 ), page as (
  select * from filtered order by
   case when p_sort='expense_date' and p_ascending then expense_date end asc,
   case when p_sort='expense_date' and not p_ascending then expense_date end desc,
   case when p_sort='description' and p_ascending then description end asc,
   case when p_sort='description' and not p_ascending then description end desc,
   case when p_sort='category' and p_ascending then category end asc,
   case when p_sort='category' and not p_ascending then category end desc,
   case when p_sort='amount_cents' and p_ascending then amount_cents end asc,
   case when p_sort='amount_cents' and not p_ascending then amount_cents end desc,id asc
  limit p_size offset ((p_page-1)::bigint*p_size)
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),
  'total',(select count(*) from filtered),'amount_cents',(select coalesce(sum(amount_cents),0) from filtered)) into result;
 return result;
end $$;
revoke all on function public.expenses_page(date,date,integer,integer,text,boolean,text,text) from public,anon;
grant execute on function public.expenses_page(date,date,integer,integer,text,boolean,text,text) to authenticated;

-- Fonte única da cobertura: cada item tem exatamente um motivo, evitando contagens sobrepostas.
create view public.dashboard_cost_items with (security_invoker=true) as
with product_costs as (
 select c.product_id,count(*) as recipe_count,max(c.raw_unit_cost_cents) as unit_cost,
  min((select count(*) from public.recipe_items i where i.recipe_id=c.recipe_id)) as ingredient_count
 from public.recipe_product_costs c group by c.product_id
)
select i.id,s.sale_date,i.product_id,i.product_name,i.category,i.presentation,i.quantity,
 i.quantity::bigint*i.unit_price_cents as revenue_cents,
 case when c.recipe_count=1 and c.ingredient_count>0 then i.quantity*c.unit_cost else null end as raw_cost_cents,
 case when i.product_id is null then 'removed_product' when c.recipe_count is null then 'no_recipe'
  when c.recipe_count>1 then 'multiple_recipes' when c.ingredient_count=0 then 'empty_recipe' else 'costed' end as reason
from public.sale_items i join public.sales s on s.id=i.sale_id left join product_costs c on c.product_id=i.product_id;
revoke all on public.dashboard_cost_items from public,anon;
grant select on public.dashboard_cost_items to authenticated,service_role;

create or replace function public.dashboard_summary(p_from date,p_until date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365 then raise exception 'Selecione um período de até 366 dias'; end if;
 with period_sales as (
  select * from public.sales where sale_date between p_from and p_until
 ), item_summary as (
  select coalesce(sum(quantity),0) as units,
   coalesce(sum(quantity) filter(where reason='costed'),0) as costed_units,
   coalesce(sum(quantity) filter(where reason='multiple_recipes'),0) as ambiguous_units,
   coalesce(sum(quantity) filter(where reason not in ('costed','multiple_recipes')),0) as missing_units,
   coalesce(sum(revenue_cents) filter(where reason='costed'),0) as costed_revenue_cents,
   coalesce(sum(revenue_cents) filter(where reason<>'costed'),0) as uncovered_revenue_cents,
   round(coalesce(sum(raw_cost_cents) filter(where reason='costed'),0),0) as estimated_cost_cents
  from public.dashboard_cost_items where sale_date between p_from and p_until
 ), sale_summary as (
  select count(*) as sale_count,coalesce(sum(total_cents),0) as revenue_cents,coalesce(sum(received_cents),0) as received_cents,
   coalesce(sum(total_cents-received_cents),0) as receivable_cents,
   coalesce(round(avg(total_cents),0),0) as average_ticket_cents,
   count(*) filter(where received_cents=total_cents) as settled_count,
   count(*) filter(where received_cents>0 and received_cents<total_cents) as partial_count,
   count(*) filter(where received_cents=0 and total_cents>0) as unpaid_count
  from period_sales
 ), expense_summary as (
  select count(*) as expense_count,coalesce(sum(amount_cents),0) as expense_cents
  from public.expenses where expense_date between p_from and p_until
 ), profit as (
  select case when i.units=i.costed_units and
    ((s.sale_count>0 and i.units>0) or (s.sale_count=0 and e.expense_count>0))
    then s.revenue_cents-i.estimated_cost_cents else null end as gross
  from sale_summary s cross join item_summary i cross join expense_summary e
 )
 select jsonb_build_object(
  'sale_count',s.sale_count,'revenue_cents',s.revenue_cents,'received_cents',s.received_cents,'receivable_cents',s.receivable_cents,'average_ticket_cents',s.average_ticket_cents,
  'settled_count',s.settled_count,'partial_count',s.partial_count,'unpaid_count',s.unpaid_count,
  'units',i.units,'costed_units',i.costed_units,'missing_units',i.missing_units,'ambiguous_units',i.ambiguous_units,'estimated_cost_cents',i.estimated_cost_cents,
  'estimated_gross_margin_cents',p.gross,
  'estimated_gross_profit_cents',p.gross,
  'estimated_gross_margin_percent',100::numeric*p.gross/nullif(s.revenue_cents,0),
  'expense_count',e.expense_count,'expense_cents',e.expense_cents,
  'estimated_net_profit_cents',p.gross-e.expense_cents,
  'estimated_net_margin_percent',100::numeric*(p.gross-e.expense_cents)/nullif(s.revenue_cents,0),
  'costed_revenue_cents',i.costed_revenue_cents,'uncovered_revenue_cents',i.uncovered_revenue_cents,
  'all_receivable_cents',(select coalesce(sum(total_cents-received_cents),0) from public.sales),
  'all_pending_count',(select count(*) from public.sales where total_cents>received_cents),
  'product_count',(select count(*) from public.products),'customer_count',(select count(*) from public.customers),
  'material_count',(select count(*) from public.materials),'recipe_count',(select count(*) from public.recipes),
  'calculated_at',statement_timestamp()
 ) into result from sale_summary s cross join item_summary i cross join expense_summary e cross join profit p;
 return result;
end $$;


create function public.dashboard_cost_issues(p_from date,p_until date,p_page integer,p_size integer,p_sort text,p_ascending boolean,p_reason text)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365
  or p_page is null or p_page not between 1 and 1000000 or p_size is null or p_size not in(10,25,50)
  or p_sort is null or p_sort not in ('name','quantity','revenue_cents') or p_ascending is null
  or p_reason is null or p_reason not in ('all','no_recipe','multiple_recipes','removed_product','empty_recipe') then raise exception 'Consulta inválida'; end if;
 with grouped as (
  select md5(jsonb_build_array(product_id,product_name,category,presentation,reason)::text) as id,
   product_id,product_name as name,category,presentation,reason,sum(quantity) as quantity,sum(revenue_cents) as revenue_cents
  from public.dashboard_cost_items where sale_date between p_from and p_until and reason<>'costed'
   and (p_reason='all' or reason=p_reason)
  group by product_id,product_name,category,presentation,reason
 ), page as (
  select * from grouped order by
   case when p_sort='name' and p_ascending then name end asc,
   case when p_sort='name' and not p_ascending then name end desc,
   case when p_sort='quantity' and p_ascending then quantity end asc,
   case when p_sort='quantity' and not p_ascending then quantity end desc,
   case when p_sort='revenue_cents' and p_ascending then revenue_cents end asc,
   case when p_sort='revenue_cents' and not p_ascending then revenue_cents end desc,id asc
  limit p_size offset ((p_page-1)::bigint*p_size)
 ) select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)) from page),'[]'::jsonb),'total',(select count(*) from grouped)) into result;
 return result;
end $$;
revoke all on function public.dashboard_cost_issues(date,date,integer,integer,text,boolean,text) from public,anon;
grant execute on function public.dashboard_cost_issues(date,date,integer,integer,text,boolean,text) to authenticated;

notify pgrst, 'reload schema';
commit;
