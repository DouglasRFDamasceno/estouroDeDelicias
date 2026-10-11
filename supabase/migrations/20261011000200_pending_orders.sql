begin;

create table private.order_limits (
 month date not null,
 key text not null,
 attempts integer not null default 0,
 accepted integer not null default 0,
 minute timestamptz not null default date_trunc('minute', now()),
 minute_attempts integer not null default 0,
 primary key(month,key)
);
revoke all on private.order_limits from public,anon,authenticated,service_role;

create table public.pending_orders (
 id uuid primary key,
 reference bigint generated always as identity (start with 1000) unique,
 customer text not null check(length(customer) between 2 and 120),
 items jsonb not null check(jsonb_typeof(items)='array' and jsonb_array_length(items) between 1 and 39),
 total_cents bigint not null check(total_cents between 0 and 100000000000),
 status text not null default 'pending' check(status in ('pending','confirmed','cancelled')),
 sale_id uuid references public.sales(id) on delete set null,
 created_at timestamptz not null default now(),
 expires_at timestamptz not null default now()+interval '7 days'
);
-- As impressões de IP e o conteúdo original não são expostos nem aos clientes autenticados.
create table private.order_requests (
 id uuid primary key references public.pending_orders(id) on delete cascade,
 ip_hash text not null,
 fingerprint text not null
);
revoke all on private.order_requests from public,anon,authenticated,service_role;
create index pending_orders_status_created_idx on public.pending_orders(status,created_at desc,id);
create index pending_orders_expires_idx on public.pending_orders(expires_at);
alter table public.pending_orders enable row level security;
alter table public.pending_orders force row level security;
revoke all on public.pending_orders from public,anon,authenticated;
grant select on public.pending_orders to authenticated;
grant all on public.pending_orders to service_role;
grant usage,select on sequence public.pending_orders_reference_seq to service_role;
create policy pending_orders_admin_read on public.pending_orders for select to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);

create function private.clean_pending_orders() returns void
language plpgsql security definer set search_path='' as $$
begin
 delete from public.pending_orders where
  (status='pending' and expires_at<=now()) or
  (status<>'pending' and created_at<now()-interval '30 days');
 delete from private.order_limits where month<date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
end $$;
revoke all on function private.clean_pending_orders() from public,anon,authenticated,service_role;

create function public.cleanup_pending_orders() returns void
language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(710112002);
 perform private.clean_pending_orders();
end $$;
revoke all on function public.cleanup_pending_orders() from public,anon,authenticated;
grant execute on function public.cleanup_pending_orders() to service_role;

-- Executada ANTES do CAPTCHA. Uma linha por IP/mês; global limita também a criação de contadores.
create function public.admit_order_attempt(p_ip_hash text) returns boolean
language plpgsql security definer set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 t timestamptz:=date_trunc('minute',now()); g private.order_limits%rowtype; i private.order_limits%rowtype;
begin
 if p_ip_hash is null or p_ip_hash!~'^[0-9a-f]{64}$' then return false; end if;
 perform pg_advisory_xact_lock(710112002);
 perform private.clean_pending_orders();
 insert into private.order_limits(month,key) values(m,'global') on conflict do nothing;
 select * into g from private.order_limits where month=m and key='global';
 if g.attempts>=10000 or (g.minute=t and g.minute_attempts>=100) then return false; end if;
 update private.order_limits set attempts=attempts+1,minute=t,
 minute_attempts=case when minute=t then minute_attempts+1 else 1 end where month=m and key='global';
 insert into private.order_limits(month,key) values(m,p_ip_hash) on conflict do nothing;
 select * into i from private.order_limits where month=m and key=p_ip_hash;
 if i.minute=t and i.minute_attempts>=5 then return false; end if;
 update private.order_limits set attempts=attempts+1,minute=t,
 minute_attempts=case when minute=t then minute_attempts+1 else 1 end where month=m and key=p_ip_hash;
 return true;
end $$;
revoke all on function public.admit_order_attempt(text) from public,anon,authenticated;
grant execute on function public.admit_order_attempt(text) to service_role;

