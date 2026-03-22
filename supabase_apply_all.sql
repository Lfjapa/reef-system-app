create extension if not exists "pgcrypto";

create table if not exists parameter_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  parameter text not null,
  value double precision not null,
  measured_at timestamptz not null,
  note text not null default ''
);

create table if not exists bio_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  type text not null,
  name text not null,
  scientific_name text not null default '',
  position text not null default '',
  note text not null default '',
  created_at timestamptz not null
);

create table if not exists bio_catalog (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  primary_alias text not null,
  aliases text[] not null default '{}',
  type text not null,
  scientific_name text not null default '',
  position text not null default '',
  note text not null default '',
  primary key (user_id, primary_alias)
);

create table if not exists protocol_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  protocol_key text not null,
  performed_at timestamptz not null,
  note text not null default ''
);

create table if not exists protocol_definitions (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  protocol_key text not null,
  label text not null,
  days int[] not null default '{}',
  quantity double precision,
  unit text not null default '',
  primary key (user_id, protocol_key)
);

create table if not exists protocol_checks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  protocol_key text not null,
  week_start date not null,
  day_index int not null,
  checked_at timestamptz not null,
  quantity double precision,
  unit text not null default '',
  note text not null default '',
  unique (user_id, protocol_key, week_start, day_index)
);

create table if not exists lighting_phases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  name text not null,
  time time not null,
  uv int not null default 0,
  white int not null default 0,
  blue int not null default 0
);

create table if not exists user_parameter_settings (
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  parameter text not null,
  is_custom_enabled boolean not null default false,
  custom_min double precision,
  custom_max double precision,
  updated_at timestamptz not null default now(),
  primary key (user_id, parameter)
);

grant usage on schema public to anon, authenticated;

revoke all on table parameter_entries from anon;
revoke all on table bio_entries from anon;
revoke all on table bio_catalog from anon;
revoke all on table protocol_logs from anon;
revoke all on table protocol_definitions from anon;
revoke all on table protocol_checks from anon;
revoke all on table lighting_phases from anon;
revoke all on table user_parameter_settings from anon;

grant select, insert, update, delete on table parameter_entries to authenticated;
grant select, insert, update, delete on table bio_entries to authenticated;
grant select, insert, update, delete on table bio_catalog to authenticated;
grant select, insert, update, delete on table protocol_logs to authenticated;
grant select, insert, update, delete on table protocol_definitions to authenticated;
grant select, insert, update, delete on table protocol_checks to authenticated;
grant select, insert, update, delete on table lighting_phases to authenticated;
grant select, insert, update, delete on table user_parameter_settings to authenticated;

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
    if not exists (
      select 1
      from pg_constraint c
      where c.conrelid = 'public.protocol_checks'::regclass
        and c.conname = 'protocol_checks_user_key_week_day_unique'
    ) then
      if exists (
        select 1
        from pg_class i
        join pg_namespace n on n.oid = i.relnamespace
        where n.nspname = 'public'
          and i.relname = 'protocol_checks_user_key_week_day_unique'
          and i.relkind = 'i'
      ) then
        execute 'drop index if exists public.protocol_checks_user_key_week_day_unique';
      end if;
      alter table public.protocol_checks
        add constraint protocol_checks_user_key_week_day_unique unique (user_id, protocol_key, week_start, day_index);
    end if;
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

create index if not exists idx_parameter_entries_user_parameter_measured_at
  on public.parameter_entries (user_id, parameter, measured_at desc);

create index if not exists idx_bio_entries_user_type
  on public.bio_entries (user_id, type);

create index if not exists idx_protocol_logs_user_protocol_key_performed_at
  on public.protocol_logs (user_id, protocol_key, performed_at desc);

create index if not exists idx_protocol_checks_user_week_start
  on public.protocol_checks (user_id, week_start);

create index if not exists idx_bio_catalog_aliases_gin
  on public.bio_catalog using gin (aliases);

do $$
begin
  alter table public.parameter_entries
    add constraint parameter_value_range check (value >= -50 and value <= 100000);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_checks
    add constraint protocol_checks_day_index_range check (day_index between 0 and 6);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.lighting_phases
    add constraint lighting_channels_positive check (uv >= 0 and white >= 0 and blue >= 0);
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_definitions
    add constraint protocol_definitions_days_valid check (
      array_length(days, 1) is null
      or days <@ array[0, 1, 2, 3, 4, 5, 6]
    );
exception
  when duplicate_object then null;
end $$;

create or replace function public.update_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

