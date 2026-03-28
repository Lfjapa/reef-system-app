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
  ('kh',          'KH',                        'dKH',  7,      9,      6.5,  null),
  ('calcio',      'Cálcio',                    'ppm',  420,    470,    null, null),
  ('magnesio',    'Magnésio',                  'ppm',  1250,   1400,   null, null),
  ('salinidade',  'Salinidade',                'sg',   1.024,  1.027,  null, null),
  ('temperatura', 'Temperatura',               '°C',   25,     26.5,   null, null),
  ('ph',          'pH',                        '',     7.9,    8.4,    7.8,  8.5),
  ('amonia',      'Amônia',                    'ppm',  0,      0.1,    null, null),
  ('nitrito',     'Nitrito',                   'ppm',  0,      0.1,    null, null),
  ('nitrato',     'Nitrato',                   'ppm',  2,      20,     null, null),
  ('fosfato',     'Fosfato',                   'ppm',  0.01,   0.1,    null, null),
  ('silicato',    'Silicato',                  'ppm',  0,      0.5,    null, null),
  ('iodo',        'Iodo/Estrôncio/Potássio',   'ppm',  null,   null,   null, null)
on conflict (key) do update set
  label        = excluded.label,
  unit         = excluded.unit,
  min_ideal    = excluded.min_ideal,
  max_ideal    = excluded.max_ideal,
  critical_min = excluded.critical_min,
  critical_max = excluded.critical_max,
  updated_at   = now();

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

-- ─── bio_requirements: enrich with difficulty, tank size, behavior ───────────

alter table public.bio_requirements
  add column if not exists difficulty text,
  add column if not exists min_tank_liters integer,
  add column if not exists behavior_notes text;

-- ─── bio_requirements: compatibility / aggression metadata ───────────────────

alter table public.bio_requirements
  add column if not exists compatible_species text[],
  add column if not exists aggression_level text,
  add column if not exists territory_type text,
  add column if not exists predator_risk text[],
  add column if not exists prey_risk text[];

-- ─── user_settings: tank volume and display preferences ──────────────────────

create table if not exists public.user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  tank_volume_liters double precision default 300,
  updated_at timestamptz not null default now()
);

alter table public.user_settings enable row level security;

drop policy if exists user_settings_owner on public.user_settings;
create policy user_settings_owner on public.user_settings
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── water_changes: water change history ─────────────────────────────────────

create table if not exists public.water_changes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  performed_at timestamptz not null default now(),
  volume_liters double precision,
  volume_percent double precision,
  note text not null default '',
  created_at timestamptz not null default now()
);

alter table public.water_changes enable row level security;

drop policy if exists water_changes_owner on public.water_changes;
create policy water_changes_owner on public.water_changes
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ─── v_animals_at_risk: animals whose requirements conflict with latest readings

create or replace view public.v_animals_at_risk as
with latest_readings as (
  select distinct on (user_id, parameter)
    user_id,
    parameter,
    value
  from public.parameter_entries
  order by user_id, parameter, measured_at desc
),
entries_with_reqs as (
  select
    e.user_id,
    e.id as bio_entry_id,
    e.name as animal_name,
    r.scientific_name,
    r.temp_min_c, r.temp_max_c,
    r.sg_min, r.sg_max,
    r.ph_min, r.ph_max,
    r.dkh_min, r.dkh_max
  from public.bio_entries e
  join public.bio_requirements r
    on lower(r.scientific_name) = lower(e.scientific_name)
),
violations as (
  select
    er.user_id,
    er.bio_entry_id,
    er.animal_name,
    er.scientific_name,
    v.parameter_key,
    v.label,
    lr.value as current_value,
    v.req_min,
    v.req_max,
    case
      when v.req_min is not null and lr.value < v.req_min
        then (v.req_min - lr.value) / v.req_min
      when v.req_max is not null and lr.value > v.req_max
        then (lr.value - v.req_max) / v.req_max
      else 0
    end as deviation
  from entries_with_reqs er
  cross join lateral (values
    ('temperatura', 'Temperatura', er.temp_min_c, er.temp_max_c),
    ('salinidade',  'Salinidade',  er.sg_min,     er.sg_max),
    ('ph',          'pH',          er.ph_min,      er.ph_max),
    ('kh',          'KH',          er.dkh_min,     er.dkh_max)
  ) as v(parameter_key, label, req_min, req_max)
  join latest_readings lr
    on lr.user_id = er.user_id
    and lr.parameter = v.parameter_key
  where
    (v.req_min is not null and lr.value < v.req_min) or
    (v.req_max is not null and lr.value > v.req_max)
)
select
  user_id,
  bio_entry_id,
  animal_name,
  scientific_name,
  parameter_key,
  label,
  current_value,
  req_min,
  req_max,
  deviation,
  case when deviation > 0.1 then 'critical' else 'warning' end as severity
from violations
order by user_id, bio_entry_id, severity desc;

revoke all on table public.v_animals_at_risk from anon;
revoke all on table public.v_animals_at_risk from authenticated;
grant select on table public.v_animals_at_risk to authenticated;
