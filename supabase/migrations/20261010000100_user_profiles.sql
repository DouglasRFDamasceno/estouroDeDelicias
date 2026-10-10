begin;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create function private.valid_cpf(value text) returns boolean
language plpgsql immutable strict set search_path = '' as $$
declare i integer; size integer; total integer; digit integer;
begin
  if value !~ '^[0-9]{11}$' or value ~ '^([0-9])\1{10}$' then return false; end if;
  foreach size in array array[9,10] loop
    total := 0;
    for i in 1..size loop total := total + substring(value from i for 1)::integer * (size + 2 - i); end loop;
    digit := (total * 10) % 11;
    if digit = 10 then digit := 0; end if;
    if digit <> substring(value from size + 1 for 1)::integer then return false; end if;
  end loop;
  return true;
end;
$$;
revoke all on function private.valid_cpf(text) from public, anon;
grant execute on function private.valid_cpf(text) to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 2 and 120),
  phone text check (phone is null or phone ~ '^[0-9]{10,11}$'),
  document text check (document is null or private.valid_cpf(document)),
  postal_code text check (postal_code is null or postal_code ~ '^[0-9]{8}$'),
  street text check (street is null or char_length(street) between 1 and 160),
  address_number text check (address_number is null or char_length(address_number) between 1 and 20),
  complement text check (complement is null or char_length(complement) between 1 and 120),
  district text check (district is null or char_length(district) between 1 and 100),
  city text check (city is null or char_length(city) between 1 and 100),
  state text check (state is null or state in ('AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
alter table public.profiles force row level security;
revoke all on public.profiles from public, anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone, document, postal_code, street, address_number, complement, district, city, state) on public.profiles to authenticated;
-- Leitura e escrita só do titular, com e-mail confirmado. Sem INSERT/DELETE pelo cliente.
create function private.confirmed_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users where id = (select auth.uid()) and email_confirmed_at is not null);
$$;
revoke all on function private.confirmed_user() from public, anon;
grant execute on function private.confirmed_user() to authenticated;
create policy profiles_select_self on public.profiles for select to authenticated
using (id = (select auth.uid()) and (select private.confirmed_user()));
create policy profiles_update_self on public.profiles for update to authenticated
using (id = (select auth.uid()) and (select private.confirmed_user()))
with check (id = (select auth.uid()) and (select private.confirmed_user()));

create function private.create_user_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
declare user_name text;
begin
  user_name := left(btrim(coalesce(new.raw_user_meta_data->>'full_name', '')), 120);
  if char_length(user_name) < 2 then user_name := 'Novo usuário'; end if;
  insert into public.profiles(id, full_name) values (new.id, user_name);
  return new;
end;
$$;
revoke all on function private.create_user_profile() from public, anon, authenticated;
create trigger create_user_profile after insert on auth.users for each row execute function private.create_user_profile();
create function private.touch_profile() returns trigger language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
revoke all on function private.touch_profile() from public, anon, authenticated;
create trigger touch_profile before update on public.profiles for each row execute function private.touch_profile();
-- Contas existentes também recebem perfil; nenhum documento copiado de metadados.
insert into public.profiles(id, full_name)
select id, case when char_length(btrim(coalesce(raw_user_meta_data->>'full_name',''))) >= 2 then left(btrim(raw_user_meta_data->>'full_name'),120) else 'Novo usuário' end from auth.users
on conflict (id) do nothing;
comment on table public.profiles is 'Dados pessoais privados do titular. Não usar como autorização ou vínculo empresarial.';
commit;
