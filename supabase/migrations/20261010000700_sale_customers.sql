create table public.customers (
 id uuid primary key default gen_random_uuid(),
 name text not null check (name=btrim(name) and length(name) between 2 and 120),
 created_at timestamptz not null default now()
);
create index customers_name_id_idx on public.customers(name,id);
alter table public.customers enable row level security;
alter table public.customers force row level security;
revoke all on public.customers from public,anon,authenticated;
grant select on public.customers to authenticated;
grant insert(name) on public.customers to authenticated;
grant all on public.customers to service_role;
create policy customers_admin_read on public.customers for select to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
create policy customers_admin_insert on public.customers for insert to authenticated with check (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
-- Recupera apenas nomes reais do histórico, sem usar os clientes demonstrativos.
insert into public.customers(name) select distinct btrim(customer) from public.sales
where btrim(customer)<>'Consumidor final' and length(btrim(customer)) between 2 and 120;
alter table public.sales add column customer_id uuid references public.customers(id);
create index sales_customer_id_idx on public.sales(customer_id);
update public.sales s set customer_id=c.id from public.customers c where c.name=btrim(s.customer);
-- Mantém o cálculo e a idempotência existentes em uma função interna.
alter function public.create_sale(uuid,text,date,bigint,text,text,jsonb) set schema private;
alter function private.create_sale(uuid,text,date,bigint,text,text,jsonb) rename to create_sale_base;
revoke all on function private.create_sale_base(uuid,text,date,bigint,text,text,jsonb) from public,anon,authenticated;
create function public.create_sale(p_request_id uuid,p_customer text,p_sale_date date,p_received_cents bigint,p_payment_method text,p_notes text,p_items jsonb,p_customer_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare customer_name text; sale_id uuid;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then
  raise exception 'Acesso negado' using errcode='42501';
 end if;
 if p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select id into sale_id from public.sales where created_by=auth.uid() and request_id=p_request_id;
 if found then return sale_id; end if;
 if p_customer_id is not null then
  select name into customer_name from public.customers where id=p_customer_id for share;
  if not found then raise exception 'Cliente não encontrado. Selecione novamente.'; end if;
 else
  customer_name:=p_customer;
 end if;
 sale_id:=private.create_sale_base(p_request_id,customer_name,p_sale_date,p_received_cents,p_payment_method,p_notes,p_items);
 update public.sales set customer_id=p_customer_id where id=sale_id;
 return sale_id;
end $$;
revoke all on function public.create_sale(uuid,text,date,bigint,text,text,jsonb,uuid) from public,anon;
grant execute on function public.create_sale(uuid,text,date,bigint,text,text,jsonb,uuid) to authenticated;
