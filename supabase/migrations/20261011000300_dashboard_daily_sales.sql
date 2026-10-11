-- Série diária agregada no servidor, respeitando as permissões e RLS.
create function public.dashboard_daily_sales(p_from date, p_until date)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare result jsonb;
begin
  if not private.confirmed_user() or not exists (
    select 1 from public.profiles where id = auth.uid() and is_admin
  ) then raise exception 'Acesso negado' using errcode = '42501'; end if;
  if p_from is null or p_until is null or p_until < p_from or p_until - p_from > 365 then
    raise exception 'Selecione um período de até 366 dias';
  end if;
  with daily as (
    select sale_date, sum(total_cents) as revenue_cents
    from public.sales where sale_date between p_from and p_until group by sale_date
  ), series as (
    select p_from + day as date, coalesce(d.revenue_cents, 0) as revenue_cents
    from generate_series(0, p_until - p_from) as days(day)
    left join daily d on d.sale_date = p_from + day
  ) select coalesce(jsonb_agg(to_jsonb(series) order by date), '[]'::jsonb) into result from series;
  return result;
end $$;
revoke all on function public.dashboard_daily_sales(date,date) from public, anon;
grant execute on function public.dashboard_daily_sales(date,date) to authenticated;
