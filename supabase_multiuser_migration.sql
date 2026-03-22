do $$
declare
  owner_id uuid;
begin
  select id
    into owner_id
  from auth.users
  order by created_at asc
  limit 1;

  alter table if exists public.parameter_entries
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.bio_entries
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.bio_catalog
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.protocol_logs
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.protocol_definitions
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.protocol_checks
    add column if not exists user_id uuid references auth.users(id) on delete cascade;
  alter table if exists public.lighting_phases
    add column if not exists user_id uuid references auth.users(id) on delete cascade;

  if owner_id is not null then
    update public.parameter_entries set user_id = owner_id where user_id is null;
    update public.bio_entries set user_id = owner_id where user_id is null;
    update public.bio_catalog set user_id = owner_id where user_id is null;
    update public.protocol_logs set user_id = owner_id where user_id is null;
    update public.protocol_definitions set user_id = owner_id where user_id is null;
    update public.protocol_checks set user_id = owner_id where user_id is null;
    update public.lighting_phases set user_id = owner_id where user_id is null;
  end if;

  alter table if exists public.parameter_entries alter column user_id set default auth.uid();
  alter table if exists public.bio_entries alter column user_id set default auth.uid();
  alter table if exists public.bio_catalog alter column user_id set default auth.uid();
  alter table if exists public.protocol_logs alter column user_id set default auth.uid();
  alter table if exists public.protocol_definitions alter column user_id set default auth.uid();
  alter table if exists public.protocol_checks alter column user_id set default auth.uid();
  alter table if exists public.lighting_phases alter column user_id set default auth.uid();

  if owner_id is not null then
    alter table if exists public.parameter_entries alter column user_id set not null;
    alter table if exists public.bio_entries alter column user_id set not null;
    alter table if exists public.bio_catalog alter column user_id set not null;
    alter table if exists public.protocol_logs alter column user_id set not null;
    alter table if exists public.protocol_definitions alter column user_id set not null;
    alter table if exists public.protocol_checks alter column user_id set not null;
    alter table if exists public.lighting_phases alter column user_id set not null;
  end if;
end $$;

do $$
begin
  if to_regclass('public.bio_catalog') is not null
     and (select count(*) from public.bio_catalog where user_id is null) = 0 then
    alter table public.bio_catalog drop constraint if exists bio_catalog_pkey;
    alter table public.bio_catalog
      add constraint bio_catalog_pkey primary key (user_id, primary_alias);
  end if;

  if to_regclass('public.protocol_definitions') is not null
     and (select count(*) from public.protocol_definitions where user_id is null) = 0 then
    alter table public.protocol_definitions drop constraint if exists protocol_definitions_pkey;
    alter table public.protocol_definitions
      add constraint protocol_definitions_pkey primary key (user_id, protocol_key);
  end if;

  if to_regclass('public.protocol_checks') is not null
     and (select count(*) from public.protocol_checks where user_id is null) = 0 then
    alter table public.protocol_checks drop constraint if exists protocol_checks_protocol_key_week_start_day_index_key;
    alter table public.protocol_checks
      add constraint protocol_checks_user_key_week_day_unique unique (user_id, protocol_key, week_start, day_index);
  end if;
end $$;

alter table if exists public.parameter_entries enable row level security;
alter table if exists public.bio_entries enable row level security;
alter table if exists public.bio_catalog enable row level security;
alter table if exists public.protocol_logs enable row level security;
alter table if exists public.protocol_definitions enable row level security;
alter table if exists public.protocol_checks enable row level security;
alter table if exists public.lighting_phases enable row level security;
alter table if exists public.user_parameter_settings enable row level security;

drop policy if exists parameter_entries_owner on public.parameter_entries;
create policy parameter_entries_owner on public.parameter_entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bio_entries_owner on public.bio_entries;
create policy bio_entries_owner on public.bio_entries
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists bio_catalog_owner on public.bio_catalog;
create policy bio_catalog_owner on public.bio_catalog
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists protocol_logs_owner on public.protocol_logs;
create policy protocol_logs_owner on public.protocol_logs
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists protocol_definitions_owner on public.protocol_definitions;
create policy protocol_definitions_owner on public.protocol_definitions
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists protocol_checks_owner on public.protocol_checks;
create policy protocol_checks_owner on public.protocol_checks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists lighting_phases_owner on public.lighting_phases;
create policy lighting_phases_owner on public.lighting_phases
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists user_parameter_settings_owner on public.user_parameter_settings;
create policy user_parameter_settings_owner on public.user_parameter_settings
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
