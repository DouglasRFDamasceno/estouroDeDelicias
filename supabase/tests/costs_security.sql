begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000071','cost-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000072','cost-member@example.invalid',now(),'{"is_admin":true}'),
('00000000-0000-0000-0000-000000000073','cost-unconfirmed@example.invalid',null,'{}');
update public.profiles set is_admin=true where id in ('00000000-0000-0000-0000-000000000071','00000000-0000-0000-0000-000000000073');
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000071',true);
do $$ declare mid uuid; pid uuid; rid uuid:=gen_random_uuid(); req uuid:=gen_random_uuid(); rev integer; begin
 insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Chocolate teste',1,'kg',3000) returning id into mid;
 select id into pid from public.products limit 1;
 perform public.save_recipe(rid,0,req,'Receita teste',pid,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',200,'unit','g')));
 if not exists(select 1 from public.recipe_costs where id=rid and total_cents=600 and unit_cost_cents=60) then raise exception 'Cálculo 1kg/200g incorreto'; end if;
 perform public.save_recipe(rid,0,req,'Receita teste',pid,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',200,'unit','g')));
 if (select count(*) from public.recipe_items where recipe_id=rid)<>1 then raise exception 'Duplicou receita'; end if;
 update public.materials set price_cents=6000 where id=mid and revision=1;
 if not exists(select 1 from public.recipe_costs where id=rid and total_cents=1200 and unit_cost_cents=120) then raise exception 'Não recalculou preço'; end if;
 begin update public.materials set purchase_unit='ml' where id=mid; raise exception 'Aceitou dimensão incompatível' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin delete from public.materials where id=mid; raise exception 'Excluiu insumo usado' using errcode='ZX001'; exception when foreign_key_violation or restrict_violation then null; end;
 select revision into rev from public.recipes where id=rid;
 begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Inválida',pid,10,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',200,'unit','ml'))); raise exception 'Aceitou unidades incompatíveis' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 if not exists(select 1 from public.recipe_costs where id=rid and total_cents=1200 and name='Receita teste') then raise exception 'Rollback falhou'; end if;
 perform public.save_recipe(rid,rev,gen_random_uuid(),'Receita atualizada',pid,20,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',0.5,'unit','kg')));
 if not exists(select 1 from public.recipe_costs where id=rid and total_cents=3000 and unit_cost_cents=150 and name='Receita atualizada') then raise exception 'Edição incorreta'; end if;
 begin perform public.save_recipe(rid,rev,gen_random_uuid(),'Antiga',pid,10,'','[]'); raise exception 'Aceitou versão antiga' using errcode='ZX001'; exception when sqlstate 'P0001' then null; end;
 begin update public.recipes set yield_quantity=99 where id=rid; raise exception 'Escrita direta liberada' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 delete from public.recipes where id=rid;
 if exists(select 1 from public.recipe_items where recipe_id=rid) then raise exception 'Itens órfãos'; end if;
 delete from public.materials where id=mid;
 insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Leite teste',2,'l',1200) returning id into mid;
 perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Receita líquida',pid,1,'',jsonb_build_array(jsonb_build_object('material_id',mid,'quantity',250,'unit','ml')));
 if not exists(select 1 from public.recipe_costs where name='Receita líquida' and total_cents=150) then raise exception 'Conversão ml/l incorreta'; end if;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000072',true);
do $$ declare n integer; begin
 if exists(select 1 from public.recipe_costs) or exists(select 1 from public.materials) then raise exception 'Dados expostos ao membro'; end if;
 begin insert into public.materials(name,purchase_quantity,purchase_unit,price_cents) values('Indevido',1,'kg',3000); raise exception 'Membro cadastrou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,10,'','[]'); raise exception 'Membro criou receita' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000073',true);
do $$ begin
 begin perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Indevida',null,10,'','[]'); raise exception 'Não confirmado criou' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
reset role;
set local role anon;
do $$ begin
 begin perform * from public.recipe_costs; raise exception 'View exposta ao anônimo' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
