create table public.sales (
 id uuid primary key default gen_random_uuid(),
 created_by uuid not null references auth.users(id),
 request_id uuid not null,
 customer text not null check (length(customer) between 1 and 120),
 sale_date date not null,
 total_cents bigint not null check(total_cents between 0 and 100000000000),
 received_cents bigint not null check(received_cents between 0 and total_cents),
 payment_method text not null check(payment_method in ('pending','pix','cash','card','other')),
 notes text not null default '' check(length(notes)<=1000),
 created_at timestamptz not null default now(),
 unique(created_by,request_id),
 check ((received_cents=0) or payment_method<>'pending')
);
create table public.sale_items (
 id uuid primary key default gen_random_uuid(),
 sale_id uuid not null references public.sales(id) on delete cascade,
 product_id uuid references public.products(id) on delete set null,
 product_name text not null,
 category text not null,
 presentation text not null,
 unit_price_cents integer not null check(unit_price_cents between 0 and 100000000),
 quantity integer not null check(quantity between 1 and 999),
 unique(sale_id,product_id)
);
create index sales_date_id_idx on public.sales(sale_date desc,id);
create index sale_items_sale_idx on public.sale_items(sale_id);
create index sale_items_product_idx on public.sale_items(product_id);
alter table public.sales enable row level security;
alter table public.sales force row level security;
alter table public.sale_items enable row level security;
alter table public.sale_items force row level security;
revoke all on public.sales,public.sale_items from public,anon,authenticated;
grant select on public.sales,public.sale_items to authenticated;
grant all on public.sales,public.sale_items to service_role;
create policy sales_admin_read on public.sales for select to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
create policy sale_items_admin_read on public.sale_items for select to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
create function public.create_sale(p_request_id uuid,p_customer text,p_sale_date date,p_received_cents bigint,p_payment_method text,p_notes text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 sale_id uuid; item jsonb; product public.products%rowtype; qty integer; total bigint:=0; seen uuid[]:='{}';
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then
  raise exception 'Acesso negado' using errcode='42501';
 end if;
 if p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 -- Serializa tentativas simultâneas da mesma requisição, sem duplicar vendas.
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||p_request_id::text,0));
 select id into sale_id from public.sales where created_by=auth.uid() and request_id=p_request_id;
 if found then return sale_id; end if;
 if p_customer is null or length(btrim(p_customer)) not between 1 and 120 or p_sale_date is null
 or p_sale_date < date '2000-01-01' or p_sale_date > (now() at time zone 'America/Sao_Paulo')::date
 or p_received_cents is null or p_received_cents<0 or p_payment_method is null
 or p_payment_method not in ('pending','pix','cash','card','other') or p_notes is null or length(p_notes)>1000
 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Dados da venda inválidos'; end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Informe de 1 a 50 produtos'; end if;
 -- Bloqueia os produtos em ordem estável para garantir preços consistentes.
 perform id from public.products where id in (select (value->>'product_id')::uuid from jsonb_array_elements(p_items)) order by id for share;
 for item in select value from jsonb_array_elements(p_items) loop
  if (item->>'quantity') is null or (item->>'quantity') !~ '^[0-9]{1,3}$' then raise exception 'Quantidade inválida'; end if;
  qty:=(item->>'quantity')::integer;
  select * into product from public.products where id=(item->>'product_id')::uuid;
  if not found or product.id=any(seen) or qty not between 1 and 999 then raise exception 'Produto ou quantidade inválidos'; end if;
  if (item->>'unit_price_cents') is null or (item->>'unit_price_cents')::bigint<>product.price_cents then raise exception 'Preço atualizado. Reabra a venda para atualizar os produtos.'; end if;
  seen:=array_append(seen,product.id);
  total:=total+product.price_cents::bigint*qty;
 end loop;
 if total>100000000000 or p_received_cents>total or (p_received_cents>0 and p_payment_method='pending') then raise exception 'Valor recebido inválido'; end if;
 insert into public.sales(created_by,request_id,customer,sale_date,total_cents,received_cents,payment_method,notes)
 values(auth.uid(),p_request_id,btrim(p_customer),p_sale_date,total,p_received_cents,p_payment_method,btrim(p_notes)) returning id into sale_id;
 for item in select value from jsonb_array_elements(p_items) loop
  select * into product from public.products where id=(item->>'product_id')::uuid;
  insert into public.sale_items(sale_id,product_id,product_name,category,presentation,unit_price_cents,quantity)
  values(sale_id,product.id,product.name,product.category,product.presentation,product.price_cents,(item->>'quantity')::integer);
 end loop;
 return sale_id;
end $$;
revoke all on function public.create_sale(uuid,text,date,bigint,text,text,jsonb) from public,anon;
grant execute on function public.create_sale(uuid,text,date,bigint,text,text,jsonb) to authenticated;