alter table public.parameter_entries
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.bio_entries
  add column if not exists updated_at timestamptz not null default now();

alter table public.bio_catalog
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_logs
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_definitions
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.protocol_checks
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.lighting_phases
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  create trigger trg_parameter_entries_updated_at
    before update on public.parameter_entries
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_bio_entries_updated_at
    before update on public.bio_entries
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_bio_catalog_updated_at
    before update on public.bio_catalog
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_logs_updated_at
    before update on public.protocol_logs
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_definitions_updated_at
    before update on public.protocol_definitions
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_protocol_checks_updated_at
    before update on public.protocol_checks
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  create trigger trg_lighting_phases_updated_at
    before update on public.lighting_phases
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_logs
    add constraint protocol_logs_definition_fkey
    foreign key (user_id, protocol_key)
    references public.protocol_definitions (user_id, protocol_key)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

do $$
begin
  alter table public.protocol_checks
    add constraint protocol_checks_definition_fkey
    foreign key (user_id, protocol_key)
    references public.protocol_definitions (user_id, protocol_key)
    on delete cascade
    not valid;
exception
  when duplicate_object then null;
end $$;

do $$
declare
  tbl text;
  con record;
begin
  foreach tbl in array array[
    'parameter_entries',
    'bio_entries',
    'bio_catalog',
    'protocol_logs',
    'protocol_definitions',
    'protocol_checks',
    'lighting_phases'
  ]
  loop
    execute format('alter table if exists public.%I add column if not exists user_id uuid', tbl);

    for con in
      select c.conname
      from pg_constraint c
      join pg_class t on t.oid = c.conrelid
      join pg_namespace n on n.oid = t.relnamespace
      where n.nspname = 'public'
        and t.relname = tbl
        and c.contype = 'f'
        and exists (
          select 1
          from unnest(c.conkey) as k(attnum)
          join pg_attribute a on a.attrelid = t.oid and a.attnum = k.attnum
          where a.attname = 'user_id'
        )
    loop
      execute format('alter table public.%I drop constraint if exists %I', tbl, con.conname);
    end loop;

    execute format(
      'alter table public.%I add constraint %I foreign key (user_id) references auth.users(id) on delete cascade not valid',
      tbl,
      tbl || '_user_id_fkey'
    );
  end loop;
end $$;

create table if not exists public.bio_requirements (
  id uuid primary key default gen_random_uuid(),
  scientific_name text not null,
  common_name text not null default '',
  group_name text not null default '',
  water_conditions text,
  reef_compatible text,
  lighting text,
  flow text,
  temp_min_c double precision,
  temp_max_c double precision,
  sg_min double precision,
  sg_max double precision,
  ph_min double precision,
  ph_max double precision,
  dkh_min double precision,
  dkh_max double precision,
  source text not null default '',
  source_url text not null default '',
  scraped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (scientific_name)
);

do $$
begin
  create trigger trg_bio_requirements_updated_at
    before update on public.bio_requirements
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

alter table public.bio_requirements enable row level security;

drop policy if exists bio_requirements_read on public.bio_requirements;
create policy bio_requirements_read on public.bio_requirements
  for select
  to anon, authenticated
  using (true);

revoke all on table public.bio_requirements from anon;
revoke all on table public.bio_requirements from authenticated;
grant select on table public.bio_requirements to anon;
grant select on table public.bio_requirements to authenticated;

