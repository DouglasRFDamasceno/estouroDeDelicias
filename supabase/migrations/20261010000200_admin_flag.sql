begin;
alter table public.profiles add column is_admin boolean not null default false;
comment on column public.profiles.is_admin is 'Administrador da plataforma; alterável somente por operação administrativa confiável. Nunca derivar de user_metadata.';
-- O grant UPDATE da migração anterior é por coluna e não inclui is_admin.
revoke update (is_admin) on public.profiles from public, anon, authenticated;
-- Backend confiável precisa ler o papel e promover o primeiro administrador.
grant usage on schema private to service_role;
grant execute on function private.valid_cpf(text) to service_role;
grant select, update on public.profiles to service_role;
commit;
