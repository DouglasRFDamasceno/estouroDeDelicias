begin;
grant delete on public.products to authenticated;
create policy products_delete_admin on public.products for delete to authenticated
using (
  (select private.confirmed_user()) and
  exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
commit;
