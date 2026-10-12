-- Executar após 20261011000400_accent_insensitive_search.sql.
begin;
do $$
declare r record; actual text;
begin
  if public.normalize_search('PAÇOCA João açúcar CAFÉ') <> 'pacoca joao acucar cafe'
     or public.normalize_search(U&'Pac\0327oca') <> 'pacoca' then
    raise exception 'Falha na normalização de acentos';
  end if;
  for r in select * from (values
    ('products', 'name'), ('products', 'category'), ('products', 'presentation'),
    ('customers', 'name'), ('materials', 'name'), ('recipe_costs', 'name'),
    ('sales', 'customer'), ('pending_orders', 'customer')
  ) as fields(relation, field) loop
    execute format(
      'select public.%I(json_populate_record(null::public.%I, $1))',
      r.field || '_search', r.relation
    ) into actual using json_build_object(r.field, 'Paçoca');
    if actual <> 'pacoca' or actual is null then
      raise exception 'Falha no campo %.%', r.relation, r.field;
    end if;
  end loop;
end $$;
rollback;
