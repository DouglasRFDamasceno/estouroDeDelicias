-- Controle otimista: evita sobrescrever alterações feitas por outra sessão.
alter table public.products add column revision integer not null default 1;
alter table public.customers add column revision integer not null default 1;
alter table public.sales add column revision integer not null default 1;
alter table public.sales add column last_edit_request uuid;
create function private.bump_revision() returns trigger language plpgsql set search_path='' as $$
begin new.revision:=old.revision+1; return new; end $$;
revoke all on function private.bump_revision() from public,anon,authenticated;
create trigger products_revision before update on public.products for each row execute function private.bump_revision();
create trigger customers_revision before update on public.customers for each row execute function private.bump_revision();
create trigger sales_revision before update on public.sales for each row execute function private.bump_revision();
grant update(name,category,presentation,price_cents) on public.products to authenticated;
create policy products_admin_update on public.products for update to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
) with check (private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
grant update(name),delete on public.customers to authenticated;
create policy customers_admin_update on public.customers for update to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
) with check (private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin));
create policy customers_admin_delete on public.customers for delete to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
alter table public.sales drop constraint sales_customer_id_fkey;
alter table public.sales add constraint sales_customer_id_fkey foreign key(customer_id) references public.customers(id) on delete set null;
grant delete on public.sales to authenticated;
create policy sales_admin_delete on public.sales for delete to authenticated using (
 private.confirmed_user() and exists(select 1 from public.profiles where id=auth.uid() and is_admin)
);
create function public.update_sale(p_sale_id uuid,p_revision integer,p_request_id uuid,p_customer_id uuid,p_customer text,p_sale_date date,p_received_cents bigint,p_payment_method text,p_notes text,p_items jsonb)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 sale public.sales%rowtype; old_item public.sale_items%rowtype; product public.products%rowtype;
 item jsonb; qty integer; total bigint:=0; customer_name text;
 snapshots jsonb:='[]'; seen text[]:='{}'; item_key text;
begin
 if not private.confirmed_user() or not exists(select 1 from public.profiles where id=auth.uid() and is_admin) then raise exception 'Acesso negado' using errcode='42501'; end if;
 select * into sale from public.sales where id=p_sale_id for update;
 if not found then raise exception 'Venda não encontrada. Atualize a lista.'; end if;
 if p_request_id is null then raise exception 'Identificador obrigatório'; end if;
 if sale.last_edit_request=p_request_id then return sale.id; end if;
 if p_revision is null or sale.revision<>p_revision then raise exception 'Esta venda foi alterada. Feche e abra novamente para atualizar os dados.'; end if;
 if p_sale_date is null or p_sale_date<date '2000-01-01' or p_sale_date>(now() at time zone 'America/Sao_Paulo')::date
 or p_received_cents is null or p_received_cents<0 or p_payment_method is null or p_payment_method not in ('pending','pix','cash','card','other')
 or p_notes is null or length(p_notes)>1000 or p_items is null or jsonb_typeof(p_items)<>'array' then raise exception 'Dados inválidos'; end if;
 if jsonb_array_length(p_items) not between 1 and 50 then raise exception 'Informe de 1 a 50 itens'; end if;
 if p_customer_id is not null then
  select name into customer_name from public.customers where id=p_customer_id for share;
  if not found then raise exception 'Cliente não encontrado'; end if;
 elsif sale.customer_id is null and p_customer=sale.customer then customer_name:=sale.customer;
 else customer_name:='Consumidor final'; end if;
 -- Itens existentes conservam preço e descrição históricos, inclusive produtos removidos.
 perform id from public.products where id in (select (value->>'product_id')::uuid from jsonb_array_elements(p_items) where value->>'sale_item_id' is null) order by id for share;
 for item in select value from jsonb_array_elements(p_items) loop
  if item->>'quantity' is null or item->>'quantity' !~ '^[0-9]{1,3}$' then raise exception 'Quantidade inválida'; end if;
  qty:=(item->>'quantity')::integer;
  if qty not between 1 and 999 then raise exception 'Quantidade inválida'; end if;
  if item->>'sale_item_id' is not null then
   select * into old_item from public.sale_items where id=(item->>'sale_item_id')::uuid and sale_id=sale.id;
   if not found then raise exception 'Item inválido'; end if;
   item_key:=coalesce(old_item.product_id::text,old_item.id::text);
  else
   select * into product from public.products where id=(item->>'product_id')::uuid;
   if not found then raise exception 'Produto não encontrado'; end if;
   if item->>'unit_price_cents' is null or (item->>'unit_price_cents')::bigint<>product.price_cents then raise exception 'Preço atualizado. Reabra a venda.'; end if;
   old_item.id:=gen_random_uuid(); old_item.product_id:=product.id; old_item.product_name:=product.name;
   old_item.category:=product.category; old_item.presentation:=product.presentation; old_item.unit_price_cents:=product.price_cents;
   item_key:=product.id::text;
  end if;
  if item_key=any(seen) then raise exception 'Produto repetido'; end if;
  seen:=array_append(seen,item_key);
  total:=total+old_item.unit_price_cents::bigint*qty;
  snapshots:=snapshots||jsonb_build_array(jsonb_build_object('id',old_item.id,'product_id',old_item.product_id,'product_name',old_item.product_name,'category',old_item.category,'presentation',old_item.presentation,'unit_price_cents',old_item.unit_price_cents,'quantity',qty));
 end loop;
 if total>100000000000 or p_received_cents>total or (p_received_cents>0 and p_payment_method='pending') then raise exception 'Valor recebido inválido'; end if;
 update public.sales set customer_id=p_customer_id,customer=customer_name,sale_date=p_sale_date,total_cents=total,received_cents=p_received_cents,payment_method=p_payment_method,notes=btrim(p_notes),last_edit_request=p_request_id where id=sale.id;
 delete from public.sale_items where sale_id=sale.id;
 insert into public.sale_items(id,sale_id,product_id,product_name,category,presentation,unit_price_cents,quantity)
 select x.id,sale.id,x.product_id,x.product_name,x.category,x.presentation,x.unit_price_cents,x.quantity from jsonb_to_recordset(snapshots) as x(id uuid,product_id uuid,product_name text,category text,presentation text,unit_price_cents integer,quantity integer);
 return sale.id;
end $$;
revoke all on function public.update_sale(uuid,integer,uuid,uuid,text,date,bigint,text,text,jsonb) from public,anon;
grant execute on function public.update_sale(uuid,integer,uuid,uuid,text,date,bigint,text,text,jsonb) to authenticated;
