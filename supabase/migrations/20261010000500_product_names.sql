begin;
-- A constraint de unicidade aborta a migração se houver conflito; nunca descartar produtos.
update public.products
set name = btrim(regexp_replace(name, '^Pipoca gourmet[[:space:]]*·[[:space:]]*', ''))
where category = 'Pipocas gourmet' and name like 'Pipoca gourmet · %';
commit;
