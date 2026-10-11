-- Agregações executadas no servidor com privilégios do usuário e RLS.
create function public.dashboard_summary(p_from date,p_until date)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365 then raise exception 'Selecione um período de até 366 dias'; end if;
 with period_sales as (
  select * from public.sales where sale_date between p_from and p_until
 ), recipe_totals as (
  select r.id,r.product_id,r.yield_quantity,count(i.id) as ingredient_count,
   sum(m.price_cents::numeric*i.quantity*(case when i.unit in ('kg','l') then 1000 else 1 end)/(m.purchase_quantity*(case when m.purchase_unit in ('kg','l') then 1000 else 1 end)))/r.yield_quantity as unit_cost
  from public.recipes r left join public.recipe_items i on i.recipe_id=r.id left join public.materials m on m.id=i.material_id group by r.id
 ), product_costs as (
  select product_id,count(*) as recipe_count,max(unit_cost) as unit_cost,min(ingredient_count) as ingredient_count from recipe_totals where product_id is not null group by product_id
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
revoke all on function public.dashboard_summary(date,date) from public,anon;
grant execute on function public.dashboard_summary(date,date) to authenticated;

create function public.dashboard_products(p_from date,p_until date,p_page integer,p_size integer,p_sort text,p_ascending boolean)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 if p_from is null or p_until is null or p_until<p_from or p_until-p_from>365 or p_page is null or p_page<1 or p_page>1000000 or p_size is null or p_size not in(10,25,50)
 or p_sort is null or p_sort not in ('name','quantity','revenue_cents') or p_ascending is null then raise exception 'Consulta inválida'; end if;
 with grouped as (
  select md5(jsonb_build_array(i.product_id,i.product_name,i.category,i.presentation)::text) as id,
   i.product_name as name,i.category,i.presentation,sum(i.quantity) as quantity,sum(i.quantity::bigint*i.unit_price_cents) as revenue_cents
  from public.sale_items i join public.sales s on s.id=i.sale_id where s.sale_date between p_from and p_until
  group by i.product_id,i.product_name,i.category,i.presentation
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
revoke all on function public.dashboard_products(date,date,integer,integer,text,boolean) from public,anon;
grant execute on function public.dashboard_products(date,date,integer,integer,text,boolean) to authenticated;