create function public.create_pending_order(p_request_id uuid,p_ip_hash text,p_customer text,p_items jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare m date:=date_trunc('month',now() at time zone 'America/Sao_Paulo')::date;
 saved public.pending_orders%rowtype; r private.order_requests%rowtype;
 item jsonb; product public.products%rowtype; seen uuid[]:='{}'; qty integer; grams integer;
 snapshot jsonb:='[]'; total bigint:=0; fingerprint text;
begin
 if p_request_id is null or p_ip_hash is null or p_ip_hash!~'^[0-9a-f]{64}$'
 or p_customer is null or length(btrim(p_customer)) not between 2 and 120
 or p_customer ~ '[[:cntrl:]]' or p_items is null or jsonb_typeof(p_items)<>'array'
 then raise exception 'INVALID_ORDER'; end if;
 if jsonb_array_length(p_items) not between 1 and 39 then raise exception 'INVALID_ORDER'; end if;
 fingerprint:=md5(jsonb_build_object('customer',btrim(p_customer),'items',p_items)::text);
 perform pg_advisory_xact_lock(710112002);
 select * into saved from public.pending_orders where id=p_request_id;
 if found then
  select * into r from private.order_requests where id=p_request_id;
  if r.ip_hash<>p_ip_hash or r.fingerprint<>fingerprint then raise exception 'REQUEST_CONFLICT'; end if;
  return jsonb_build_object('reference',saved.reference,'total_cents',saved.total_cents);
 end if;
 if not exists(select 1 from private.order_limits where month=m and key=p_ip_hash and attempts>0)
 then raise exception 'RATE_LIMIT'; end if;
 if (select accepted from private.order_limits where month=m and key=p_ip_hash)>=30
 then raise exception 'MONTHLY_IP_LIMIT'; end if;
 if (select accepted from private.order_limits where month=m and key='global')>=1000
 or (select count(*) from public.pending_orders where status='pending' and expires_at>now())>=300
 then raise exception 'GLOBAL_LIMIT'; end if;
 for item in select value from jsonb_array_elements(p_items) loop
  if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'quantity')<>'number'
  or jsonb_typeof(item->'size')<>'number' or jsonb_typeof(item->'flavor')<>'string'
  or coalesce(item->>'quantity','')!~'^[0-9]{1,2}$'
  or coalesce(item->>'size','') not in ('50','100','150')
  or coalesce(item->>'flavor','') not in ('Ninho','Oreo','Morango','Nutella','Maracujá','Limão','Bom Bom','Paçoca','Choco Ninho','Trufa de Chocolate','Prestígio','Ovomaltine','Cravejado')
  then raise exception 'INVALID_ORDER'; end if;
  qty:=(item->>'quantity')::integer; grams:=(item->>'size')::integer;
  if qty not between 1 and 99 then raise exception 'INVALID_ORDER'; end if;
  select * into product from public.products where name=item->>'flavor'
   and category='Pipocas gourmet' and presentation=grams::text||' g' for share;
  if not found or product.id=any(seen) then raise exception 'PRODUCT_UNAVAILABLE'; end if;
  seen:=array_append(seen,product.id);
  total:=total+product.price_cents::bigint*qty;
  snapshot:=snapshot||jsonb_build_array(jsonb_build_object('product_id',product.id,'name',product.name,
   'presentation',product.presentation,'quantity',qty,'unit_price_cents',product.price_cents));
 end loop;
 insert into public.pending_orders(id,customer,items,total_cents) values(p_request_id,btrim(p_customer),snapshot,total) returning * into saved;
 insert into private.order_requests values(p_request_id,p_ip_hash,fingerprint);
 update private.order_limits set accepted=accepted+1 where month=m and key in ('global',p_ip_hash);
 return jsonb_build_object('reference',saved.reference,'total_cents',saved.total_cents);
end $$;
revoke all on function public.create_pending_order(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.create_pending_order(uuid,text,text,jsonb) to service_role;

-- O bloqueio da linha garante uma única venda mesmo com dois administradores confirmando juntos.
create function public.confirm_pending_order(p_order_id uuid,p_request_id uuid,p_customer text,p_sale_date date,
 p_received_cents bigint,p_payment_method text,p_notes text,p_items jsonb,p_customer_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare saved public.pending_orders%rowtype; sid uuid;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin)
 then raise exception 'Acesso negado' using errcode='42501'; end if;
 select * into saved from public.pending_orders where id=p_order_id for update;
 if not found then raise exception 'Pedido não encontrado ou expirado.'; end if;
 if saved.status='confirmed' then
  if saved.sale_id is null then raise exception 'A venda deste pedido foi removida.'; end if;
  return saved.sale_id;
 end if;
 if saved.status<>'pending' or saved.expires_at<=now() then raise exception 'Pedido cancelado ou expirado.'; end if;
 sid:=public.create_sale(saved.id,p_customer,p_sale_date,p_received_cents,p_payment_method,p_notes,p_items,p_customer_id);
 update public.pending_orders set status='confirmed',sale_id=sid where id=saved.id;
 return sid;
end $$;
revoke all on function public.confirm_pending_order(uuid,uuid,text,date,bigint,text,text,jsonb,uuid) from public,anon;
grant execute on function public.confirm_pending_order(uuid,uuid,text,date,bigint,text,text,jsonb,uuid) to authenticated;

create function public.cancel_pending_order(p_order_id uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin)
 then raise exception 'Acesso negado' using errcode='42501'; end if;
 update public.pending_orders set status='cancelled' where id=p_order_id and status='pending';
end $$;
revoke all on function public.cancel_pending_order(uuid) from public,anon;
grant execute on function public.cancel_pending_order(uuid) to authenticated;
commit;
