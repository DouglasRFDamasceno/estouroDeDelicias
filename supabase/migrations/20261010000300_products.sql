begin;
create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  category text not null check (char_length(btrim(category)) between 2 and 80),
  presentation text not null check (char_length(btrim(presentation)) between 1 and 80),
  price_cents integer not null check (price_cents between 0 and 100000000),
  created_at timestamptz not null default now()
);
create unique index products_catalog_identity on public.products
  (lower(btrim(name)), lower(btrim(category)), lower(btrim(presentation)));
alter table public.products enable row level security;
alter table public.products force row level security;
revoke all on public.products from public, anon, authenticated;
grant select on public.products to authenticated;
grant insert (name, category, presentation, price_cents) on public.products to authenticated;
grant all on public.products to service_role;
create policy products_read_confirmed on public.products for select to authenticated
using ((select private.confirmed_user()));
create policy products_insert_admin on public.products for insert to authenticated
with check (
  (select private.confirmed_user()) and
  exists (select 1 from public.profiles where id = (select auth.uid()) and is_admin = true)
);
comment on table public.products is 'Catálogo compartilhado da Estouro de Delícias. Leitura por usuários confirmados, cadastro por administradores. Sem dados pessoais ou custos fictícios. Não é um catálogo multiempresa.';
insert into public.products (name, category, presentation, price_cents) values
('Pipoca gourmet · Ninho', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Ninho', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Ninho', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Oreo', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Oreo', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Oreo', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Morango', 'Pipocas gourmet', '50 g', 750),
('Pipoca gourmet · Morango', 'Pipocas gourmet', '100 g', 1300),
('Pipoca gourmet · Morango', 'Pipocas gourmet', '150 g', 1800),
('Pipoca gourmet · Nutella', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Nutella', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Nutella', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Maracujá', 'Pipocas gourmet', '50 g', 750),
('Pipoca gourmet · Maracujá', 'Pipocas gourmet', '100 g', 1300),
('Pipoca gourmet · Maracujá', 'Pipocas gourmet', '150 g', 1800),
('Pipoca gourmet · Limão', 'Pipocas gourmet', '50 g', 750),
('Pipoca gourmet · Limão', 'Pipocas gourmet', '100 g', 1300),
('Pipoca gourmet · Limão', 'Pipocas gourmet', '150 g', 1800),
('Pipoca gourmet · Bom Bom', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Bom Bom', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Bom Bom', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Paçoca', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Paçoca', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Paçoca', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Choco Ninho', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Choco Ninho', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Choco Ninho', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Trufa de Chocolate', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Trufa de Chocolate', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Trufa de Chocolate', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Prestígio', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Prestígio', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Prestígio', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Ovomaltine', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Ovomaltine', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Ovomaltine', 'Pipocas gourmet', '150 g', 2200),
('Pipoca gourmet · Cravejado', 'Pipocas gourmet', '50 g', 900),
('Pipoca gourmet · Cravejado', 'Pipocas gourmet', '100 g', 1600),
('Pipoca gourmet · Cravejado', 'Pipocas gourmet', '150 g', 2200);
commit;
