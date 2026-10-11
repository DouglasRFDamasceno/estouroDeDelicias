-- Somente banco local/de testes como postgres, após todas as migrações.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values
('00000000-0000-0000-0000-000000000091','session-admin@example.invalid',now(),'{}'),
('00000000-0000-0000-0000-000000000092','session-other@example.invalid',now(),'{}');
update public.profiles set is_admin=true where id='00000000-0000-0000-0000-000000000091';
insert into auth.sessions(id,user_id,created_at,not_after) values
('10000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()-interval '1 hour',null),
('11000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()-interval '71 hours 59 minutes',null),
('20000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()-interval '72 hours',null),
('30000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()-interval '73 hours',null),
('40000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()+interval '1 hour',null),
('50000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000091',now()-interval '1 hour',now()-interval '1 minute'),
('60000000-0000-0000-0000-000000000091','00000000-0000-0000-0000-000000000092',now()-interval '1 hour',null);
set local role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-000000000091',true);
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000091","session_id":"10000000-0000-0000-0000-000000000091"}',true);
do $$ begin
 if not public.current_session_valid() then raise exception 'Sessão recente rejeitada'; end if;
 if not exists(select 1 from public.products) then raise exception 'Catálogo legítimo bloqueado'; end if;
 perform public.dashboard_summary(current_date,current_date);
 perform set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000091","session_id":"11000000-0000-0000-0000-000000000091"}',true);
 if not public.current_session_valid() then raise exception 'Sessão antes de 72h rejeitada'; end if;
 begin perform * from auth.sessions; raise exception 'Sessões expostas' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 begin perform private.session_within_deadline(); raise exception 'Helper privado exposto' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
do $$ declare sid text; affected integer; begin
 foreach sid in array array[
  '20000000-0000-0000-0000-000000000091', -- exatamente 72h
  '30000000-0000-0000-0000-000000000091', -- vencida
  '40000000-0000-0000-0000-000000000091', -- data futura
  '50000000-0000-0000-0000-000000000091', -- not_after vencido
  '60000000-0000-0000-0000-000000000091', -- sessão de outro usuário
  '70000000-0000-0000-0000-000000000091', -- inexistente/revogada
  'inválido', '', null
 ] loop
  -- iat renovado não pode reiniciar o prazo nem substituir a data do banco.
  perform set_config('request.jwt.claims',jsonb_build_object('sub','00000000-0000-0000-0000-000000000091','session_id',sid,'iat',extract(epoch from now()))::text,true);
  if public.current_session_valid() then raise exception 'Sessão inválida aceita: %',sid; end if;
  if exists(select 1 from public.profiles) or exists(select 1 from public.products) then raise exception 'RLS permitiu leitura: %',sid; end if;
  update public.profiles set city='Inválida'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'RLS permitiu editar perfil'; end if;
  update public.products set name='Inválido'; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'RLS permitiu editar catálogo'; end if;
  delete from public.products; get diagnostics affected=row_count;
  if affected<>0 then raise exception 'RLS permitiu remover catálogo'; end if;
  begin insert into public.products(name,category,presentation,price_cents) values('Inválido','Teste','un',1); raise exception 'Inserção aceita' using errcode='ZX001'; exception when insufficient_privilege then null; end;
  begin perform public.dashboard_summary(current_date,current_date); raise exception 'Resumo aceito' using errcode='ZX001'; exception when insufficient_privilege then null; end;
  begin perform public.dashboard_products(current_date,current_date,1,10,'name',true); raise exception 'Ranking aceito' using errcode='ZX001'; exception when insufficient_privilege then null; end;
  begin perform public.create_sale(gen_random_uuid(),'Teste',current_date,0,'pending','','[]'); raise exception 'Venda aceita' using errcode='ZX001'; exception when insufficient_privilege then null; end;
  begin perform public.update_sale(gen_random_uuid(),1,gen_random_uuid(),null,'Teste',current_date,0,'pending','','[]'); raise exception 'Edição aceita' using errcode='ZX001'; exception when insufficient_privilege then null; end;
  begin perform public.save_recipe(gen_random_uuid(),0,gen_random_uuid(),'Teste',null,1,'','[]'); raise exception 'Receita aceita' using errcode='ZX001'; exception when insufficient_privilege then null; end;
 end loop;
end $$;
-- Restaurar o JWT recente não alterado continua funcionando.
select set_config('request.jwt.claims','{"sub":"00000000-0000-0000-0000-000000000091","session_id":"10000000-0000-0000-0000-000000000091"}',true);
do $$ begin if not public.current_session_valid() then raise exception 'Sessão legítima deixou de funcionar'; end if; end $$;
reset role;
delete from auth.sessions where id='10000000-0000-0000-0000-000000000091';
set local role authenticated;
do $$ begin if public.current_session_valid() then raise exception 'Sessão removida continuou válida'; end if; end $$;
reset role;
set local role anon;
do $$ begin
 begin perform public.current_session_valid(); raise exception 'Anônimo executou RPC' using errcode='ZX001'; exception when insufficient_privilege then null; end;
end $$;
rollback;