create table if not exists public.parameter_dim (
  key text primary key,
  label text not null,
  unit text not null default '',
  min_ideal double precision,
  max_ideal double precision,
  critical_min double precision,
  critical_max double precision,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  create trigger trg_parameter_dim_updated_at
    before update on public.parameter_dim
    for each row execute function public.update_updated_at();
exception
  when duplicate_object then null;
end $$;

alter table public.parameter_dim enable row level security;

drop policy if exists parameter_dim_read on public.parameter_dim;
create policy parameter_dim_read on public.parameter_dim
  for select
  to anon, authenticated
  using (true);

revoke all on table public.parameter_dim from anon;
revoke all on table public.parameter_dim from authenticated;
grant select on table public.parameter_dim to anon;
grant select on table public.parameter_dim to authenticated;

insert into public.parameter_dim (key, label, unit, min_ideal, max_ideal, critical_min, critical_max)
values
  ('kh', 'KH', 'dKH', 7, 9, 6.5, null),
  ('calcio', 'Cálcio', 'ppm', 420, 470, null, null),
  ('magnesio', 'Magnésio', 'ppm', 1250, 1400, null, null),
  ('salinidade', 'Salinidade', 'sg', 1.024, 1.026, null, null),
  ('temperatura', 'Temperatura', '°C', 24, 26, null, null),
  ('ph', 'pH', '', 7.9, 8.4, 7.8, 8.5)
on conflict (key) do nothing;

create or replace view public.v_sistema_seguro as
with users as (
  select distinct user_id from public.parameter_entries
  union
  select distinct user_id from public.bio_entries
  union
  select distinct user_id from public.user_parameter_settings
),
candidates as (
  select
    b.user_id,
    b.scientific_name as bio_scientific_name,
    r.scientific_name as req_scientific_name,
    r.temp_min_c,
    r.temp_max_c,
    r.sg_min,
    r.sg_max,
    r.ph_min,
    r.ph_max,
    r.dkh_min,
    r.dkh_max
  from public.bio_entries b
  join public.bio_requirements r
    on lower(regexp_replace(trim(b.scientific_name), '^\s*([A-Za-z]+)\s+([A-Za-z\.-]+).*$','\1 \2')) =
       lower(regexp_replace(trim(r.scientific_name), '^\s*([A-Za-z]+)\s+([A-Za-z\.-]+).*$','\1 \2'))
  where b.scientific_name is not null
    and trim(b.scientific_name) <> ''
),
unpivoted as (
  select
    user_id,
    v.parameter_key as parameter,
    v.min_ideal,
    v.max_ideal
  from candidates
  cross join lateral (values
    ('temperatura', temp_min_c, temp_max_c),
    ('salinidade', sg_min, sg_max),
    ('ph', ph_min, ph_max),
    ('kh', dkh_min, dkh_max)
  ) as v(parameter_key, min_ideal, max_ideal)
  where v.min_ideal is not null and v.max_ideal is not null
),
bio_zone as (
  select
    u.user_id,
    u.parameter,
    max(u.min_ideal) as bio_min,
    min(u.max_ideal) as bio_max
  from unpivoted u
  group by u.user_id, u.parameter
),
base as (
  select
    u.user_id,
    pd.key as parameter,
    pd.label as parametro,
    pd.unit,
    coalesce(bz.bio_min, pd.min_ideal) as zona_minima_geral_base,
    coalesce(bz.bio_max, pd.max_ideal) as zona_maxima_geral_base
  from users u
  cross join public.parameter_dim pd
  left join bio_zone bz
    on bz.user_id = u.user_id
    and bz.parameter = pd.key
),
final as (
  select
    b.user_id,
    b.parameter,
    b.parametro,
    b.unit,
    b.zona_minima_geral_base,
    b.zona_maxima_geral_base,
    s.is_custom_enabled,
    s.custom_min,
    s.custom_max,
    case
      when s.is_custom_enabled and s.custom_min is not null and s.custom_max is not null
        then s.custom_min
      else b.zona_minima_geral_base
    end as zona_minima_geral,
    case
      when s.is_custom_enabled and s.custom_min is not null and s.custom_max is not null
        then s.custom_max
      else b.zona_maxima_geral_base
    end as zona_maxima_geral
  from base b
  left join public.user_parameter_settings s
    on s.user_id = b.user_id
    and s.parameter = b.parameter
)
select *
from final
where zona_minima_geral is not null
  and zona_maxima_geral is not null;

create or replace view public.v_taxa_consumo as
with ordered as (
  select
    user_id,
    parameter,
    value,
    measured_at,
    lag(value) over (partition by user_id, parameter order by measured_at) as prev_value,
    lag(measured_at) over (partition by user_id, parameter order by measured_at) as prev_measured_at
  from public.parameter_entries
)
select
  user_id,
  parameter,
  value as atual,
  prev_value as anterior,
  measured_at,
  prev_measured_at,
  value - prev_value as delta,
  extract(epoch from measured_at - prev_measured_at) / 86400.0 as days_between,
  case
    when prev_measured_at is null then null
    when extract(epoch from measured_at - prev_measured_at) <= 0 then null
    else (value - prev_value) / (extract(epoch from measured_at - prev_measured_at) / 86400.0)
  end as consumo_diario
from ordered
where prev_measured_at is not null;

revoke all on table public.v_sistema_seguro from anon;
revoke all on table public.v_sistema_seguro from authenticated;
grant select on table public.v_sistema_seguro to authenticated;

revoke all on table public.v_taxa_consumo from anon;
revoke all on table public.v_taxa_consumo from authenticated;
grant select on table public.v_taxa_consumo to authenticated;
